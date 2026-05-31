import { expect, test, type Page, type TestInfo } from '@playwright/test'
import {
  getSelectedElementRect,
  resetCanvas,
  setStrokeDiagnosticsMode,
  waitForAppReady
} from './test-utils'

interface Vec2 {
  x: number
  y: number
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

interface ExportPacketSnapshot {
  debugMeta: Record<string, unknown>
  polygons: Vec2[][]
  bounds: {
    minX: number
    minY: number
    maxX: number
    maxY: number
  }
}

const PADDING = 24
const STROKE_WIDTH = 10
const ADJUSTED_DASH_PATTERN = [27, 20] as const
const REPORTED_VECTOR_6_WIDTH = 360.120941483566
const REPORTED_VECTOR_6_HEIGHT = 366.06359840210007
const REPORTED_VECTOR_6_STROKE_COLOR = 'DF0606'
const TP12 = { x: 192.42083700791653, y: 0 }
const TP13 = { x: 11.358174406717296, y: 364.1297089212308 }
const TP16 = { x: 270.59180204238254, y: 345.42212754546125 }
const TP12_OUT = { x: 161.0183251984924, y: 122.56543010176405 }
const TP13_IN = { x: -42.09205809548172, y: 343.2841182453731 }
const TP16_OUT = { x: 277.2730811051575, y: 328.05080198224647 }

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

const normalizeVector = (vector: Vec2): Vec2 => {
  const length = Math.hypot(vector.x, vector.y)
  return length > 0
    ? { x: vector.x / length, y: vector.y / length }
    : { x: 1, y: 0 }
}

const cubicPoint = (
  p0: Vec2,
  p1: Vec2,
  p2: Vec2,
  p3: Vec2,
  t: number
): Vec2 => {
  const mt = 1 - t
  return {
    x:
      mt ** 3 * p0.x +
      3 * mt ** 2 * t * p1.x +
      3 * mt * t ** 2 * p2.x +
      t ** 3 * p3.x,
    y:
      mt ** 3 * p0.y +
      3 * mt ** 2 * t * p1.y +
      3 * mt * t ** 2 * p2.y +
      t ** 3 * p3.y
  }
}

const offsetFromTangentSide = (
  point: Vec2,
  tangent: Vec2,
  selectedSide: 1 | -1,
  distance: number
) => ({
  x: point.x - tangent.y * selectedSide * distance,
  y: point.y + tangent.x * selectedSide * distance
})

const pointDistance = (from: Vec2, to: Vec2) =>
  Math.hypot(to.x - from.x, to.y - from.y)

const getSignedArea = (points: readonly Vec2[]) => {
  let total = 0
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]
    const next = points[(index + 1) % points.length]
    total += current.x * next.y - next.x * current.y
  }
  return total / 2
}

const getInsideSourceSide = (points: readonly Vec2[]): 1 | -1 =>
  getSignedArea(points) >= 0 ? 1 : -1

const TP14 = { x: 360.12094148356596, y: 144.31562775593738 }
const TP15 = { x: 0, y: 14.030686031827244 }
const TP13_OUT = { x: 78.17096503446606, y: 390.18669726605293 }
const TP15_OUT = { x: 0, y: 14.030686031827244 }
const TP16_IN = { x: 263.91052297960755, y: 362.79345310867603 }
const ADJUSTED_VECTOR_6_WIDTH = 360.12094148356584
const ADJUSTED_VECTOR_6_HEIGHT = 367.70186652155667
const ADJ_TP12 = { x: 188.1928217922337, y: 0 }
const ADJ_TP13 = { x: 11.358174406717296, y: 365.76797704068724 }
const ADJ_TP14 = { x: 360.12094148356584, y: 145.95389587539378 }
const ADJ_TP15 = { x: 0, y: 15.668954151283657 }
const ADJ_TP16 = { x: 270.59180204238254, y: 347.0603956649177 }
const ADJ_TP12_OUT = { x: 164.3673966581619, y: 140.91988215887423 }
const ADJ_TP13_IN = { x: -42.09205809548172, y: 344.92238636482955 }
const ADJ_TP13_OUT = { x: 78.17096503446606, y: 391.8249653855095 }
const ADJ_TP15_OUT = { x: 0, y: 15.668954151283657 }
const ADJ_TP16_IN = { x: 263.9105229796075, y: 364.43172122813246 }
const ADJ_TP16_OUT = { x: 277.27308110515736, y: 329.6890701017029 }
const REPORTED_SOURCE_POINTS = [TP12, TP13, TP14, TP15, TP16] as const
const ADJUSTED_SOURCE_POINTS = [
  ADJ_TP12,
  ADJ_TP13,
  ADJ_TP14,
  ADJ_TP15,
  ADJ_TP16
] as const

const buildCubicPolyline = (
  p0: Vec2,
  p1: Vec2,
  p2: Vec2,
  p3: Vec2,
  steps = 96
) => {
  const points: Vec2[] = []
  for (let index = 0; index <= steps; index += 1) {
    points.push(cubicPoint(p0, p1, p2, p3, index / steps))
  }
  return points
}

const getPolylineLength = (points: Vec2[]) =>
  points.slice(0, -1).reduce((sum, point, index) => {
    const next = points[index + 1]
    return sum + pointDistance(point, next)
  }, 0)

const getReportedSourcePathSegments = () => {
  const polylines = [
    buildCubicPolyline(TP12, TP12_OUT, TP13_IN, TP13),
    buildCubicPolyline(TP13, TP13_OUT, TP14, TP14),
    [TP14, TP15],
    buildCubicPolyline(TP15, TP15_OUT, TP16_IN, TP16),
    buildCubicPolyline(TP16, TP16_OUT, TP12, TP12)
  ]
  let cursor = 0
  return polylines.map((polyline, segmentIndex) => {
    const length = getPolylineLength(polyline)
    const range = {
      polyline,
      segmentIndex,
      startDistance: cursor,
      endDistance: cursor + length
    }
    cursor = range.endDistance
    return range
  })
}

const getSourceSegmentPointAtDistance = (
  segmentIndex: number,
  distance: number
) => {
  const segment = getReportedSourcePathSegments()[segmentIndex]
  if (!segment) {
    throw new Error(`Missing reported source segment ${segmentIndex}`)
  }

  let cursor = 0
  for (let index = 0; index < segment.polyline.length - 1; index += 1) {
    const start = segment.polyline[index]
    const end = segment.polyline[index + 1]
    const edgeLength = pointDistance(start, end)
    if (edgeLength <= 1e-9) {
      continue
    }
    if (cursor + edgeLength >= distance) {
      const amount = (distance - cursor) / edgeLength
      return {
        point: {
          x: start.x + (end.x - start.x) * amount,
          y: start.y + (end.y - start.y) * amount
        },
        tangent: normalizeVector({
          x: end.x - start.x,
          y: end.y - start.y
        })
      }
    }
    cursor += edgeLength
  }

  const end = segment.polyline[segment.polyline.length - 1]
  const beforeEnd = segment.polyline[segment.polyline.length - 2] ?? end
  return {
    point: end,
    tangent: normalizeVector({
      x: end.x - beforeEnd.x,
      y: end.y - beforeEnd.y
    })
  }
}

const offsetFromSourceSegmentAtDistance = (
  segmentIndex: number,
  distance: number,
  side: 1 | -1,
  offset: number
) => {
  const { point, tangent } = getSourceSegmentPointAtDistance(
    segmentIndex,
    distance
  )
  return offsetFromTangentSide(point, tangent, side, offset)
}

const getAdjustedSourcePathSegments = () => {
  const polylines = [
    buildCubicPolyline(ADJ_TP12, ADJ_TP12_OUT, ADJ_TP13_IN, ADJ_TP13),
    buildCubicPolyline(ADJ_TP13, ADJ_TP13_OUT, ADJ_TP14, ADJ_TP14),
    [ADJ_TP14, ADJ_TP15],
    buildCubicPolyline(ADJ_TP15, ADJ_TP15_OUT, ADJ_TP16_IN, ADJ_TP16),
    buildCubicPolyline(ADJ_TP16, ADJ_TP16_OUT, ADJ_TP12, ADJ_TP12)
  ]
  let cursor = 0
  return polylines.map((polyline, segmentIndex) => {
    const length = getPolylineLength(polyline)
    const range = {
      polyline,
      segmentIndex,
      startDistance: cursor,
      endDistance: cursor + length
    }
    cursor = range.endDistance
    return range
  })
}

const getAdjustedSourceSegmentPointAtDistance = (
  segmentIndex: number,
  distance: number
) => {
  const segment = getAdjustedSourcePathSegments()[segmentIndex]
  if (!segment) {
    throw new Error(`Missing adjusted source segment ${segmentIndex}`)
  }

  let cursor = 0
  for (let index = 0; index < segment.polyline.length - 1; index += 1) {
    const start = segment.polyline[index]
    const end = segment.polyline[index + 1]
    const edgeLength = pointDistance(start, end)
    if (edgeLength <= 1e-9) {
      continue
    }
    if (cursor + edgeLength >= distance) {
      const amount = (distance - cursor) / edgeLength
      return {
        point: {
          x: start.x + (end.x - start.x) * amount,
          y: start.y + (end.y - start.y) * amount
        },
        tangent: normalizeVector({
          x: end.x - start.x,
          y: end.y - start.y
        })
      }
    }
    cursor += edgeLength
  }

  const end = segment.polyline[segment.polyline.length - 1]
  const beforeEnd = segment.polyline[segment.polyline.length - 2] ?? end
  return {
    point: end,
    tangent: normalizeVector({
      x: end.x - beforeEnd.x,
      y: end.y - beforeEnd.y
    })
  }
}

const offsetFromAdjustedSourceSegmentAtDistance = (
  segmentIndex: number,
  distance: number,
  side: 1 | -1,
  offset: number
) => {
  const { point, tangent } = getAdjustedSourceSegmentPointAtDistance(
    segmentIndex,
    distance
  )
  return offsetFromTangentSide(point, tangent, side, offset)
}

const getAdjustedTotalLength = () => {
  const segments = getAdjustedSourcePathSegments()
  return segments[segments.length - 1]?.endDistance ?? 0
}

const normalizeAdjustedLoopDistance = (distance: number) => {
  const totalLength = getAdjustedTotalLength()
  return totalLength > 0
    ? ((distance % totalLength) + totalLength) % totalLength
    : 0
}

const getAdjustedSourcePointAtLoopDistance = (distance: number) => {
  const normalized = normalizeAdjustedLoopDistance(distance)
  const segment = getAdjustedSourcePathSegments().find(
    (candidate, index, segments) =>
      normalized >= candidate.startDistance &&
      (normalized <= candidate.endDistance || index === segments.length - 1)
  )
  if (!segment) {
    throw new Error(`Missing adjusted source segment at ${normalized}`)
  }

  return getAdjustedSourceSegmentPointAtDistance(
    segment.segmentIndex,
    normalized - segment.startDistance
  )
}

const isAdjustedVisibleDashDistance = (distance: number) => {
  const totalLength = getAdjustedTotalLength()
  if (totalLength <= 0) {
    return false
  }

  const normalized = normalizeAdjustedLoopDistance(distance)
  const patternLength = ADJUSTED_DASH_PATTERN[0] + ADJUSTED_DASH_PATTERN[1]
  const patternDistance =
    ((normalized % patternLength) + patternLength) % patternLength
  return patternDistance <= ADJUSTED_DASH_PATTERN[0]
}

const getAdjustedHighCurvatureVisibleBodyProbes = () => {
  const segments = getAdjustedSourcePathSegments()
  const segmentStartDistance = segments[4]?.startDistance
  if (segmentStartDistance === undefined) {
    return []
  }

  const selectedSide = getInsideSourceSide(ADJUSTED_SOURCE_POINTS)
  const relativeDistances = [-22, -16, -10, -5, -2, 2, 5, 10, 16, 22]
  const offsets = [2.5, 4.5, 6.5]

  return relativeDistances.flatMap((relativeDistance) => {
    const distance = normalizeAdjustedLoopDistance(
      segmentStartDistance + relativeDistance
    )
    if (!isAdjustedVisibleDashDistance(distance)) {
      return []
    }
    const { point, tangent } = getAdjustedSourcePointAtLoopDistance(distance)
    return offsets.map((offset) => ({
      label: `adjusted high-curvature source-path body d${relativeDistance} o${offset}`,
      point: offsetFromTangentSide(point, tangent, selectedSide, offset),
      size: 6,
      minCoverage: 0.06
    }))
  })
}

const getTopSeamPositiveProbes = (): RedCoverageProbe[] => {
  const selectedSide = getInsideSourceSide(REPORTED_SOURCE_POINTS)
  return [4, 18, 55].map((distance) => ({
    label: `source-path dash body d${distance}`,
    point: offsetFromSourceSegmentAtDistance(0, distance, selectedSide, 5),
    size: 12,
    minCoverage: 0.02
  }))
}

const getAdjustedTopSeamPositiveProbes = (): RedCoverageProbe[] => {
  const selectedSide = getInsideSourceSide(ADJUSTED_SOURCE_POINTS)
  return [4, 18, 55].map((distance) => ({
    label: `adjusted source-path dash body d${distance}`,
    point: offsetFromAdjustedSourceSegmentAtDistance(
      0,
      distance,
      selectedSide,
      5
    ),
    size: 12,
    minCoverage: 0.02
  }))
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

const getAdjustedRasterRegion = (
  raster: RasterCapture,
  point: Vec2,
  size: number
) => {
  const scaleX = raster.elementWidth / ADJUSTED_VECTOR_6_WIDTH
  const scaleY = raster.elementHeight / ADJUSTED_VECTOR_6_HEIGHT
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
          if (a > 100 && r > 90 && g < 90 && b < 90 && r - g > 30) {
            red += 1
          }
        }
      }

      return total > 0 ? red / total : 0
    },
    { base64, region }
  )

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

const attachPng = async (label: string, base64: string, testInfo: TestInfo) => {
  await testInfo.attach(label, {
    body: Buffer.from(base64, 'base64'),
    contentType: 'image/png'
  })
}

const createReportedVector6Dashed = async (
  page: Page,
  position: 'inside' | 'outside'
) => {
  await page.evaluate(
    ({ color, position, strokeWidth }) => {
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
          anchorType: 'smooth'
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
          x: 161.0183251984924,
          y: 122.56543010176405,
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
              id: 'reported-vector-6-dashed-inside',
              kind: 'solid',
              style: 'dashed',
              position,
              width: strokeWidth,
              dashPattern: [27, 20],
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
      color: REPORTED_VECTOR_6_STROKE_COLOR,
      position,
      strokeWidth: STROKE_WIDTH
    }
  )

  await page.waitForTimeout(1200)
}

const createReportedVector6InsideDashed = async (page: Page) =>
  createReportedVector6Dashed(page, 'inside')

const createReportedVector6OutsideDashed = async (page: Page) =>
  createReportedVector6Dashed(page, 'outside')

const createAdjustedReportedVector6InsideRoundDashed = async (page: Page) => {
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
          x: 188.1928217922337,
          y: 0,
          anchorType: 'smooth'
        },
        'tp-13': {
          id: 'tp-13',
          kind: 'anchor',
          x: 11.358174406717296,
          y: 365.76797704068724,
          anchorType: 'smooth'
        },
        'tp-12:out': {
          id: 'tp-12:out',
          kind: 'control',
          x: 164.3673966581619,
          y: 140.91988215887423,
          controlForId: 'tp-12',
          controlRole: 'out'
        },
        'tp-13:in': {
          id: 'tp-13:in',
          kind: 'control',
          x: -42.09205809548172,
          y: 344.92238636482955,
          controlForId: 'tp-13',
          controlRole: 'in'
        },
        'tp-13:out': {
          id: 'tp-13:out',
          kind: 'control',
          x: 78.17096503446606,
          y: 391.8249653855095,
          controlForId: 'tp-13',
          controlRole: 'out'
        },
        'tp-14': {
          id: 'tp-14',
          kind: 'anchor',
          x: 360.12094148356584,
          y: 145.95389587539378,
          anchorType: 'sharp'
        },
        'tp-15': {
          id: 'tp-15',
          kind: 'anchor',
          x: 0,
          y: 15.668954151283657,
          anchorType: 'sharp'
        },
        'tp-16': {
          id: 'tp-16',
          kind: 'anchor',
          x: 270.59180204238254,
          y: 347.0603956649177,
          anchorType: 'smooth'
        },
        'tp-15:out': {
          id: 'tp-15:out',
          kind: 'control',
          x: 0,
          y: 15.668954151283657,
          controlForId: 'tp-15',
          controlRole: 'out'
        },
        'tp-16:in': {
          id: 'tp-16:in',
          kind: 'control',
          x: 263.9105229796075,
          y: 364.43172122813246,
          controlForId: 'tp-16',
          controlRole: 'in'
        },
        'tp-16:out': {
          id: 'tp-16:out',
          kind: 'control',
          x: 277.27308110515736,
          y: 329.6890701017029,
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
        throw new Error('Failed to create adjusted reported vector-6 fixture')
      }
      elementApis?.changeComputedData?.(
        [createdId],
        {
          x: 220,
          y: 159,
          width: 360.12094148356584,
          height: 367.70186652155667,
          points,
          segments,
          networks,
          closed: true,
          fills: [],
          strokes: [
            {
              id: 'adjusted-vector-6-dashed-inside-round',
              kind: 'solid',
              style: 'dashed',
              position: 'inside',
              width: strokeWidth,
              dashPattern: [27, 20],
              dashOffset: 0,
              fill: null,
              defaultColorFormat: 'hex',
              colorFormat: 'hex',
              color: `#${color}`,
              opacity: 0.5,
              visible: true,
              gradient: null,
              joinType: 'miter',
              capType: 'round',
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
      color: REPORTED_VECTOR_6_STROKE_COLOR,
      strokeWidth: STROKE_WIDTH
    }
  )

  await page.waitForTimeout(1200)
}

const getSelectedStrokeRenderPacketSummary = async (page: Page) =>
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
      exportPacketDebugMeta: exportPackets.map(
        (packet: { debugMeta?: Record<string, unknown> }) =>
          packet.debugMeta ?? {}
      ),
      exportPackets: exportPackets.map(
        (packet: {
          debugMeta?: Record<string, unknown>
          polygons?: { x: number; y: number }[][]
        }) => {
          const polygons = packet.polygons ?? []
          return {
            debugMeta: packet.debugMeta ?? {},
            polygons,
            bounds: polygons.reduce(
              (bounds, polygon) => {
                polygon.forEach((point) => {
                  bounds.minX = Math.min(bounds.minX, point.x)
                  bounds.minY = Math.min(bounds.minY, point.y)
                  bounds.maxX = Math.max(bounds.maxX, point.x)
                  bounds.maxY = Math.max(bounds.maxY, point.y)
                })
                return bounds
              },
              {
                minX: Number.POSITIVE_INFINITY,
                minY: Number.POSITIVE_INFINITY,
                maxX: Number.NEGATIVE_INFINITY,
                maxY: Number.NEGATIVE_INFINITY
              }
            )
          }
        }
      )
    }
  })

const assertAnyRedCoverageProbe = async (
  page: Page,
  raster: RasterCapture,
  probes: RedCoverageProbe[]
) => {
  const coverages = await Promise.all(
    probes.map(async (probe) => ({
      label: probe.label,
      coverage: await getBase64RedCoverage(
        page,
        raster.base64,
        getRasterRegion(raster, probe.point, probe.size)
      ),
      minCoverage: probe.minCoverage,
      point: probe.point
    }))
  )

  expect(
    coverages.some((entry) => entry.coverage >= entry.minCoverage),
    JSON.stringify(coverages, null, 2)
  ).toBe(true)
}

test.describe('Reported Vector-6 Inside Dashed Seam Regression', () => {
  test('records self-intersecting inside dashed seam packets without enforcing center-stroke side rules', async ({
    page
  }, testInfo) => {
    await createReportedVector6InsideDashed(page)

    try {
      await setStrokeDebugDisableVisualOverlapCollapse(page, true)
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
          (packet: { debugMeta?: Record<string, unknown> }) =>
            packet.debugMeta?.geometryFamily === 'constrained-dashed' &&
            packet.debugMeta?.strokePosition === 'inside'
        )
      })

      const summary = await getSelectedStrokeRenderPacketSummary(page)
      expect(summary.debugDisableVisualOverlapCollapse).toBe(true)
      expect(summary.exportPacketCount).toBeGreaterThan(0)
      expect(
        summary.exportPacketDebugMeta.some(
          (debugMeta) =>
            debugMeta.geometryFamily === 'constrained-dashed' &&
            debugMeta.strokePosition === 'inside' &&
            debugMeta.sourceTopology === 'self-intersecting'
        )
      ).toBe(true)
      const sourcePathPackets = summary.exportPackets.filter(
        (packet: ExportPacketSnapshot) =>
          packet.debugMeta.geometryFamily === 'constrained-dashed' &&
          packet.debugMeta.strokePosition === 'inside' &&
          packet.debugMeta.sourceTopology === 'self-intersecting'
      )
      expect(sourcePathPackets.length).toBeGreaterThan(0)
      expect(
        sourcePathPackets.some(
          (packet) =>
            typeof packet.debugMeta.intervalId === 'string' &&
            packet.debugMeta.intervalId.startsWith('interval:') &&
            packet.debugMeta.sourceTopology === 'self-intersecting'
        ),
        JSON.stringify(
          summary.exportPackets
            .filter(
              (packet: ExportPacketSnapshot) =>
                packet.debugMeta.geometryFamily === 'constrained-dashed' &&
                packet.debugMeta.strokePosition === 'inside'
            )
            .map((packet: ExportPacketSnapshot) => ({
              intervalId: packet.debugMeta.intervalId,
              startDistance: packet.debugMeta.startDistance,
              endDistance: packet.debugMeta.endDistance,
              bounds: packet.bounds
            })),
          null,
          2
        )
      ).toBe(true)
      const raster = await captureSelectedElementRaster(page)
      await attachPng(
        'reported-vector-6-dashed-inside-debug-overlap-global.png',
        raster.base64,
        testInfo
      )
      await attachPng(
        'reported-vector-6-dashed-inside-tp12-seam-zoom.png',
        await cropBase64Png(
          page,
          raster.base64,
          getRasterRectRegion(raster, {
            x: 140,
            y: -12,
            width: 125,
            height: 105
          })
        ),
        testInfo
      )

      await setStrokeDebugDisableVisualOverlapCollapse(page, false)
      await page.waitForTimeout(180)
      const productRaster = await captureSelectedElementRaster(page)
      for (const probe of getTopSeamPositiveProbes()) {
        await assertAnyRedCoverageProbe(page, productRaster, [probe])
      }
    } finally {
      await setStrokeDebugDisableVisualOverlapCollapse(page, false)
    }
  })

  test('keeps outside source-range dash bodies when seam join packets are emitted', async ({
    page
  }, testInfo) => {
    await createReportedVector6OutsideDashed(page)

    try {
      await setStrokeDebugDisableVisualOverlapCollapse(page, true)
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
          (packet: { debugMeta?: Record<string, unknown> }) =>
            packet.debugMeta?.geometryFamily === 'constrained-dashed' &&
            packet.debugMeta?.strokePosition === 'outside'
        )
      })

      const summary = await getSelectedStrokeRenderPacketSummary(page)
      const outsidePackets = summary.exportPackets.filter(
        (packet: ExportPacketSnapshot) =>
          packet.debugMeta.geometryFamily === 'constrained-dashed' &&
          packet.debugMeta.strokePosition === 'outside'
      )
      expect(summary.debugDisableVisualOverlapCollapse).toBe(true)
      expect(outsidePackets.length).toBeGreaterThan(0)

      const raster = await captureSelectedElementRaster(page)
      await attachPng(
        'reported-vector-6-dashed-outside-debug-overlap-global.png',
        raster.base64,
        testInfo
      )
    } finally {
      await setStrokeDebugDisableVisualOverlapCollapse(page, false)
    }
  })

  test('keeps adjusted inside round dashed product visual on source-path intervals', async ({
    page
  }, testInfo) => {
    await createAdjustedReportedVector6InsideRoundDashed(page)

    const raster = await captureSelectedElementRaster(page)
    await attachPng(
      'adjusted-vector-6-inside-round-product-global.png',
      raster.base64,
      testInfo
    )
    await attachPng(
      'adjusted-vector-6-inside-round-product-seam-crop.png',
      await cropBase64Png(
        page,
        raster.base64,
        getRasterRectRegion(raster, {
          x: 130,
          y: -12,
          width: 125,
          height: 115
        })
      ),
      testInfo
    )
    await attachPng(
      'adjusted-vector-6-inside-round-product-high-curvature-crop.png',
      await cropBase64Png(
        page,
        raster.base64,
        getRasterRectRegion(raster, {
          x: 210,
          y: 250,
          width: 125,
          height: 120
        })
      ),
      testInfo
    )

    const selectedSide = getInsideSourceSide(ADJUSTED_SOURCE_POINTS)
    const positiveProbes = [
      {
        label: 'adjusted seam source-path dash coverage',
        point: offsetFromAdjustedSourceSegmentAtDistance(
          0,
          18,
          selectedSide,
          5
        ),
        size: 12,
        minCoverage: 0.02
      },
      {
        label: 'adjusted high-curvature source-path dash coverage',
        point: offsetFromAdjustedSourceSegmentAtDistance(
          4,
          20,
          selectedSide,
          5
        ),
        size: 12,
        minCoverage: 0.02
      }
    ]
    for (const probe of positiveProbes) {
      const coverage = await getBase64RedCoverage(
        page,
        raster.base64,
        getAdjustedRasterRegion(raster, probe.point, probe.size)
      )
      expect(
        coverage,
        `${probe.label} should keep visible product coverage`
      ).toBeGreaterThanOrEqual(probe.minCoverage)
    }

    const highCurvatureVisibleBodyFailures: {
      label: string
      coverage: number
      minCoverage: number
      point: Vec2
    }[] = []
    const highCurvatureVisibleBodyProbes =
      getAdjustedHighCurvatureVisibleBodyProbes()
    expect(highCurvatureVisibleBodyProbes.length).toBeGreaterThan(0)
    for (const probe of highCurvatureVisibleBodyProbes) {
      const coverage = await getBase64RedCoverage(
        page,
        raster.base64,
        getAdjustedRasterRegion(raster, probe.point, probe.size)
      )
      if (coverage < probe.minCoverage) {
        highCurvatureVisibleBodyFailures.push({
          label: probe.label,
          coverage,
          minCoverage: probe.minCoverage,
          point: probe.point
        })
      }
    }
    expect(
      highCurvatureVisibleBodyFailures,
      JSON.stringify(highCurvatureVisibleBodyFailures, null, 2)
    ).toEqual([])
  })

  test('keeps adjusted inside round dashed source-path packets while path editing overlay is active', async ({
    page
  }, testInfo) => {
    await createAdjustedReportedVector6InsideRoundDashed(page)
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      const selectedId =
        core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
      core?.setSystemProperty?.('pathEditingVectorId', selectedId)
      core?.setSystemProperty?.('pathEditingMode', true)
    })
    await page.waitForTimeout(180)

    const raster = await captureSelectedElementRaster(page)
    await attachPng(
      'adjusted-vector-6-inside-round-path-editing-global.png',
      raster.base64,
      testInfo
    )
    for (const probe of getAdjustedTopSeamPositiveProbes()) {
      await assertAnyRedCoverageProbe(page, raster, [probe])
    }
    const summary = await getSelectedStrokeRenderPacketSummary(page)
    expect(
      summary.exportPacketDebugMeta.some(
        (debugMeta) =>
          debugMeta.geometryFamily === 'constrained-dashed' &&
          debugMeta.strokePosition === 'inside' &&
          debugMeta.sourceTopology === 'self-intersecting' &&
          typeof debugMeta.intervalId === 'string' &&
          debugMeta.intervalId.startsWith('interval:')
      )
    ).toBe(true)
  })
})
