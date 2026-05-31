import { expect, test, type Page, type TestInfo } from '@playwright/test'
import {
  getPropertiesPanel,
  getSelectedElementRect,
  resetCanvas,
  setStrokeDiagnosticsMode,
  waitForAppReady
} from './test-utils'

const PADDING = 24
const STROKE_WIDTH = 10
const REPORTED_VECTOR_6_WIDTH = 360.120941483566
const REPORTED_VECTOR_6_HEIGHT = 366.06359840210007
const REPORTED_VECTOR_6_PRODUCT_STROKE_COLOR = 'DF0606'
const TP12 = { x: 192.42083700791653, y: 0 }
const TP15 = { x: 0, y: 14.030686031827244 }
const TP16 = { x: 270.59180204238254, y: 345.42212754546125 }
const TP15_OUT = { x: 0, y: 14.030686031827244 }
const TP16_IN = { x: 263.9105229796076, y: 362.79345310867603 }
const TP16_OUT = { x: 277.2730811051575, y: 328.05080198224647 }

interface Vec2 {
  x: number
  y: number
}

interface CubicSegment {
  start: Vec2
  control1: Vec2
  control2: Vec2
  end: Vec2
}

interface RasterCapture {
  base64: string
  width: number
  height: number
  elementWidth: number
  elementHeight: number
  padding: number
}

interface RedCoverageProbe {
  label: string
  point: Vec2
  size: number
  minCoverage: number
}

interface ForbiddenRedCoverageProbe {
  label: string
  point: Vec2
  size: number
  maxCoverage: number
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await waitForAppReady(page)
  await setStrokeDebugDisableVisualOverlapCollapse(page, false)
  await resetCanvas(page)
  await setStrokeDiagnosticsMode(page, 'full')
})

test.afterEach(async ({ page }) => {
  await setStrokeDebugDisableVisualOverlapCollapse(page, false)
})

const setStrokeDebugDisableVisualOverlapCollapse = async (
  page: Page,
  disabled: boolean
) => {
  await page.evaluate((nextDisabled) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    core?.setSystemProperty?.(
      'strokeDebugDisableVisualOverlapCollapse',
      nextDisabled
    )
  }, disabled)
  await page.waitForTimeout(120)
}

const captureSelectedElementRaster = async (
  page: Page,
  padding = PADDING
): Promise<RasterCapture> => {
  const rect = await getSelectedElementRect(page)
  if (!rect) {
    throw new Error('No selected element snapshot available')
  }

  const viewportState = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    return {
      zoom: core?.getSystemProperty?.('zoom') ?? 1,
      viewport: core?.getSystemProperty?.('viewportPosition') ?? { x: 0, y: 0 }
    }
  })
  const clip = {
    x: Math.max(
      0,
      Math.floor(
        rect.x * viewportState.zoom + viewportState.viewport.x - padding
      )
    ),
    y: Math.max(
      0,
      Math.floor(
        rect.y * viewportState.zoom + viewportState.viewport.y - padding
      )
    ),
    width: Math.max(
      1,
      Math.ceil(rect.width * viewportState.zoom + padding * 2)
    ),
    height: Math.max(
      1,
      Math.ceil(rect.height * viewportState.zoom + padding * 2)
    )
  }
  const screenshot = await page.screenshot({ clip })

  return {
    base64: screenshot.toString('base64'),
    width: clip.width,
    height: clip.height,
    elementWidth: Math.ceil(rect.width * viewportState.zoom),
    elementHeight: Math.ceil(rect.height * viewportState.zoom),
    padding
  }
}

const getBase64RedCoverage = async (
  page: Page,
  base64: string,
  region: { x: number; y: number; width: number; height: number }
) =>
  page.evaluate(
    async ({ base64, region: targetRegion }) => {
      const response = await fetch(`data:image/png;base64,${base64}`)
      const blob = await response.blob()
      const bitmap = await createImageBitmap(blob)
      const canvas = document.createElement('canvas')
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      const context = canvas.getContext('2d')
      if (!context) {
        throw new Error('Canvas 2D context unavailable')
      }

      context.drawImage(bitmap, 0, 0)
      const startX = Math.max(0, Math.floor(targetRegion.x))
      const startY = Math.max(0, Math.floor(targetRegion.y))
      const endX = Math.min(
        canvas.width,
        Math.ceil(targetRegion.x + targetRegion.width)
      )
      const endY = Math.min(
        canvas.height,
        Math.ceil(targetRegion.y + targetRegion.height)
      )

      let total = 0
      let red = 0
      for (let y = startY; y < endY; y += 1) {
        for (let x = startX; x < endX; x += 1) {
          const [r, g, b, a] = context.getImageData(x, y, 1, 1).data
          total += 1
          if (a > 120 && r > 95 && g < 80 && b < 80 && r - g > 35) {
            red += 1
          }
        }
      }

      return total > 0 ? red / total : 0
    },
    { base64, region }
  )

const getRasterRegion = (raster: RasterCapture, point: Vec2, size: number) => {
  const scaleX = raster.elementWidth / REPORTED_VECTOR_6_WIDTH
  const scaleY = raster.elementHeight / REPORTED_VECTOR_6_HEIGHT
  return {
    x: raster.padding + point.x * scaleX - size / 2,
    y: raster.padding + point.y * scaleY - size / 2,
    width: size,
    height: size
  }
}

const getRasterRectRegion = (
  raster: RasterCapture,
  region: { x: number; y: number; width: number; height: number }
) => {
  const scaleX = raster.elementWidth / REPORTED_VECTOR_6_WIDTH
  const scaleY = raster.elementHeight / REPORTED_VECTOR_6_HEIGHT
  return {
    x: raster.padding + region.x * scaleX,
    y: raster.padding + region.y * scaleY,
    width: region.width * scaleX,
    height: region.height * scaleY
  }
}

const cropBase64Png = async (
  page: Page,
  base64: string,
  region: { x: number; y: number; width: number; height: number }
) =>
  page.evaluate(
    async ({ base64: sourceBase64, region: cropRegion }) => {
      const response = await fetch(`data:image/png;base64,${sourceBase64}`)
      const blob = await response.blob()
      const bitmap = await createImageBitmap(blob)
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.ceil(cropRegion.width))
      canvas.height = Math.max(1, Math.ceil(cropRegion.height))
      const context = canvas.getContext('2d')
      if (!context) {
        throw new Error('Canvas 2D context unavailable')
      }
      context.drawImage(
        bitmap,
        cropRegion.x,
        cropRegion.y,
        cropRegion.width,
        cropRegion.height,
        0,
        0,
        canvas.width,
        canvas.height
      )
      return canvas
        .toDataURL('image/png')
        .replace(/^data:image\/png;base64,/, '')
    },
    { base64, region }
  )

const interpolatePoint = (start: Vec2, end: Vec2, amount: number): Vec2 => ({
  x: start.x + (end.x - start.x) * amount,
  y: start.y + (end.y - start.y) * amount
})

const getCubicPoint = (segment: CubicSegment, t: number): Vec2 => {
  const mt = 1 - t
  return {
    x:
      mt ** 3 * segment.start.x +
      3 * mt ** 2 * t * segment.control1.x +
      3 * mt * t ** 2 * segment.control2.x +
      t ** 3 * segment.end.x,
    y:
      mt ** 3 * segment.start.y +
      3 * mt ** 2 * t * segment.control1.y +
      3 * mt * t ** 2 * segment.control2.y +
      t ** 3 * segment.end.y
  }
}

const getCubicTangent = (segment: CubicSegment, t: number): Vec2 => {
  const mt = 1 - t
  const derivative = {
    x:
      3 * mt ** 2 * (segment.control1.x - segment.start.x) +
      6 * mt * t * (segment.control2.x - segment.control1.x) +
      3 * t ** 2 * (segment.end.x - segment.control2.x),
    y:
      3 * mt ** 2 * (segment.control1.y - segment.start.y) +
      6 * mt * t * (segment.control2.y - segment.control1.y) +
      3 * t ** 2 * (segment.end.y - segment.control2.y)
  }
  const length = Math.hypot(derivative.x, derivative.y)
  return length > 0
    ? { x: derivative.x / length, y: derivative.y / length }
    : { x: 1, y: 0 }
}

const getCubicOffsetPoint = (
  segment: CubicSegment,
  t: number,
  offsetDistance: number
): Vec2 => {
  const point = getCubicPoint(segment, t)
  const tangent = getCubicTangent(segment, t)
  return {
    x: point.x - tangent.y * offsetDistance,
    y: point.y + tangent.x * offsetDistance
  }
}

const getLowerRightSmoothJoinCorridorProbes = (): RedCoverageProbe[] => {
  const incoming = {
    start: TP15,
    control1: TP15_OUT,
    control2: TP16_IN,
    end: TP16
  }
  const outgoing = {
    start: TP16,
    control1: TP16_OUT,
    control2: TP12,
    end: TP12
  }
  const previousOffset = getCubicOffsetPoint(incoming, 0.985, STROKE_WIDTH)
  const nextOffset = getCubicOffsetPoint(outgoing, 0.015, STROKE_WIDTH)
  const centerOutside = interpolatePoint(previousOffset, nextOffset, 0.5)
  const bridgeProbes = [0.25, 0.5, 0.75].map((amount) =>
    interpolatePoint(previousOffset, nextOffset, amount)
  )
  const radialProbes = [0.45, 0.65, 0.85].map((amount) =>
    interpolatePoint(TP16, centerOutside, amount)
  )

  return [...bridgeProbes, ...radialProbes].map((point, index) => ({
    label: `lower-right smooth join corridor ${index}`,
    point,
    size: 8,
    minCoverage: 0.08
  }))
}

const assertRedCoverageProbes = async (
  page: Page,
  raster: RasterCapture,
  probes: RedCoverageProbe[]
) => {
  const failures: {
    label: string
    coverage: number
    minCoverage: number
    region: { x: number; y: number; width: number; height: number }
  }[] = []

  for (const probe of probes) {
    const region = getRasterRegion(raster, probe.point, probe.size)
    const coverage = await getBase64RedCoverage(page, raster.base64, region)
    if (coverage < probe.minCoverage) {
      failures.push({
        label: probe.label,
        coverage,
        minCoverage: probe.minCoverage,
        region
      })
    }
  }

  expect(failures, JSON.stringify(failures, null, 2)).toEqual([])
}

const assertForbiddenRedCoverageProbes = async (
  page: Page,
  raster: RasterCapture,
  probes: ForbiddenRedCoverageProbe[]
) => {
  const failures: {
    label: string
    coverage: number
    maxCoverage: number
    region: { x: number; y: number; width: number; height: number }
  }[] = []

  for (const probe of probes) {
    const region = getRasterRegion(raster, probe.point, probe.size)
    const coverage = await getBase64RedCoverage(page, raster.base64, region)
    if (coverage > probe.maxCoverage) {
      failures.push({
        label: probe.label,
        coverage,
        maxCoverage: probe.maxCoverage,
        region
      })
    }
  }

  expect(failures, JSON.stringify(failures, null, 2)).toEqual([])
}

const attachPng = async (label: string, base64: string, testInfo: TestInfo) => {
  await testInfo.attach(label, {
    body: Buffer.from(base64, 'base64'),
    contentType: 'image/png'
  })
}

const createReportedVector6InsideSolid = async (page: Page) => {
  await page.evaluate(
    ({ color, strokeWidth }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const elementApis = (window as any).__AsyraE2E__?.elementApis
      const points = {
        'tp-12': {
          id: 'tp-12',
          kind: 'anchor',
          x: 192.42083700791653,
          y: 0,
          anchorType: 'sharp'
        },
        'tp-13': {
          id: 'tp-13',
          kind: 'anchor',
          x: 11.358174406717296,
          y: 364.1297089212308,
          anchorType: 'smooth'
        },
        'tp-12:out': {
          id: 'tp-12:out',
          kind: 'control',
          x: 170.10536493824844,
          y: 119.07041481724248,
          controlForId: 'tp-12',
          controlRole: 'out'
        },
        'tp-13:in': {
          id: 'tp-13:in',
          kind: 'control',
          x: -42.09205809548172,
          y: 343.2841182453731,
          controlForId: 'tp-13',
          controlRole: 'in'
        },
        'tp-13:out': {
          id: 'tp-13:out',
          kind: 'control',
          x: 78.17096503446606,
          y: 390.18669726605293,
          controlForId: 'tp-13',
          controlRole: 'out'
        },
        'tp-14': {
          id: 'tp-14',
          kind: 'anchor',
          x: 360.120941483566,
          y: 144.31562775593738,
          anchorType: 'sharp'
        },
        'tp-15': {
          id: 'tp-15',
          kind: 'anchor',
          x: 0,
          y: 14.030686031827244,
          anchorType: 'sharp'
        },
        'tp-16': {
          id: 'tp-16',
          kind: 'anchor',
          x: 270.59180204238254,
          y: 345.42212754546125,
          anchorType: 'smooth'
        },
        'tp-15:out': {
          id: 'tp-15:out',
          kind: 'control',
          x: 0,
          y: 14.030686031827244,
          controlForId: 'tp-15',
          controlRole: 'out'
        },
        'tp-16:in': {
          id: 'tp-16:in',
          kind: 'control',
          x: 263.9105229796076,
          y: 362.79345310867603,
          controlForId: 'tp-16',
          controlRole: 'in'
        },
        'tp-16:out': {
          id: 'tp-16:out',
          kind: 'control',
          x: 277.2730811051575,
          y: 328.05080198224647,
          controlForId: 'tp-16',
          controlRole: 'out'
        }
      }
      const segments = {
        'ts-23': {
          id: 'ts-23',
          startId: 'tp-12',
          endId: 'tp-13',
          outControlId: 'tp-12:out',
          inControlId: 'tp-13:in'
        },
        'ts-24': {
          id: 'ts-24',
          startId: 'tp-13',
          endId: 'tp-14',
          outControlId: 'tp-13:out',
          inControlId: null
        },
        'ts-25': {
          id: 'ts-25',
          startId: 'tp-14',
          endId: 'tp-15',
          outControlId: null,
          inControlId: null
        },
        'ts-26': {
          id: 'ts-26',
          startId: 'tp-15',
          endId: 'tp-16',
          outControlId: 'tp-15:out',
          inControlId: 'tp-16:in'
        },
        'ts-27': {
          id: 'ts-27',
          startId: 'tp-16',
          endId: 'tp-12',
          outControlId: 'tp-16:out',
          inControlId: null
        }
      }
      const networks = {
        'tn-4': {
          id: 'tn-4',
          pointIds: ['tp-12', 'tp-13', 'tp-14', 'tp-15', 'tp-16'],
          segmentIds: ['ts-23', 'ts-24', 'ts-25', 'ts-26', 'ts-27'],
          closed: true
        }
      }
      const createdId = elementApis?.createElement?.(
        { type: 'vector', points, segments, networks, closed: true },
        { undoable: false }
      )
      if (!createdId) {
        throw new Error('Failed to create reported vector-6 fixture')
      }
      elementApis?.changeComputedData?.(
        [createdId],
        {
          x: 220,
          y: 159,
          width: 360.120941483566,
          height: 366.06359840210007,
          points,
          segments,
          networks,
          closed: true,
          fills: [],
          strokes: [
            {
              id: 'reported-vector-6-solid-inside',
              kind: 'solid',
              style: 'solid',
              position: 'inside',
              width: strokeWidth,
              dashPattern: [],
              dashOffset: 0,
              fill: null,
              defaultColorFormat: 'hex',
              colorFormat: 'hex',
              color: `#${color}`,
              opacity: 0.5,
              visible: true,
              gradient: null,
              joinType: 'miter',
              capType: 'butt',
              miterAngle: 28.96
            }
          ]
        },
        { undoable: false }
      )
      core?.selectElements?.([createdId], { undoable: false })
      core?.setSystemProperty?.('pathEditingVectorId', null)
      core?.setSystemProperty?.('pathEditingMode', false)
    },
    {
      color: REPORTED_VECTOR_6_PRODUCT_STROKE_COLOR,
      strokeWidth: STROKE_WIDTH
    }
  )

  await page.waitForTimeout(1200)
}

const getSelectedSolidStrokeRenderPacketSummary = async (page: Page) =>
  page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const selectedId =
      core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
    const renderElement = selectedId
      ? core?.deps?.render?.getElementById?.(selectedId)
      : null
    const exportPackets =
      renderElement?.__asyraSolidCenterStrokeExportPackets ?? []
    return {
      debugDisableVisualOverlapCollapse:
        core?.getSystemProperty?.('strokeDebugDisableVisualOverlapCollapse') ===
        true,
      exportPacketCount: exportPackets.length,
      polygonCount: exportPackets.reduce(
        (sum: number, packet: { polygons?: { x: number; y: number }[][] }) =>
          sum + (packet.polygons?.length ?? 0),
        0
      ),
      pointCount: exportPackets.reduce(
        (sum: number, packet: { polygons?: { x: number; y: number }[][] }) =>
          sum +
          (packet.polygons ?? []).reduce(
            (polygonSum, polygon) => polygonSum + polygon.length,
            0
          ),
        0
      ),
      exportPacketDebugMeta: exportPackets.map(
        (packet: { debugMeta?: Record<string, unknown> }) =>
          packet.debugMeta ?? {}
      ),
      vertexSpanIds: exportPackets.flatMap(
        (packet: { debugMeta?: { sourceSpanIds?: string[] } }) =>
          packet.debugMeta?.sourceSpanIds?.filter((sourceSpanId) =>
            sourceSpanId.startsWith('vertex:')
          ) ?? []
      )
    }
  })

test.describe('Reported Vector-6 Outside Solid Switch Regression', () => {
  test('switches from inside solid to outside solid without freezing, over-fragmenting, or dropping joins', async ({
    page
  }, testInfo) => {
    await createReportedVector6InsideSolid(page)

    const propertiesPanel = getPropertiesPanel(page)
    const strokePositionSelect = propertiesPanel.getByTestId(
      'prop-stroke-position-0'
    )
    await expect(strokePositionSelect).toBeVisible()

    const switchStartedAt = Date.now()
    await strokePositionSelect.selectOption('outside')
    await page.waitForFunction(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      const selectedId =
        core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
      const renderElement = selectedId
        ? core?.deps?.render?.getElementById?.(selectedId)
        : null
      const exportPackets =
        renderElement?.__asyraSolidCenterStrokeExportPackets ?? []

      return (
        exportPackets.length > 0 &&
        exportPackets.every(
          (packet: { debugMeta?: Record<string, unknown> }) =>
            packet.debugMeta?.geometryFamily === 'constrained-solid' &&
            packet.debugMeta?.strokePosition === 'outside'
        )
      )
    })
    const switchMs = Date.now() - switchStartedAt
    const packetSummary = await getSelectedSolidStrokeRenderPacketSummary(page)

    expect(switchMs).toBeLessThan(2000)
    expect(packetSummary.debugDisableVisualOverlapCollapse).toBe(false)
    expect(packetSummary.exportPacketCount).toBeGreaterThan(0)
    expect(packetSummary.exportPacketCount).toBeLessThanOrEqual(24)
    expect(packetSummary.polygonCount).toBeLessThanOrEqual(120)
    expect(packetSummary.pointCount).toBeLessThanOrEqual(4_500)
    expect(packetSummary.vertexSpanIds).toEqual(
      expect.arrayContaining(['vertex:1', 'vertex:2', 'vertex:4'])
    )
    const sourceSpanIds = packetSummary.exportPacketDebugMeta.flatMap(
      (debugMeta) =>
        Array.isArray(debugMeta.sourceSpanIds)
          ? (debugMeta.sourceSpanIds as string[])
          : []
    )
    expect(sourceSpanIds).toContain('smooth-join:3')
    expect(sourceSpanIds).not.toContain('vertex:3')
    expect(
      sourceSpanIds.some((sourceSpanId) =>
        sourceSpanId.startsWith('segment-run:')
      )
    ).toBe(false)
    const raster = await captureSelectedElementRaster(page)
    await attachPng(
      'reported-vector-6-solid-outside-switch.png',
      raster.base64,
      testInfo
    )
    await attachPng(
      'reported-vector-6-solid-outside-tp16-zoom.png',
      await cropBase64Png(
        page,
        raster.base64,
        getRasterRectRegion(raster, { x: 242, y: 318, width: 95, height: 70 })
      ),
      testInfo
    )
    await assertRedCoverageProbes(page, raster, [
      {
        label: 'top outside miter protrusion',
        point: { x: 192.4, y: -7 },
        size: 12,
        minCoverage: 0.04
      },
      {
        label: 'left outside miter protrusion',
        point: { x: -8, y: 10 },
        size: 12,
        minCoverage: 0.04
      },
      {
        label: 'right outside miter protrusion',
        point: { x: 368, y: 144 },
        size: 12,
        minCoverage: 0.04
      },
      {
        label: 'lower-right adjacent segment join',
        point: { x: 270, y: 350 },
        size: 14,
        minCoverage: 0.04
      },
      ...getLowerRightSmoothJoinCorridorProbes()
    ])
    await assertForbiddenRedCoverageProbes(page, raster, [
      {
        label: 'lower-right continuity patch must not exist',
        point: { x: 316, y: 344 },
        size: 28,
        maxCoverage: 0.02
      },
      {
        label: 'lower-right far hollow must stay empty',
        point: { x: 326, y: 365 },
        size: 24,
        maxCoverage: 0.02
      }
    ])
    expect(
      packetSummary.exportPacketDebugMeta.every(
        (debugMeta) =>
          debugMeta.geometryFamily === 'constrained-solid' &&
          debugMeta.resolutionStatus === 'exact-constrained' &&
          debugMeta.runtimeStatus === 'accepted' &&
          debugMeta.sourceTopology === 'self-intersecting' &&
          debugMeta.strokePosition === 'outside' &&
          debugMeta.figmaLikeBoundaryRole === 'outer' &&
          debugMeta.figmaLikeTerminalRole === undefined &&
          debugMeta.figmaLikeSplitRangeTerminals === undefined
      ),
      JSON.stringify(packetSummary.exportPacketDebugMeta, null, 2)
    ).toBe(true)
    await expect(propertiesPanel).toBeVisible()
  })
})
