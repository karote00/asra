import { expect, test, type Page } from '@playwright/test'
import {
  createOval,
  createRectangle,
  createVectorPath,
  fillStrokeDashGap,
  getPropertiesPanel,
  getSelectedElementRect,
  patchSelectedStrokeDashOffset,
  resetCanvas,
  setStrokeDiagnosticsMode,
  waitForAppReady
} from './test-utils'

const PADDING = 24
const STROKE_WIDTH = 10
const STROKE_COLOR = '00FF00'
const MIN_VISIBLE_COVERAGE = 0.45
const MAX_GAP_COVERAGE = 0.12
const MAX_UNSUPPORTED_COVERAGE = 0.03
const MIN_CORNER_FILL_COVERAGE = 0.55
const MAX_CORNER_FILL_COVERAGE = 0.45
const MIN_DIAGONAL_COVERAGE = 0.3

interface SelectedElementSnapshot {
  rect: {
    x: number
    y: number
    width: number
    height: number
  }
  zoom: number
  viewport: {
    x: number
    y: number
  }
}

interface RasterCapture {
  base64: string
  width: number
  height: number
  elementWidth: number
  elementHeight: number
  strokeWidthPx: number
  padding: number
}

interface CenterDashedPacketSummary {
  intervalId: string | null
  intervalIds: string[]
  intervalTerminalRole: string | null
  visualOverlapCollapseStatus: string | null
  ribbonValidityStatus: string | null
  polygonCount: number
  maxPolygonPointCount: number
  startDistance: number
  endDistance: number
  bounds: {
    minX: number
    minY: number
    maxX: number
    maxY: number
  }
  representativePoint: {
    x: number
    y: number
  }
}

const getSelectedElementSnapshot = async (
  page: Page
): Promise<SelectedElementSnapshot> => {
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

  return {
    rect: {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height
    },
    zoom: viewportState.zoom,
    viewport: viewportState.viewport
  }
}

const captureSelectedElementRaster = async (
  page: Page,
  strokeWidth: number,
  padding = PADDING
): Promise<RasterCapture> => {
  const snapshot = await getSelectedElementSnapshot(page)
  const clip = {
    x: Math.max(
      0,
      Math.floor(
        snapshot.rect.x * snapshot.zoom + snapshot.viewport.x - padding
      )
    ),
    y: Math.max(
      0,
      Math.floor(
        snapshot.rect.y * snapshot.zoom + snapshot.viewport.y - padding
      )
    ),
    width: Math.max(
      1,
      Math.ceil(snapshot.rect.width * snapshot.zoom + padding * 2)
    ),
    height: Math.max(
      1,
      Math.ceil(snapshot.rect.height * snapshot.zoom + padding * 2)
    )
  }
  const screenshot = await page.screenshot({ clip })

  return {
    base64: screenshot.toString('base64'),
    width: clip.width,
    height: clip.height,
    elementWidth: Math.ceil(snapshot.rect.width * snapshot.zoom),
    elementHeight: Math.ceil(snapshot.rect.height * snapshot.zoom),
    strokeWidthPx: Math.max(1, Math.round(strokeWidth * snapshot.zoom)),
    padding
  }
}

const targetRegion = (
  region: { x: number; y: number; width: number; height: number },
  raster: RasterCapture
) => ({
  x: Math.max(0, region.x),
  y: Math.max(0, region.y),
  width: Math.min(region.width, raster.width - region.x),
  height: Math.min(region.height, raster.height - region.y)
})

const getGreenCoverage = async (
  page: Page,
  raster: RasterCapture,
  region: { x: number; y: number; width: number; height: number }
) =>
  page.evaluate(
    async ({
      base64,
      region: target
    }: {
      base64: string
      region: { x: number; y: number; width: number; height: number }
    }) => {
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
      const startX = Math.max(0, Math.floor(target.x))
      const startY = Math.max(0, Math.floor(target.y))
      const endX = Math.min(canvas.width, Math.ceil(target.x + target.width))
      const endY = Math.min(canvas.height, Math.ceil(target.y + target.height))

      let total = 0
      let green = 0
      for (let y = startY; y < endY; y += 1) {
        for (let x = startX; x < endX; x += 1) {
          const [r, g, b, a] = context.getImageData(x, y, 1, 1).data
          total += 1
          if (
            a > 180 &&
            g > 170 &&
            r < 120 &&
            b < 120 &&
            g - r > 70 &&
            g - b > 70
          ) {
            green += 1
          }
        }
      }

      return total > 0 ? green / total : 0
    },
    {
      base64: raster.base64,
      region: targetRegion(region, raster)
    }
  )

const ensureStrokeRow = async (page: Page) => {
  const propertiesPanel = getPropertiesPanel(page)
  if (await propertiesPanel.getByTestId('prop-strokes-empty').isVisible()) {
    await propertiesPanel.getByTestId('prop-stroke-add').click()
  }

  await expect(propertiesPanel.getByTestId('prop-stroke-0')).toBeVisible()
}

const setSelectedElementSize = async (
  page: Page,
  size: { width: number; height: number }
) => {
  const propertiesPanel = getPropertiesPanel(page)
  await propertiesPanel.getByTestId('prop-width').fill(String(size.width))
  await propertiesPanel.getByTestId('prop-width').press('Enter')
  await propertiesPanel.getByTestId('prop-height').fill(String(size.height))
  await propertiesPanel.getByTestId('prop-height').press('Enter')
  await page.waitForTimeout(180)
}

const ensureElementSelected = async (
  page: Page,
  expectedType?: 'rect' | 'oval' | 'vector'
) => {
  await page.waitForFunction(
    ({ expectedType }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      const elements = core?.deps?.sceneTree?.getAllElements?.()
      if (!(elements instanceof Map) || elements.size === 0) {
        return false
      }

      if (!expectedType) {
        return Array.from(elements.keys()).some((id) => id !== 'workspace')
      }

      return Array.from(elements.entries()).some(([id, element]) => {
        if (id === 'workspace') {
          return false
        }

        const computed = element?.getAllComputedData?.() ?? {}
        const elementType =
          computed.type ?? element?.type ?? element?.getType?.() ?? null

        return elementType === expectedType
      })
    },
    { expectedType },
    { timeout: 2000 }
  )

  await page.evaluate(
    ({ expectedType }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      const selectedIds =
        core?.deps?.selection?.getElementSelectionIds?.() ?? []
      if (selectedIds.length > 0) {
        if (!expectedType) {
          return
        }

        const selectedElement = core?.deps?.sceneTree?.getElementById?.(
          selectedIds[0]
        )
        const selectedComputed = selectedElement?.getAllComputedData?.() ?? {}
        const selectedType =
          selectedComputed.type ??
          selectedElement?.type ??
          selectedElement?.getType?.() ??
          null

        if (selectedType === expectedType) {
          return
        }
      }

      const elements = core?.deps?.sceneTree?.getAllElements?.()
      if (!(elements instanceof Map) || elements.size === 0) {
        throw new Error('No element available to select')
      }

      const ordered = Array.from(elements.entries()).reverse()
      const targetEntry = ordered.find(([id, element]) => {
        if (id === 'workspace') {
          return false
        }

        if (!expectedType) {
          return true
        }

        const computed = element?.getAllComputedData?.() ?? {}
        const elementType =
          computed.type ?? element?.type ?? element?.getType?.() ?? null

        return expectedType ? elementType === expectedType : true
      })

      const targetId = targetEntry?.[0] ?? null
      if (!targetId) {
        throw new Error(
          expectedType
            ? `No element available to select for type ${expectedType}`
            : 'No element available to select'
        )
      }

      core?.selectElements?.([targetId], { undoable: false })
    },
    { expectedType }
  )

  await page.waitForTimeout(150)
  await expect(
    getPropertiesPanel(page).getByTestId('prop-strokes-section')
  ).toBeVisible()
}

const configureDashedCenterStroke = async (
  page: Page,
  config: {
    join?: 'miter' | 'bevel' | 'round'
    cap?: 'butt' | 'square' | 'round'
    pattern?: string
    offset?: string
    width?: number
  }
) => {
  await ensureElementSelected(page)
  const propertiesPanel = getPropertiesPanel(page)
  await ensureStrokeRow(page)

  await propertiesPanel
    .getByTestId('prop-stroke-style-0')
    .selectOption('dashed')
  await propertiesPanel
    .getByTestId('prop-stroke-position-0')
    .selectOption('center')
  await propertiesPanel
    .getByTestId('prop-stroke-join-0')
    .selectOption(config.join ?? 'miter')
  await propertiesPanel
    .getByTestId('prop-stroke-cap-0')
    .selectOption(config.cap ?? 'butt')
  await propertiesPanel
    .getByTestId('prop-stroke-width-0')
    .fill(String(config.width ?? STROKE_WIDTH))
  await propertiesPanel.getByTestId('prop-stroke-width-0').press('Enter')
  await fillStrokeDashGap(propertiesPanel, 0, config.pattern ?? '20, 20')
  if (Number(config.offset ?? '0') !== 0) {
    await patchSelectedStrokeDashOffset(page, 0, config.offset ?? '0')
  }
  await propertiesPanel.getByTestId('prop-stroke-color-0').fill(STROKE_COLOR)
  await propertiesPanel.getByTestId('prop-stroke-color-0').press('Enter')
  await page.waitForTimeout(180)
}

const getTopProbe = (raster: RasterCapture, ratio: number) => {
  const half = Math.round(raster.strokeWidthPx / 2)
  const x = raster.padding + raster.elementWidth * ratio - 3
  const y = raster.padding - half + 1
  return {
    x,
    y,
    width: 6,
    height: Math.max(2, raster.strokeWidthPx - 2)
  }
}

const getLocalPointProbe = (
  raster: RasterCapture,
  point: { x: number; y: number },
  size = 3
) => ({
  x: raster.padding + point.x - 1,
  y: raster.padding + point.y - 1,
  width: size,
  height: size
})

const getTopRightCornerTurnProbes = (raster: RasterCapture) => {
  const probeSize = 3
  const pointProbe = (x: number, y: number) => ({
    x: x - 1,
    y: y - 1,
    width: probeSize,
    height: probeSize
  })
  const cornerX = raster.padding + raster.elementWidth
  const cornerY = raster.padding

  return {
    miterCornerFill: pointProbe(cornerX + 3, cornerY - 3),
    bevelDiagonal: pointProbe(cornerX + 1, cornerY - 3),
    bevelCut: pointProbe(cornerX + 4, cornerY - 2)
  }
}

const patchSelectedVectorToClosedOrthogonalPath = async (
  page: Page,
  size: { width: number; height: number }
) => {
  await page.evaluate((size) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const selectedId = core?.deps?.selection?.getElementSelectionIds?.()?.[0]
    if (!selectedId) {
      throw new Error('No selected vector to patch')
    }

    const element = core?.deps?.sceneTree?.getElementById?.(selectedId)
    const computed = element?.getAllComputedData?.()
    const primaryNetwork = Object.values(computed?.networks ?? {})[0] as
      | { id: string }
      | undefined

    if (!computed || !primaryNetwork) {
      throw new Error('Missing vector topology')
    }

    const width = size.width
    const height = size.height

    const nextPoints = {
      a: { id: 'a', kind: 'anchor', x: 0, y: 0, anchorType: 'sharp' },
      b: { id: 'b', kind: 'anchor', x: width, y: 0, anchorType: 'sharp' },
      c: { id: 'c', kind: 'anchor', x: width, y: height, anchorType: 'sharp' },
      d: { id: 'd', kind: 'anchor', x: 0, y: height, anchorType: 'sharp' }
    }

    const nextSegments = {
      ab: {
        id: 'ab',
        startId: 'a',
        endId: 'b',
        outControlId: null,
        inControlId: null
      },
      bc: {
        id: 'bc',
        startId: 'b',
        endId: 'c',
        outControlId: null,
        inControlId: null
      },
      cd: {
        id: 'cd',
        startId: 'c',
        endId: 'd',
        outControlId: null,
        inControlId: null
      },
      da: {
        id: 'da',
        startId: 'd',
        endId: 'a',
        outControlId: null,
        inControlId: null
      }
    }

    core?.changeComputedData?.(
      [selectedId],
      {
        points: nextPoints,
        segments: nextSegments,
        networks: {
          [primaryNetwork.id]: {
            id: primaryNetwork.id,
            pointIds: ['a', 'b', 'c', 'd'],
            segmentIds: ['ab', 'bc', 'cd', 'da'],
            closed: true
          }
        },
        closed: true,
        width,
        height
      },
      { undoable: false }
    )
  }, size)

  await page.waitForTimeout(180)
}

const patchSelectedVectorToClosedRectangle = async (page: Page) =>
  patchSelectedVectorToClosedOrthogonalPath(page, { width: 80, height: 40 })

const patchSelectedVectorToOpenHorizontalLine = async (page: Page) => {
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const selectedId = core?.deps?.selection?.getElementSelectionIds?.()?.[0]
    if (!selectedId) {
      throw new Error('No selected vector to patch')
    }

    const element = core?.deps?.sceneTree?.getElementById?.(selectedId)
    const computed = element?.getAllComputedData?.()
    const primaryNetwork = Object.values(computed?.networks ?? {})[0] as
      | { id: string }
      | undefined

    if (!computed || !primaryNetwork) {
      throw new Error('Missing vector topology')
    }

    const nextPoints = {
      a: { id: 'a', kind: 'anchor', x: 0, y: 0, anchorType: 'sharp' },
      b: { id: 'b', kind: 'anchor', x: 120, y: 0, anchorType: 'sharp' }
    }

    const nextSegments = {
      ab: {
        id: 'ab',
        startId: 'a',
        endId: 'b',
        outControlId: null,
        inControlId: null
      }
    }

    core?.changeComputedData?.(
      [selectedId],
      {
        points: nextPoints,
        segments: nextSegments,
        networks: {
          [primaryNetwork.id]: {
            id: primaryNetwork.id,
            pointIds: ['a', 'b'],
            segmentIds: ['ab'],
            closed: false
          }
        },
        closed: false,
        width: 120,
        height: 0
      },
      { undoable: false }
    )
  })

  await page.waitForTimeout(180)
}

const patchSelectedVectorToOpenAcuteTurn = async (page: Page) => {
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const selectedId = core?.deps?.selection?.getElementSelectionIds?.()?.[0]
    if (!selectedId) {
      throw new Error('No selected vector to patch')
    }

    const element = core?.deps?.sceneTree?.getElementById?.(selectedId)
    const computed = element?.getAllComputedData?.()
    const primaryNetwork = Object.values(computed?.networks ?? {})[0] as
      | { id: string }
      | undefined

    if (!computed || !primaryNetwork) {
      throw new Error('Missing vector topology')
    }

    const nextPoints = {
      a: { id: 'a', kind: 'anchor', x: 0, y: 0, anchorType: 'sharp' },
      b: { id: 'b', kind: 'anchor', x: 30, y: 0, anchorType: 'sharp' },
      c: {
        id: 'c',
        kind: 'anchor',
        x: 15,
        y: 25.980762,
        anchorType: 'sharp'
      }
    }

    const nextSegments = {
      ab: {
        id: 'ab',
        startId: 'a',
        endId: 'b',
        outControlId: null,
        inControlId: null
      },
      bc: {
        id: 'bc',
        startId: 'b',
        endId: 'c',
        outControlId: null,
        inControlId: null
      }
    }

    core?.changeComputedData?.(
      [selectedId],
      {
        points: nextPoints,
        segments: nextSegments,
        networks: {
          [primaryNetwork.id]: {
            id: primaryNetwork.id,
            pointIds: ['a', 'b', 'c'],
            segmentIds: ['ab', 'bc'],
            closed: false
          }
        },
        closed: false,
        width: 30,
        height: 25.980762
      },
      { undoable: false }
    )
  })

  await page.waitForTimeout(180)
}

const patchSelectedVectorToOpenHighCurvatureSelfCrossingPath = async (
  page: Page
) => {
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const selectedId = core?.deps?.selection?.getElementSelectionIds?.()?.[0]
    if (!selectedId) {
      throw new Error('No selected vector to patch')
    }

    const element = core?.deps?.sceneTree?.getElementById?.(selectedId)
    const computed = element?.getAllComputedData?.()
    const primaryNetwork = Object.values(computed?.networks ?? {})[0] as
      | { id: string }
      | undefined

    if (!computed || !primaryNetwork) {
      throw new Error('Missing vector topology')
    }

    const nextPoints = {
      a: { id: 'a', kind: 'anchor', x: 116, y: 0, anchorType: 'smooth' },
      aOut: {
        id: 'aOut',
        kind: 'control',
        x: 80,
        y: 104,
        controlRole: 'out'
      },
      b: { id: 'b', kind: 'anchor', x: 18, y: 214, anchorType: 'smooth' },
      bIn: {
        id: 'bIn',
        kind: 'control',
        x: -24,
        y: 160,
        controlRole: 'in'
      },
      bOut: {
        id: 'bOut',
        kind: 'control',
        x: 96,
        y: 258,
        controlRole: 'out'
      },
      c: { id: 'c', kind: 'anchor', x: 222, y: 138, anchorType: 'sharp' },
      d: { id: 'd', kind: 'anchor', x: 0, y: 96, anchorType: 'sharp' },
      dOut: {
        id: 'dOut',
        kind: 'control',
        x: 72,
        y: 210,
        controlRole: 'out'
      },
      e: { id: 'e', kind: 'anchor', x: 176, y: 336, anchorType: 'smooth' },
      eIn: {
        id: 'eIn',
        kind: 'control',
        x: 228,
        y: 296,
        controlRole: 'in'
      }
    }

    const nextSegments = {
      ab: {
        id: 'ab',
        startId: 'a',
        endId: 'b',
        outControlId: 'aOut',
        inControlId: 'bIn'
      },
      bc: {
        id: 'bc',
        startId: 'b',
        endId: 'c',
        outControlId: 'bOut',
        inControlId: null
      },
      cd: {
        id: 'cd',
        startId: 'c',
        endId: 'd',
        outControlId: null,
        inControlId: null
      },
      de: {
        id: 'de',
        startId: 'd',
        endId: 'e',
        outControlId: 'dOut',
        inControlId: 'eIn'
      }
    }

    core?.changeComputedData?.(
      [selectedId],
      {
        points: nextPoints,
        segments: nextSegments,
        networks: {
          [primaryNetwork.id]: {
            id: primaryNetwork.id,
            pointIds: ['a', 'b', 'c', 'd', 'e'],
            segmentIds: ['ab', 'bc', 'cd', 'de'],
            closed: false
          }
        },
        closed: false,
        width: 222,
        height: 336
      },
      { undoable: false }
    )
  })

  await page.waitForTimeout(240)
}

const getSelectedCenterDashedPacketSummary = async (
  page: Page
): Promise<CenterDashedPacketSummary[]> =>
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

    return exportPackets
      .filter(
        (packet: { debugMeta?: { geometryFamily?: string } }) =>
          packet.debugMeta?.geometryFamily === 'dashed-center'
      )
      .map(
        (packet: {
          debugMeta?: {
            intervalId?: string
            intervalIds?: string[]
            intervalTerminalRole?: string
            visualOverlapCollapseStatus?: string
            ribbonValidityStatus?: string
            startDistance?: number
            endDistance?: number
          }
          bounds: {
            minX: number
            minY: number
            maxX: number
            maxY: number
          }
          polygons?: { x: number; y: number }[][]
        }) => {
          const polygon = packet.polygons?.[0] ?? []
          const representativePoint =
            polygon.length > 0
              ? polygon.reduce(
                  (sum, point) => ({
                    x: sum.x + point.x / polygon.length,
                    y: sum.y + point.y / polygon.length
                  }),
                  { x: 0, y: 0 }
                )
              : {
                  x: (packet.bounds.minX + packet.bounds.maxX) / 2,
                  y: (packet.bounds.minY + packet.bounds.maxY) / 2
                }

          return {
            intervalId: packet.debugMeta?.intervalId ?? null,
            intervalIds: packet.debugMeta?.intervalIds ?? [],
            intervalTerminalRole:
              packet.debugMeta?.intervalTerminalRole ?? null,
            visualOverlapCollapseStatus:
              packet.debugMeta?.visualOverlapCollapseStatus ?? null,
            ribbonValidityStatus:
              packet.debugMeta?.ribbonValidityStatus ?? null,
            polygonCount: packet.polygons?.length ?? 0,
            maxPolygonPointCount: Math.max(
              0,
              ...(packet.polygons ?? []).map((polygon) => polygon.length)
            ),
            startDistance: packet.debugMeta?.startDistance ?? 0,
            endDistance: packet.debugMeta?.endDistance ?? 0,
            bounds: packet.bounds,
            representativePoint
          }
        }
      )
      .sort(
        (
          left: { startDistance: number; intervalId: string | null },
          right: { startDistance: number; intervalId: string | null }
        ) =>
          left.startDistance - right.startDistance ||
          String(left.intervalId).localeCompare(String(right.intervalId))
      )
  })

const clearVectorOverlayState = async (page: Page) => {
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    core?.setSystemProperty?.('selectedVectorPoint', null)
    core?.setSystemProperty?.('pathEditingVectorId', null)
    core?.setSystemProperty?.('pathEditingMode', false)
  })

  await page.waitForTimeout(120)
}

test.describe('Dashed Center Stroke Visual Benchmarks', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await resetCanvas(page)
    await setStrokeDiagnosticsMode(page, 'full')
  })

  test('benchmark: rectangle center dashed stroke preserves authored visible and gap probes', async ({
    page
  }) => {
    await createRectangle(page, 0.3, 0.3)
    await configureDashedCenterStroke(page, { pattern: '20, 20', offset: '0' })

    const raster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const visibleA = await getGreenCoverage(
      page,
      raster,
      getTopProbe(raster, 0.1)
    )
    const gapA = await getGreenCoverage(page, raster, getTopProbe(raster, 0.3))
    const visibleB = await getGreenCoverage(
      page,
      raster,
      getTopProbe(raster, 0.5)
    )
    const gapB = await getGreenCoverage(page, raster, getTopProbe(raster, 0.7))

    expect(visibleA).toBeGreaterThan(MIN_VISIBLE_COVERAGE)
    expect(gapA).toBeLessThan(MAX_GAP_COVERAGE)
    expect(visibleB).toBeGreaterThan(MIN_VISIBLE_COVERAGE)
    expect(gapB).toBeLessThan(MAX_GAP_COVERAGE)
  })

  test('benchmark: rectangle center dashed offset shifts the visible probes deterministically', async ({
    page
  }) => {
    await createRectangle(page, 0.3, 0.3)
    await configureDashedCenterStroke(page, { pattern: '20, 20', offset: '10' })

    const raster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const visibleHead = await getGreenCoverage(
      page,
      raster,
      getTopProbe(raster, 0.05)
    )
    const shiftedGap = await getGreenCoverage(
      page,
      raster,
      getTopProbe(raster, 0.2)
    )
    const shiftedVisible = await getGreenCoverage(
      page,
      raster,
      getTopProbe(raster, 0.4)
    )

    expect(visibleHead).toBeGreaterThan(MIN_VISIBLE_COVERAGE)
    expect(shiftedGap).toBeLessThan(MAX_GAP_COVERAGE)
    expect(shiftedVisible).toBeGreaterThan(MIN_VISIBLE_COVERAGE)
  })

  test('benchmark: oval center dashed stroke renders through the supported path', async ({
    page
  }) => {
    await createOval(page, 0.35, 0.35)
    await configureDashedCenterStroke(page, { pattern: '400, 20', offset: '0' })

    const raster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const topCenterCoverage = await getGreenCoverage(
      page,
      raster,
      getTopProbe(raster, 0.5)
    )

    expect(topCenterCoverage).toBeGreaterThan(MIN_VISIBLE_COVERAGE)
  })

  test('benchmark: rectangle center dashed miter keeps a filled outer corner square when one visible dash spans the top-right turn', async ({
    page
  }) => {
    await createRectangle(page, 0.3, 0.3)
    await setSelectedElementSize(page, { width: 80, height: 40 })
    await configureDashedCenterStroke(page, {
      join: 'miter',
      pattern: '87, 20',
      offset: '0'
    })

    const raster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const probes = getTopRightCornerTurnProbes(raster)
    const cornerCoverage = await getGreenCoverage(
      page,
      raster,
      probes.miterCornerFill
    )

    expect(cornerCoverage).toBeGreaterThan(MIN_CORNER_FILL_COVERAGE)
  })

  test('benchmark: rectangle center dashed bevel cuts the outer corner square while preserving diagonal coverage at the top-right turn', async ({
    page
  }) => {
    await createRectangle(page, 0.3, 0.3)
    await setSelectedElementSize(page, { width: 80, height: 40 })
    await configureDashedCenterStroke(page, {
      join: 'bevel',
      pattern: '87, 20',
      offset: '0'
    })

    const raster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const probes = getTopRightCornerTurnProbes(raster)
    const cornerCoverage = await getGreenCoverage(page, raster, probes.bevelCut)
    const diagonalCoverage = await getGreenCoverage(
      page,
      raster,
      probes.bevelDiagonal
    )

    expect(cornerCoverage).toBeLessThan(MAX_CORNER_FILL_COVERAGE)
    expect(diagonalCoverage).toBeGreaterThan(MIN_DIAGONAL_COVERAGE)
  })

  test('benchmark: closed vector center dashed stroke renders through the supported path', async ({
    page
  }) => {
    await createVectorPath(page, 0.3, 0.3, 0.1, 0.1)
    await clearVectorOverlayState(page)
    await ensureElementSelected(page)
    await patchSelectedVectorToClosedRectangle(page)
    await configureDashedCenterStroke(page, {
      pattern: '20, 20',
      offset: '0'
    })

    const raster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const visibleA = await getGreenCoverage(
      page,
      raster,
      getTopProbe(raster, 0.1)
    )
    const gapA = await getGreenCoverage(page, raster, getTopProbe(raster, 0.3))

    expect(visibleA).toBeGreaterThan(MIN_VISIBLE_COVERAGE)
    expect(gapA).toBeLessThan(MAX_GAP_COVERAGE)
  })

  test('benchmark: closed vector center dashed bevel keeps the top-right turn diagonal instead of a step', async ({
    page
  }) => {
    await createVectorPath(page, 0.3, 0.3, 0.1, 0.1)
    await clearVectorOverlayState(page)
    await ensureElementSelected(page)
    await patchSelectedVectorToClosedRectangle(page)
    await configureDashedCenterStroke(page, {
      join: 'bevel',
      pattern: '87, 20',
      offset: '0'
    })

    const raster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const probes = getTopRightCornerTurnProbes(raster)
    const cornerCoverage = await getGreenCoverage(page, raster, probes.bevelCut)
    const diagonalCoverage = await getGreenCoverage(
      page,
      raster,
      probes.bevelDiagonal
    )

    expect(cornerCoverage).toBeLessThan(MAX_CORNER_FILL_COVERAGE)
    expect(diagonalCoverage).toBeGreaterThan(MIN_DIAGONAL_COVERAGE)
  })

  test('benchmark: one closed orthogonal shape path keeps each corner consistent with its interval relation', async ({
    page
  }) => {
    await createRectangle(page, 0.3, 0.3)
    await setSelectedElementSize(page, { width: 350, height: 280 })
    await configureDashedCenterStroke(page, {
      join: 'miter',
      pattern: '27, 20',
      offset: '0'
    })

    const raster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const topRightCoverage = await getGreenCoverage(
      page,
      raster,
      getLocalPointProbe(raster, { x: 353, y: 3 })
    )
    const bottomRightCoverage = await getGreenCoverage(
      page,
      raster,
      getLocalPointProbe(raster, { x: 347, y: 278 })
    )
    const bottomLeftCoverage = await getGreenCoverage(
      page,
      raster,
      getLocalPointProbe(raster, { x: 3, y: 278 })
    )
    const topLeftCoverage = await getGreenCoverage(
      page,
      raster,
      getLocalPointProbe(raster, { x: 3, y: 3 })
    )

    expect(topRightCoverage).toBeGreaterThan(MIN_VISIBLE_COVERAGE)
    expect(bottomRightCoverage).toBeGreaterThan(MIN_VISIBLE_COVERAGE)
    expect(bottomLeftCoverage).toBeLessThan(MAX_GAP_COVERAGE)
    expect(topLeftCoverage).toBeGreaterThan(MIN_VISIBLE_COVERAGE)
  })

  test('benchmark: one closed orthogonal vector path follows the same per-corner interval semantics as the shape-generated path', async ({
    page
  }) => {
    await createVectorPath(page, 0.3, 0.3, 0.1, 0.1)
    await clearVectorOverlayState(page)
    await ensureElementSelected(page)
    await patchSelectedVectorToClosedOrthogonalPath(page, {
      width: 350,
      height: 280
    })
    await configureDashedCenterStroke(page, {
      join: 'miter',
      pattern: '27, 20',
      offset: '0'
    })

    const raster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const topRightCoverage = await getGreenCoverage(
      page,
      raster,
      getLocalPointProbe(raster, { x: 353, y: 3 })
    )
    const bottomRightCoverage = await getGreenCoverage(
      page,
      raster,
      getLocalPointProbe(raster, { x: 347, y: 278 })
    )
    const bottomLeftCoverage = await getGreenCoverage(
      page,
      raster,
      getLocalPointProbe(raster, { x: 3, y: 278 })
    )
    const topLeftCoverage = await getGreenCoverage(
      page,
      raster,
      getLocalPointProbe(raster, { x: 3, y: 3 })
    )

    expect(topRightCoverage).toBeGreaterThan(MIN_VISIBLE_COVERAGE)
    expect(bottomRightCoverage).toBeGreaterThan(MIN_VISIBLE_COVERAGE)
    expect(bottomLeftCoverage).toBeLessThan(MAX_GAP_COVERAGE)
    expect(topLeftCoverage).toBeGreaterThan(MIN_VISIBLE_COVERAGE)
  })

  test('benchmark: one closed orthogonal shape path keeps the top-right short-carryover miter turn corridor filled', async ({
    page
  }) => {
    await waitForAppReady(page)
    await resetCanvas(page)
    await createRectangle(page, 0.3, 0.3)
    await setSelectedElementSize(page, { width: 353, height: 277 })
    await configureDashedCenterStroke(page, {
      join: 'miter',
      pattern: '27, 20',
      offset: '0'
    })

    const raster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const topRightShortCarryoverCoverage = await getGreenCoverage(
      page,
      raster,
      getLocalPointProbe(raster, { x: 349, y: 4 }, 4)
    )
    const topRightOuterMiterCoverage = await getGreenCoverage(
      page,
      raster,
      getLocalPointProbe(raster, { x: 356, y: -2 }, 3)
    )

    expect(topRightShortCarryoverCoverage).toBeGreaterThan(MIN_VISIBLE_COVERAGE)
    expect(topRightOuterMiterCoverage).toBeGreaterThan(MIN_VISIBLE_COVERAGE)
  })

  test('benchmark: one closed orthogonal vector path keeps the top-right short-carryover miter turn corridor filled', async ({
    page
  }) => {
    await waitForAppReady(page)
    await resetCanvas(page)
    await createVectorPath(page, 0.3, 0.3, 0.1, 0.1)
    await clearVectorOverlayState(page)
    await ensureElementSelected(page)
    await patchSelectedVectorToClosedOrthogonalPath(page, {
      width: 353,
      height: 277
    })
    await configureDashedCenterStroke(page, {
      join: 'miter',
      pattern: '27, 20',
      offset: '0'
    })

    const raster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const topRightShortCarryoverCoverage = await getGreenCoverage(
      page,
      raster,
      getLocalPointProbe(raster, { x: 349, y: 4 }, 4)
    )
    const topRightOuterMiterCoverage = await getGreenCoverage(
      page,
      raster,
      getLocalPointProbe(raster, { x: 356, y: -2 }, 3)
    )

    expect(topRightShortCarryoverCoverage).toBeGreaterThan(MIN_VISIBLE_COVERAGE)
    expect(topRightOuterMiterCoverage).toBeGreaterThan(MIN_VISIBLE_COVERAGE)
  })

  test('benchmark: short post-turn dash segment produces correct miter geometry with proportionally sized body band on a shape-generated path', async ({
    page
  }) => {
    await waitForAppReady(page)
    await resetCanvas(page)
    await createRectangle(page, 0.3, 0.3)
    await setSelectedElementSize(page, { width: 353.09, height: 276.59 })
    await configureDashedCenterStroke(page, {
      join: 'miter',
      pattern: '27, 20',
      offset: '0'
    })

    const raster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const topRightMiterCoverage = await getGreenCoverage(
      page,
      raster,
      getLocalPointProbe(raster, { x: 356, y: -2 }, 3)
    )
    const topRightBodyEndCoverage = await getGreenCoverage(
      page,
      raster,
      getLocalPointProbe(raster, { x: 356, y: 4 }, 3)
    )
    const bottomRightBodyCoverage = await getGreenCoverage(
      page,
      raster,
      getLocalPointProbe(raster, { x: 356, y: 274 }, 3)
    )

    // Miter triangle IS present at the outer corner
    expect(topRightMiterCoverage).toBeGreaterThan(MIN_VISIBLE_COVERAGE)
    // Body band correctly ends where the short post-turn dash ends (~2.91px)
    expect(topRightBodyEndCoverage).toBeLessThan(MAX_GAP_COVERAGE)
    // Bottom-right with longer post-turn (~8.32px) remains filled
    expect(bottomRightBodyCoverage).toBeGreaterThan(MIN_VISIBLE_COVERAGE)
  })

  test('benchmark: short post-turn dash segment produces correct miter geometry with proportionally sized body band on a vector-generated path', async ({
    page
  }) => {
    await waitForAppReady(page)
    await resetCanvas(page)
    await createVectorPath(page, 0.3, 0.3, 0.1, 0.1)
    await clearVectorOverlayState(page)
    await ensureElementSelected(page)
    await patchSelectedVectorToClosedOrthogonalPath(page, {
      width: 353.09,
      height: 276.59
    })
    await configureDashedCenterStroke(page, {
      join: 'miter',
      pattern: '27, 20',
      offset: '0'
    })

    const raster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const topRightMiterCoverage = await getGreenCoverage(
      page,
      raster,
      getLocalPointProbe(raster, { x: 356, y: -2 }, 3)
    )
    const topRightBodyEndCoverage = await getGreenCoverage(
      page,
      raster,
      getLocalPointProbe(raster, { x: 356, y: 4 }, 3)
    )
    const bottomRightBodyCoverage = await getGreenCoverage(
      page,
      raster,
      getLocalPointProbe(raster, { x: 356, y: 274 }, 3)
    )

    // Miter triangle IS present at the outer corner
    expect(topRightMiterCoverage).toBeGreaterThan(MIN_VISIBLE_COVERAGE)
    // Body band correctly ends where the short post-turn dash ends (~2.91px)
    expect(topRightBodyEndCoverage).toBeLessThan(MAX_GAP_COVERAGE)
    // Bottom-right with longer post-turn (~8.32px) remains filled
    expect(bottomRightBodyCoverage).toBeGreaterThan(MIN_VISIBLE_COVERAGE)
  })

  test('benchmark: open vector center dashed stroke renders the supported slice without constrained substitute geometry', async ({
    page
  }) => {
    await createVectorPath(page, 0.3, 0.3, 0.1, 0.1)
    await clearVectorOverlayState(page)
    await ensureElementSelected(page)
    await patchSelectedVectorToOpenHorizontalLine(page)
    await configureDashedCenterStroke(page, {
      pattern: '20, 20',
      offset: '0'
    })

    const raster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const visibleA = await getGreenCoverage(page, raster, {
      x: raster.padding + raster.elementWidth * 0.1,
      y: raster.padding - raster.strokeWidthPx / 2 + 1,
      width: 8,
      height: raster.strokeWidthPx
    })
    const gapA = await getGreenCoverage(page, raster, {
      x: raster.padding + raster.elementWidth * 0.25,
      y: raster.padding - raster.strokeWidthPx / 2 + 1,
      width: 6,
      height: raster.strokeWidthPx
    })

    expect(visibleA).toBeGreaterThan(MIN_VISIBLE_COVERAGE)
    expect(gapA).toBeLessThan(MAX_GAP_COVERAGE)
  })

  test('benchmark: open self-crossing high-curvature center dashed keeps end intervals visible without cross-interval collapse', async ({
    page
  }) => {
    await createVectorPath(page, 0.3, 0.3, 0.1, 0.1)
    await clearVectorOverlayState(page)
    await ensureElementSelected(page)
    await patchSelectedVectorToOpenHighCurvatureSelfCrossingPath(page)
    await configureDashedCenterStroke(page, {
      join: 'miter',
      cap: 'round',
      pattern: '27, 20',
      offset: '0'
    })

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
      return exportPackets.some(
        (packet: { debugMeta?: { geometryFamily?: string } }) =>
          packet.debugMeta?.geometryFamily === 'dashed-center'
      )
    })

    const packets = await getSelectedCenterDashedPacketSummary(page)
    const intervalIds = packets.map((packet) => packet.intervalId)
    const endPackets = packets.slice(-2)

    expect(packets.length).toBeGreaterThanOrEqual(6)
    expect(new Set(intervalIds).size).toBe(intervalIds.length)
    expect(
      packets.filter((packet) => packet.visualOverlapCollapseStatus !== null)
    ).toEqual([])
    expect(packets.every((packet) => packet.polygonCount >= 1)).toBe(true)
    expect(packets.every((packet) => packet.polygonCount <= 3)).toBe(true)
    expect(
      packets.filter(
        (packet) => packet.ribbonValidityStatus !== 'backend-offset'
      )
    ).toEqual([])
    expect(
      Math.max(...packets.map((packet) => packet.maxPolygonPointCount))
    ).toBeLessThan(500)
    expect(endPackets).toHaveLength(2)
    expect(endPackets.every((packet) => packet.intervalId !== null)).toBe(true)
    expect(endPackets.every((packet) => packet.bounds.maxY > 240)).toBe(true)

    const raster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const [
      penultimateEndCoverage,
      finalEndCoverage,
      lowerRightLeakCoverage,
      lowerRightCornerContinuityA,
      lowerRightCornerContinuityB
    ] = await Promise.all([
      getGreenCoverage(
        page,
        raster,
        getLocalPointProbe(raster, endPackets[0].representativePoint, 5)
      ),
      getGreenCoverage(
        page,
        raster,
        getLocalPointProbe(raster, endPackets[1].representativePoint, 5)
      ),
      getGreenCoverage(
        page,
        raster,
        getLocalPointProbe(
          raster,
          {
            x: Math.min(222, endPackets[1].bounds.maxX + STROKE_WIDTH),
            y: Math.min(336, endPackets[1].bounds.maxY + STROKE_WIDTH)
          },
          5
        )
      ),
      getGreenCoverage(
        page,
        raster,
        getLocalPointProbe(raster, { x: 20, y: 130 }, 9)
      ),
      getGreenCoverage(
        page,
        raster,
        getLocalPointProbe(raster, { x: 38, y: 148 }, 9)
      )
    ])

    expect(penultimateEndCoverage).toBeGreaterThan(0.18)
    expect(finalEndCoverage).toBeGreaterThan(0.18)
    expect(lowerRightLeakCoverage).toBeLessThan(MAX_GAP_COVERAGE)
    expect(lowerRightCornerContinuityA).toBeGreaterThan(0.22)
    expect(lowerRightCornerContinuityB).toBeGreaterThan(0.22)
  })

  test('benchmark: non-product constrained dashed stroke remains visually absent', async ({
    page
  }) => {
    await createRectangle(page, 0.3, 0.3)
    await ensureStrokeRow(page)
    const propertiesPanel = getPropertiesPanel(page)
    await propertiesPanel
      .getByTestId('prop-stroke-style-0')
      .selectOption('dashed')
    await propertiesPanel
      .getByTestId('prop-stroke-position-0')
      .selectOption('inside')
    await fillStrokeDashGap(propertiesPanel, 0, '20, 20')
    await propertiesPanel.getByTestId('prop-stroke-color-0').fill(STROKE_COLOR)
    await propertiesPanel.getByTestId('prop-stroke-color-0').press('Enter')
    await page.waitForTimeout(180)

    const raster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const coverage = await getGreenCoverage(page, raster, {
      x: raster.padding - 2,
      y: raster.padding - 2,
      width: raster.elementWidth + 4,
      height: Math.max(8, raster.strokeWidthPx)
    })

    expect(coverage).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
  })

  test('benchmark: open vector dashed butt and square caps stay visually distinct on the supported path', async ({
    page
  }) => {
    await createVectorPath(page, 0.3, 0.3, 0.1, 0.1)
    await clearVectorOverlayState(page)
    await ensureElementSelected(page)
    await patchSelectedVectorToOpenHorizontalLine(page)
    await configureDashedCenterStroke(page, {
      cap: 'butt',
      pattern: '20, 20',
      offset: '0'
    })

    const buttRaster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const buttStartCap = await getGreenCoverage(page, buttRaster, {
      x: buttRaster.padding - buttRaster.strokeWidthPx / 2 + 1,
      y: buttRaster.padding - buttRaster.strokeWidthPx / 2 + 1,
      width: Math.max(2, buttRaster.strokeWidthPx / 2),
      height: buttRaster.strokeWidthPx
    })

    await configureDashedCenterStroke(page, {
      cap: 'square',
      pattern: '20, 20',
      offset: '0'
    })

    const squareRaster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const squareStartCap = await getGreenCoverage(page, squareRaster, {
      x: squareRaster.padding - squareRaster.strokeWidthPx / 2 + 1,
      y: squareRaster.padding - squareRaster.strokeWidthPx / 2 + 1,
      width: Math.max(2, squareRaster.strokeWidthPx / 2),
      height: squareRaster.strokeWidthPx
    })

    expect(buttStartCap).toBeLessThan(0.25)
    expect(squareStartCap).toBeGreaterThan(buttStartCap + 0.2)
    expect(squareStartCap).toBeGreaterThan(MIN_VISIBLE_COVERAGE)
  })

  test('benchmark: acute-angle open vector dashed miter keeps continuity when one dash spans the turn', async ({
    page
  }) => {
    await createVectorPath(page, 0.3, 0.3, 0.1, 0.1)
    await clearVectorOverlayState(page)
    await ensureElementSelected(page)
    await patchSelectedVectorToOpenAcuteTurn(page)
    await configureDashedCenterStroke(page, {
      join: 'miter',
      pattern: '40, 10',
      offset: '0'
    })

    const raster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const cornerCoverage = await getGreenCoverage(
      page,
      raster,
      getLocalPointProbe(raster, { x: 31, y: 2 })
    )

    expect(cornerCoverage).toBeGreaterThan(MIN_VISIBLE_COVERAGE)
  })

  test('benchmark: acute-angle open vector dashed bevel keeps continuity when one dash spans the turn', async ({
    page
  }) => {
    await createVectorPath(page, 0.3, 0.3, 0.1, 0.1)
    await clearVectorOverlayState(page)
    await ensureElementSelected(page)
    await patchSelectedVectorToOpenAcuteTurn(page)
    await configureDashedCenterStroke(page, {
      join: 'bevel',
      pattern: '40, 10',
      offset: '0'
    })

    const raster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const cornerCoverage = await getGreenCoverage(
      page,
      raster,
      getLocalPointProbe(raster, { x: 31, y: 2 })
    )

    expect(cornerCoverage).toBeGreaterThan(MIN_VISIBLE_COVERAGE)
  })

  test('benchmark: acute-angle open vector dashed keeps the turn absent when a gap spans the corner', async ({
    page
  }) => {
    await createVectorPath(page, 0.3, 0.3, 0.1, 0.1)
    await clearVectorOverlayState(page)
    await ensureElementSelected(page)
    await patchSelectedVectorToOpenAcuteTurn(page)
    await configureDashedCenterStroke(page, {
      join: 'miter',
      pattern: '27, 13',
      offset: '0'
    })

    const raster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const cornerCoverage = await getGreenCoverage(
      page,
      raster,
      getLocalPointProbe(raster, { x: 29, y: 1 })
    )

    expect(cornerCoverage).toBeLessThan(MAX_GAP_COVERAGE)
  })

  test('benchmark: dashed center round join renders visible corner curvature without miter fill', async ({
    page
  }) => {
    await createVectorPath(page, 0.3, 0.3, 0.1, 0.1)
    await clearVectorOverlayState(page)
    await ensureElementSelected(page)
    await patchSelectedVectorToClosedRectangle(page)
    await configureDashedCenterStroke(page, {
      join: 'round',
      pattern: '87, 20',
      offset: '0'
    })

    const raster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const [roundArc, miterCorner] = await Promise.all([
      getGreenCoverage(
        page,
        raster,
        getLocalPointProbe(raster, { x: 83, y: -3 })
      ),
      getGreenCoverage(
        page,
        raster,
        getLocalPointProbe(raster, { x: 85, y: -5 }, 2)
      )
    ])

    expect(roundArc).toBeGreaterThan(0.2)
    expect(miterCorner).toBeLessThan(MAX_GAP_COVERAGE)
  })

  test('benchmark: dashed center round cap renders visible terminal curvature without square corners', async ({
    page
  }) => {
    await createVectorPath(page, 0.3, 0.3, 0.1, 0.1)
    await clearVectorOverlayState(page)
    await ensureElementSelected(page)
    await patchSelectedVectorToOpenHorizontalLine(page)
    await configureDashedCenterStroke(page, {
      cap: 'round',
      pattern: '20, 20',
      offset: '0'
    })

    const raster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const [roundTerminal, squareCorner] = await Promise.all([
      getGreenCoverage(
        page,
        raster,
        getLocalPointProbe(raster, { x: -4, y: 0 }, 4)
      ),
      getGreenCoverage(
        page,
        raster,
        getLocalPointProbe(raster, { x: -5, y: -5 }, 2)
      )
    ])

    expect(roundTerminal).toBeGreaterThan(0.2)
    expect(squareCorner).toBeLessThan(MAX_GAP_COVERAGE)
  })
})
