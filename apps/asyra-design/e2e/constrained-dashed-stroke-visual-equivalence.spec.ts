/* eslint-disable @typescript-eslint/no-unused-vars */
import { expect, test, type Page } from '@playwright/test'
import {
  createOval,
  createRectangle,
  createVectorPath,
  fillStrokeDashGap,
  getCanvasPosition,
  getPropertiesPanel,
  getSelectedElementRect,
  patchSelectedStrokeDashOffset,
  resetCanvas,
  setStrokeDiagnosticsMode,
  waitForAppReady
} from './test-utils'

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

interface LocalRasterCapture {
  base64: string
  width: number
  height: number
  zoom: number
  clip: {
    x: number
    y: number
    width: number
    height: number
  }
  rect: SelectedElementSnapshot['rect']
  viewport: SelectedElementSnapshot['viewport']
}

interface SampledColor {
  r: number
  g: number
  b: number
  a: number
}

interface VectorTopologyPoint {
  id: string
  kind: 'anchor' | 'control'
  x: number
  y: number
  anchorType?: 'sharp' | 'smooth'
}

interface VectorTopologySegment {
  id: string
  startId: string
  endId: string
  outControlId: string | null
  inControlId: string | null
}

interface LongShortSegmentFixture {
  points: Record<string, VectorTopologyPoint>
  segments: Record<string, VectorTopologySegment>
  network: {
    pointIds: string[]
    segmentIds: string[]
    closed: true
  }
  sourcePath: { x: number; y: number }[]
  totalLength: number
}

const getRedBlueSkew = (color: SampledColor) => color.r - color.b

const PADDING = 24
const STROKE_WIDTH = 10
const STROKE_COLOR = '00FF00'
const FULL_LOOP_PATTERN = '2000, 20'
const RECT_SINGLE_EDGE_PATTERN = '20, 380'
const RECT_SINGLE_EDGE_OFFSET = '380'
const ORTHOGONAL_80X40_SINGLE_EDGE_PATTERN = '20, 220'
const ORTHOGONAL_80X40_SINGLE_EDGE_OFFSET = '220'
const ORTHOGONAL_80X40_CORNER_SPANNING_PATTERN = '40, 200'
const ORTHOGONAL_80X40_CORNER_SPANNING_OFFSET = '180'
const SHARP_SEAM_TRIANGLE_FIRST_DASH_PATTERN = '24, 260'
const MIN_SUPPORTED_COVERAGE = 0.55
const MIN_VECTOR_CAP_TERMINAL_COVERAGE = 0.25
const MAX_UNSUPPORTED_COVERAGE = 0.03
const MAX_EXTERIOR_LEAK = 0.12
const DEFAULT_STROKE_GRADIENT = {
  gradientType: 'linear',
  gradientStops: [
    {
      position: 0,
      color: '#ff0000',
      opacity: 1
    },
    {
      position: 1,
      color: '#0000ff',
      opacity: 1
    }
  ],
  gradientHandles: [
    {
      x: 0,
      y: 0.5
    },
    {
      x: 1,
      y: 0.5
    }
  ],
  metadata: {}
}

interface ReportedStarReferencePoints {
  top: { x: number; y: number }
  bottomLeft: { x: number; y: number }
  right: { x: number; y: number }
  left: { x: number; y: number }
  bottomRight: { x: number; y: number }
  topOut: { x: number; y: number }
  bottomLeftIn: { x: number; y: number }
  bottomLeftOut: { x: number; y: number }
  leftOut: { x: number; y: number }
  bottomRightIn: { x: number; y: number }
  bottomRightOut: { x: number; y: number }
}

const lerpPoint = (
  a: { x: number; y: number },
  b: { x: number; y: number },
  t: number
) => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t
})

const quadraticPoint = (
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  t: number
) => {
  const left = lerpPoint(p0, p1, t)
  const right = lerpPoint(p1, p2, t)
  return lerpPoint(left, right, t)
}

const cubicPoint = (
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  t: number
) => {
  const a = quadraticPoint(p0, p1, p2, t)
  const b = quadraticPoint(p1, p2, p3, t)
  return lerpPoint(a, b, t)
}

const appendSampledSegment = (
  result: { x: number; y: number }[],
  sample: (t: number) => { x: number; y: number },
  steps: number
) => {
  for (let index = 0; index <= steps; index += 1) {
    if (result.length > 0 && index === 0) {
      continue
    }
    result.push(sample(index / steps))
  }
}

const distanceBetween = (
  a: { x: number; y: number },
  b: { x: number; y: number }
) => Math.hypot(a.x - b.x, a.y - b.y)

const getPolylineLength = (path: { x: number; y: number }[]) => {
  let length = 0
  for (let index = 1; index < path.length; index += 1) {
    length += distanceBetween(path[index - 1], path[index])
  }
  return length
}

const getPointAtPolylineDistance = (
  path: { x: number; y: number }[],
  distance: number
) => {
  const totalLength = getPolylineLength(path)
  const target = ((distance % totalLength) + totalLength) % totalLength
  let walked = 0

  for (let index = 1; index < path.length; index += 1) {
    const previous = path[index - 1]
    const current = path[index]
    const length = distanceBetween(previous, current)
    if (walked + length >= target) {
      const t = length > 0 ? (target - walked) / length : 0
      return {
        point: lerpPoint(previous, current, t),
        tangent: {
          x: current.x - previous.x,
          y: current.y - previous.y
        }
      }
    }
    walked += length
  }

  const last = path[path.length - 1]
  const previous = path[Math.max(0, path.length - 2)]
  return {
    point: last,
    tangent: {
      x: last.x - previous.x,
      y: last.y - previous.y
    }
  }
}

const getStrokeSideProbeAtDistance = (
  path: { x: number; y: number }[],
  distance: number,
  position: 'inside' | 'outside',
  offset: number
) => {
  const { point, tangent } = getPointAtPolylineDistance(path, distance)
  const length = Math.hypot(tangent.x, tangent.y) || 1
  const normal = {
    x: -tangent.y / length,
    y: tangent.x / length
  }
  const first = {
    x: point.x + normal.x * offset,
    y: point.y + normal.y * offset
  }
  const second = {
    x: point.x - normal.x * offset,
    y: point.y - normal.y * offset
  }
  const firstInside = isPointInsideClosedPath(first, path)
  if (position === 'inside') {
    return firstInside ? first : second
  }
  return firstInside ? second : first
}

const getSelectedStrokePacketProbeCenters = async (page: Page, limit = 9) =>
  page.evaluate((limit) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const selectedId =
      core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
    const renderElement = selectedId
      ? core?.deps?.render?.getElementById?.(selectedId)
      : null
    const exportPackets =
      renderElement?.__asyraSolidCenterStrokeExportPackets ?? []
    const polygons = exportPackets.flatMap((packet: { polygons?: unknown }) =>
      Array.isArray(packet.polygons)
        ? packet.polygons.filter(
            (polygon): polygon is { x: number; y: number }[] =>
              Array.isArray(polygon) &&
              polygon.length >= 3 &&
              polygon.every(
                (point) =>
                  point &&
                  typeof point === 'object' &&
                  typeof (point as { x?: unknown }).x === 'number' &&
                  typeof (point as { y?: unknown }).y === 'number'
              )
          )
        : []
    )

    return polygons
      .map((polygon, index) => {
        const center = polygon.reduce(
          (sum, point) => ({
            x: sum.x + point.x / polygon.length,
            y: sum.y + point.y / polygon.length
          }),
          { x: 0, y: 0 }
        )
        return {
          name: `packet-polygon-${index}`,
          center
        }
      })
      .slice(0, limit)
  }, limit)

const isPointInsideClosedPath = (
  point: { x: number; y: number },
  path: { x: number; y: number }[]
) => {
  let inside = false
  for (let index = 0; index < path.length; index += 1) {
    const a = path[index]
    const b = path[(index + 1) % path.length]
    const crosses =
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y || 1e-9) + a.x
    if (crosses) {
      inside = !inside
    }
  }
  return inside
}

const getReportedStarComputedReferencePoints = async (
  page: Page
): Promise<ReportedStarReferencePoints> =>
  page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const selectedId = core?.deps?.selection?.getElementSelectionIds?.()?.[0]
    const element = selectedId
      ? core?.deps?.sceneTree?.getElementById?.(selectedId)
      : undefined
    const points = element?.getAllComputedData?.()?.points ?? {}
    const getPoint = (id: string) => {
      const point = points[id]
      if (typeof point?.x !== 'number' || typeof point?.y !== 'number') {
        throw new Error(`Missing reported star computed point ${id}`)
      }
      return { x: point.x, y: point.y }
    }

    return {
      top: getPoint('tp-56'),
      bottomLeft: getPoint('tp-57'),
      right: getPoint('tp-58'),
      left: getPoint('tp-59'),
      bottomRight: getPoint('tp-60'),
      topOut: getPoint('tp-56:out'),
      bottomLeftIn: getPoint('tp-57:in'),
      bottomLeftOut: getPoint('tp-57:out'),
      leftOut: getPoint('tp-59:out'),
      bottomRightIn: getPoint('tp-60:in'),
      bottomRightOut: getPoint('tp-60:out')
    }
  })

const setStrokeDebugDisableVisualOverlapCollapse = async (
  page: Page,
  disabled: boolean
) => {
  await page.evaluate((disabled) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    core?.setSystemProperty?.(
      'strokeDebugDisableVisualOverlapCollapse',
      disabled
    )
  }, disabled)
  await page.waitForTimeout(120)
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

const getLocalProbeRegion = (
  raster: RasterCapture,
  point: { x: number; y: number },
  size: number
) => ({
  x: raster.padding + point.x - size / 2,
  y: raster.padding + point.y - size / 2,
  width: size,
  height: size
})

const captureSelectedElementLocalRaster = async (
  page: Page,
  localCenter: { x: number; y: number },
  options: {
    zoom?: number
    width?: number
    height?: number
  } = {}
): Promise<LocalRasterCapture> => {
  const viewportSize = page.viewportSize() ?? { width: 1280, height: 900 }
  const zoom = options.zoom ?? 8
  const width = options.width ?? 360
  const height = options.height ?? 300
  const targetScreen = {
    x: Math.round(viewportSize.width / 2),
    y: Math.round(viewportSize.height / 2)
  }
  const snapshot = await getSelectedElementSnapshot(page)
  const viewport = {
    x: targetScreen.x - (snapshot.rect.x + localCenter.x) * zoom,
    y: targetScreen.y - (snapshot.rect.y + localCenter.y) * zoom
  }

  await page.evaluate(
    ({ zoom, viewport }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      core?.setSystemProperty?.('zoom', zoom)
      core?.setSystemProperty?.('viewportPosition', viewport)
    },
    { zoom, viewport }
  )
  await page.waitForTimeout(120)

  const clip = {
    x: Math.max(0, Math.floor(targetScreen.x - width / 2)),
    y: Math.max(0, Math.floor(targetScreen.y - height / 2)),
    width,
    height
  }
  const screenshot = await page.screenshot({ clip })

  return {
    base64: screenshot.toString('base64'),
    width,
    height,
    zoom,
    clip,
    rect: snapshot.rect,
    viewport
  }
}

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

const getLocalGreenCoverage = async (
  page: Page,
  raster: LocalRasterCapture,
  focus?: {
    center: { x: number; y: number }
    radius: number
  }
) =>
  page.evaluate(
    async ({
      base64,
      raster,
      focus
    }: {
      base64: string
      raster: LocalRasterCapture
      focus?: {
        center: { x: number; y: number }
        radius: number
      }
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
      const image = context.getImageData(0, 0, canvas.width, canvas.height).data
      let total = 0
      let green = 0
      for (let y = 0; y < canvas.height; y += 1) {
        for (let x = 0; x < canvas.width; x += 1) {
          const local = {
            x:
              (raster.clip.x + x - raster.viewport.x) / raster.zoom -
              raster.rect.x,
            y:
              (raster.clip.y + y - raster.viewport.y) / raster.zoom -
              raster.rect.y
          }
          if (
            focus &&
            Math.hypot(local.x - focus.center.x, local.y - focus.center.y) >
              focus.radius
          ) {
            continue
          }
          const offset = (y * canvas.width + x) * 4
          const r = image[offset]
          const g = image[offset + 1]
          const b = image[offset + 2]
          const a = image[offset + 3]
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
      raster,
      focus
    }
  )

const getAverageColor = async (
  page: Page,
  raster: RasterCapture,
  region: { x: number; y: number; width: number; height: number }
): Promise<SampledColor> =>
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
      let red = 0
      let green = 0
      let blue = 0
      let alpha = 0

      for (let y = startY; y < endY; y += 1) {
        for (let x = startX; x < endX; x += 1) {
          const [r, g, b, a] = context.getImageData(x, y, 1, 1).data
          total += 1
          red += r
          green += g
          blue += b
          alpha += a
        }
      }

      if (total === 0) {
        return { r: 0, g: 0, b: 0, a: 0 }
      }

      return {
        r: red / total,
        g: green / total,
        b: blue / total,
        a: alpha / total
      }
    },
    {
      base64: raster.base64,
      region: targetRegion(region, raster)
    }
  )

const getRectProbeRegions = (raster: RasterCapture) => {
  const centerColumn = raster.padding + raster.elementWidth / 2 - 2
  const centerRow = raster.padding + raster.elementHeight / 2 - 2
  const bandWidth = 4
  const bandHeight = Math.max(2, raster.strokeWidthPx - 2)

  return {
    topInside: {
      x: centerColumn,
      y: raster.padding + 1,
      width: bandWidth,
      height: bandHeight
    },
    topOutside: {
      x: centerColumn,
      y: raster.padding - raster.strokeWidthPx + 1,
      width: bandWidth,
      height: bandHeight
    },
    center: {
      x: raster.padding + raster.elementWidth / 2 - 4,
      y: raster.padding + raster.elementHeight / 2 - 4,
      width: 8,
      height: 8
    },
    leftInside: {
      x: raster.padding + 1,
      y: centerRow,
      width: bandHeight,
      height: bandWidth
    },
    leftOutside: {
      x: raster.padding - raster.strokeWidthPx + 1,
      y: centerRow,
      width: bandHeight,
      height: bandWidth
    }
  }
}

const getRectRepeatedDashProbeRegions = (raster: RasterCapture) => {
  const bandWidth = 8
  const bandHeight = Math.max(2, raster.strokeWidthPx - 2)
  const firstDashColumn = raster.padding + 10 - bandWidth / 2

  return {
    topInsideFirstDash: {
      x: firstDashColumn,
      y: raster.padding + 1,
      width: bandWidth,
      height: bandHeight
    },
    topOutsideFirstDash: {
      x: firstDashColumn,
      y: raster.padding - raster.strokeWidthPx + 1,
      width: bandWidth,
      height: bandHeight
    },
    center: {
      x: raster.padding + raster.elementWidth / 2 - 4,
      y: raster.padding + raster.elementHeight / 2 - 4,
      width: 8,
      height: 8
    }
  }
}

const getRectGradientProbeRegions = (raster: RasterCapture) => {
  const bandWidth = Math.max(4, Math.round(raster.elementWidth * 0.08))
  const bandHeight = Math.max(2, raster.strokeWidthPx - 2)

  return {
    topOutsideLeft: {
      x: raster.padding + raster.elementWidth * 0.2 - bandWidth / 2,
      y: raster.padding - raster.strokeWidthPx + 1,
      width: bandWidth,
      height: bandHeight
    },
    topOutsideRight: {
      x: raster.padding + raster.elementWidth * 0.8 - bandWidth / 2,
      y: raster.padding - raster.strokeWidthPx + 1,
      width: bandWidth,
      height: bandHeight
    },
    topInsideLeft: {
      x: raster.padding + raster.elementWidth * 0.2 - bandWidth / 2,
      y: raster.padding + 1,
      width: bandWidth,
      height: bandHeight
    },
    topInsideRight: {
      x: raster.padding + raster.elementWidth * 0.8 - bandWidth / 2,
      y: raster.padding + 1,
      width: bandWidth,
      height: bandHeight
    },
    center: {
      x: raster.padding + raster.elementWidth / 2 - 4,
      y: raster.padding + raster.elementHeight / 2 - 4,
      width: 8,
      height: 8
    }
  }
}

const getMultiNetworkRectProbeRegions = (raster: RasterCapture) => {
  const bandWidth = 4
  const bandHeight = Math.max(2, raster.strokeWidthPx - 2)
  const firstNetworkCenterColumn =
    raster.padding + raster.elementWidth * 0.2 - 2
  const secondNetworkCenterColumn =
    raster.padding + raster.elementWidth * 0.8 - 2

  return {
    firstTopInside: {
      x: firstNetworkCenterColumn,
      y: raster.padding + 1,
      width: bandWidth,
      height: bandHeight
    },
    firstTopOutside: {
      x: firstNetworkCenterColumn,
      y: raster.padding - raster.strokeWidthPx + 1,
      width: bandWidth,
      height: bandHeight
    },
    secondTopInside: {
      x: secondNetworkCenterColumn,
      y: raster.padding + 1,
      width: bandWidth,
      height: bandHeight
    },
    secondTopOutside: {
      x: secondNetworkCenterColumn,
      y: raster.padding - raster.strokeWidthPx + 1,
      width: bandWidth,
      height: bandHeight
    },
    centerGap: {
      x: raster.padding + raster.elementWidth / 2 - 4,
      y: raster.padding + raster.elementHeight / 2 - 4,
      width: 8,
      height: 8
    }
  }
}

const getOpenLineProbeRegions = (raster: RasterCapture) => {
  const bandWidth = Math.max(4, Math.round(raster.elementWidth * 0.12))
  const bandHeight = Math.max(2, raster.strokeWidthPx - 2)
  const centerColumn = raster.padding + raster.elementWidth / 2 - bandWidth / 2
  const midlineY = raster.padding + raster.elementHeight / 2 - bandHeight / 2

  return {
    midline: {
      x: centerColumn,
      y: midlineY,
      width: bandWidth,
      height: bandHeight
    },
    aboveLine: {
      x: centerColumn,
      y: Math.max(raster.padding + 1, midlineY - raster.strokeWidthPx),
      width: bandWidth,
      height: bandHeight
    },
    belowLine: {
      x: centerColumn,
      y: Math.min(
        raster.padding + raster.elementHeight - bandHeight - 1,
        midlineY + raster.strokeWidthPx
      ),
      width: bandWidth,
      height: bandHeight
    }
  }
}

const getOpenDiagonalProbeRegions = (raster: RasterCapture) => ({
  strokeEnvelope: {
    x: raster.padding,
    y: raster.padding,
    width: raster.elementWidth,
    height: raster.elementHeight
  }
})

const getReportedStarGlobalProbeRegions = (raster: RasterCapture) => ({
  wholeStrokeEnvelope: {
    x: raster.padding,
    y: raster.padding,
    width: raster.elementWidth,
    height: raster.elementHeight
  },
  upperLeftArm: {
    x: raster.padding + raster.elementWidth * 0.02,
    y: raster.padding + raster.elementHeight * 0.02,
    width: raster.elementWidth * 0.3,
    height: raster.elementHeight * 0.28
  },
  upperRightArm: {
    x: raster.padding + raster.elementWidth * 0.52,
    y: raster.padding + raster.elementHeight * 0.02,
    width: raster.elementWidth * 0.43,
    height: raster.elementHeight * 0.42
  },
  centerCrossingBand: {
    x: raster.padding + raster.elementWidth * 0.22,
    y: raster.padding + raster.elementHeight * 0.24,
    width: raster.elementWidth * 0.5,
    height: raster.elementHeight * 0.46
  },
  lowerLeftCurve: {
    x: raster.padding + raster.elementWidth * 0.02,
    y: raster.padding + raster.elementHeight * 0.72,
    width: raster.elementWidth * 0.42,
    height: raster.elementHeight * 0.24
  },
  lowerRightArm: {
    x: raster.padding + raster.elementWidth * 0.48,
    y: raster.padding + raster.elementHeight * 0.58,
    width: raster.elementWidth * 0.38,
    height: raster.elementHeight * 0.34
  }
})

const getRectSingleEdgeProbeRegions = (raster: RasterCapture) => {
  const bandWidth = Math.max(4, Math.round(raster.elementWidth * 0.1))
  const bandHeight = Math.max(2, raster.strokeWidthPx - 2)
  const intervalX = raster.padding + raster.elementWidth * 0.3 - bandWidth / 2
  const laterGapX = raster.padding + raster.elementWidth * 0.72 - bandWidth / 2

  return {
    intervalInside: {
      x: intervalX,
      y: raster.padding + 1,
      width: bandWidth,
      height: bandHeight
    },
    intervalOutside: {
      x: intervalX,
      y: raster.padding - raster.strokeWidthPx + 1,
      width: bandWidth,
      height: bandHeight
    },
    laterTopInsideGap: {
      x: laterGapX,
      y: raster.padding + 1,
      width: bandWidth,
      height: bandHeight
    },
    laterTopOutsideGap: {
      x: laterGapX,
      y: raster.padding - raster.strokeWidthPx + 1,
      width: bandWidth,
      height: bandHeight
    },
    center: {
      x: raster.padding + raster.elementWidth / 2 - 4,
      y: raster.padding + raster.elementHeight / 2 - 4,
      width: 8,
      height: 8
    }
  }
}

const getRectSingleEdgeGradientProbeRegions = (raster: RasterCapture) => {
  const bandWidth = Math.max(4, Math.round(raster.elementWidth * 0.08))
  const bandHeight = Math.max(2, raster.strokeWidthPx - 2)
  const leftIntervalX =
    raster.padding + raster.elementWidth * 0.28 - bandWidth / 2
  const rightIntervalX =
    raster.padding + raster.elementWidth * 0.36 - bandWidth / 2
  const laterGapX = raster.padding + raster.elementWidth * 0.72 - bandWidth / 2

  return {
    intervalInsideLeft: {
      x: leftIntervalX,
      y: raster.padding + 1,
      width: bandWidth,
      height: bandHeight
    },
    intervalInsideRight: {
      x: rightIntervalX,
      y: raster.padding + 1,
      width: bandWidth,
      height: bandHeight
    },
    laterTopInsideGap: {
      x: laterGapX,
      y: raster.padding + 1,
      width: bandWidth,
      height: bandHeight
    },
    center: {
      x: raster.padding + raster.elementWidth / 2 - 4,
      y: raster.padding + raster.elementHeight / 2 - 4,
      width: 8,
      height: 8
    }
  }
}

const getRectSingleEdgeOutsideGradientProbeRegions = (
  raster: RasterCapture
) => {
  const bandWidth = Math.max(4, Math.round(raster.elementWidth * 0.08))
  const bandHeight = Math.max(2, raster.strokeWidthPx - 2)
  const leftIntervalX =
    raster.padding + raster.elementWidth * 0.28 - bandWidth / 2
  const rightIntervalX =
    raster.padding + raster.elementWidth * 0.36 - bandWidth / 2
  const laterGapX = raster.padding + raster.elementWidth * 0.72 - bandWidth / 2

  return {
    intervalOutsideLeft: {
      x: leftIntervalX,
      y: raster.padding - raster.strokeWidthPx + 1,
      width: bandWidth,
      height: bandHeight
    },
    intervalOutsideRight: {
      x: rightIntervalX,
      y: raster.padding - raster.strokeWidthPx + 1,
      width: bandWidth,
      height: bandHeight
    },
    laterTopOutsideGap: {
      x: laterGapX,
      y: raster.padding - raster.strokeWidthPx + 1,
      width: bandWidth,
      height: bandHeight
    },
    center: {
      x: raster.padding + raster.elementWidth / 2 - 4,
      y: raster.padding + raster.elementHeight / 2 - 4,
      width: 8,
      height: 8
    }
  }
}

const getRectSingleEdgeOutsideRoundCapProbeRegions = (
  raster: RasterCapture
) => {
  const bandWidth = Math.max(4, Math.round(raster.elementWidth * 0.08))
  const bandHeight = Math.max(2, raster.strokeWidthPx - 2)
  const capLeadX = raster.padding + raster.elementWidth * 0.2 - bandWidth / 2
  const bodyX = raster.padding + raster.elementWidth * 0.3 - bandWidth / 2
  const laterGapX = raster.padding + raster.elementWidth * 0.72 - bandWidth / 2

  return {
    capOutside: {
      x: capLeadX,
      y: raster.padding - raster.strokeWidthPx + 1,
      width: bandWidth,
      height: bandHeight
    },
    bodyOutside: {
      x: bodyX,
      y: raster.padding - raster.strokeWidthPx + 1,
      width: bandWidth,
      height: bandHeight
    },
    capInsideLeak: {
      x: capLeadX,
      y: raster.padding + 1,
      width: bandWidth,
      height: bandHeight
    },
    laterTopOutsideGap: {
      x: laterGapX,
      y: raster.padding - raster.strokeWidthPx + 1,
      width: bandWidth,
      height: bandHeight
    },
    center: {
      x: raster.padding + raster.elementWidth / 2 - 4,
      y: raster.padding + raster.elementHeight / 2 - 4,
      width: 8,
      height: 8
    }
  }
}

const getVectorRectSingleEdgeRoundCapProbeRegions = (raster: RasterCapture) => {
  const capBandWidth = 2
  const capBandHeight = 2
  const bandWidth = Math.max(3, raster.strokeWidthPx)
  const bandHeight = Math.max(2, raster.strokeWidthPx - 2)
  const capLeadX =
    raster.padding + raster.elementWidth * 0.25 - capBandWidth / 2
  const bodyX = raster.padding + raster.elementWidth * 0.3 - bandWidth / 2
  const laterGapX = raster.padding + raster.elementWidth * 0.72 - bandWidth / 2

  return {
    capInside: {
      x: capLeadX,
      y: raster.padding + 1,
      width: capBandWidth,
      height: capBandHeight
    },
    bodyInside: {
      x: bodyX,
      y: raster.padding + 1,
      width: bandWidth,
      height: bandHeight
    },
    capOutsideLeak: {
      x: capLeadX,
      y: raster.padding - raster.strokeWidthPx + 1,
      width: capBandWidth,
      height: capBandHeight
    },
    laterTopInsideGap: {
      x: laterGapX,
      y: raster.padding + 1,
      width: bandWidth,
      height: bandHeight
    },
    center: {
      x: raster.padding + raster.elementWidth / 2 - 4,
      y: raster.padding + raster.elementHeight / 2 - 4,
      width: 8,
      height: 8
    }
  }
}

const getVectorRectSingleEdgeOutsideRoundCapProbeRegions = (
  raster: RasterCapture
) => {
  const capBandWidth = 2
  const capBandHeight = 2
  const bandWidth = Math.max(3, raster.strokeWidthPx)
  const bandHeight = Math.max(2, raster.strokeWidthPx - 2)
  const capLeadX =
    raster.padding + raster.elementWidth * 0.25 - capBandWidth / 2
  const bodyX = raster.padding + raster.elementWidth * 0.3 - bandWidth / 2
  const laterGapX = raster.padding + raster.elementWidth * 0.72 - bandWidth / 2

  return {
    capOutside: {
      x: capLeadX,
      y: raster.padding - raster.strokeWidthPx + 1,
      width: capBandWidth,
      height: capBandHeight
    },
    bodyOutside: {
      x: bodyX,
      y: raster.padding - raster.strokeWidthPx + 1,
      width: bandWidth,
      height: bandHeight
    },
    capInsideLeak: {
      x: capLeadX,
      y: raster.padding + 1,
      width: capBandWidth,
      height: capBandHeight
    },
    laterTopOutsideGap: {
      x: laterGapX,
      y: raster.padding - raster.strokeWidthPx + 1,
      width: bandWidth,
      height: bandHeight
    },
    center: {
      x: raster.padding + raster.elementWidth / 2 - 4,
      y: raster.padding + raster.elementHeight / 2 - 4,
      width: 8,
      height: 8
    }
  }
}

const getRectCornerSpanningProbeRegions = (raster: RasterCapture) => {
  const bandWidth = Math.max(4, Math.round(raster.elementWidth * 0.1))
  const bandHeight = Math.max(2, raster.strokeWidthPx - 2)
  const topNearCornerX =
    raster.padding + raster.elementWidth * 0.86 - bandWidth / 2
  const topGapX = raster.padding + raster.elementWidth * 0.25 - bandWidth / 2

  return {
    topNearCornerInside: {
      x: topNearCornerX,
      y: raster.padding + 1,
      width: bandWidth,
      height: bandHeight
    },
    rightNearCornerInside: {
      x: raster.padding + raster.elementWidth - raster.strokeWidthPx + 1,
      y: raster.padding + raster.elementHeight * 0.3,
      width: bandHeight,
      height: bandWidth
    },
    topFarGap: {
      x: topGapX,
      y: raster.padding + 1,
      width: bandWidth,
      height: bandHeight
    },
    cornerOutsideLeak: {
      x: topNearCornerX,
      y: raster.padding - raster.strokeWidthPx + 1,
      width: bandWidth,
      height: bandHeight
    },
    topNearCornerOutside: {
      x: topNearCornerX,
      y: raster.padding - raster.strokeWidthPx + 1,
      width: bandWidth,
      height: bandHeight
    },
    rightNearCornerOutside: {
      x: raster.padding + raster.elementWidth + 1,
      y: raster.padding + raster.elementHeight * 0.3,
      width: bandHeight,
      height: bandWidth
    },
    cornerInsideLeak: {
      x: topNearCornerX,
      y: raster.padding + 1,
      width: bandWidth,
      height: bandHeight
    },
    center: {
      x: raster.padding + raster.elementWidth / 2 - 4,
      y: raster.padding + raster.elementHeight / 2 - 4,
      width: 8,
      height: 8
    }
  }
}

const getSharpSeamTriangleFirstDashProbeRegions = (raster: RasterCapture) => {
  const seam = { x: 40, y: 0 }
  const nextTangent = {
    x: 40 / Math.hypot(40, 100),
    y: 100 / Math.hypot(40, 100)
  }
  const previousTangent = {
    x: 40 / Math.hypot(40, 100),
    y: -100 / Math.hypot(40, 100)
  }
  const nextInsideNormal = { x: -nextTangent.y, y: nextTangent.x }
  const previousInsideNormal = {
    x: -previousTangent.y,
    y: previousTangent.x
  }
  const pointAt = (
    point: { x: number; y: number },
    tangent: { x: number; y: number },
    distance: number
  ) => ({
    x: point.x + tangent.x * distance,
    y: point.y + tangent.y * distance
  })
  const offsetPoint = (
    point: { x: number; y: number },
    normal: { x: number; y: number },
    distance: number
  ) => ({
    x: point.x + normal.x * distance,
    y: point.y + normal.y * distance
  })
  const regionAround = (
    point: { x: number; y: number },
    size = Math.max(4, raster.strokeWidthPx - 3)
  ) => ({
    x: raster.padding + point.x - size / 2,
    y: raster.padding + point.y - size / 2,
    width: size,
    height: size
  })

  const nextCore = pointAt(seam, nextTangent, 12)
  const nextGap = pointAt(seam, nextTangent, 58)
  const previousCore = pointAt(seam, previousTangent, -12)
  const insideOffset = Math.max(3, raster.strokeWidthPx * 0.42)
  const outsideOffset = -insideOffset

  return {
    nextInsideBody: regionAround(
      offsetPoint(nextCore, nextInsideNormal, insideOffset)
    ),
    nextOutsideBody: regionAround(
      offsetPoint(nextCore, nextInsideNormal, outsideOffset)
    ),
    previousOutsideBody: regionAround(
      offsetPoint(previousCore, previousInsideNormal, outsideOffset)
    ),
    outsideMiter: regionAround(
      { x: seam.x, y: seam.y - raster.strokeWidthPx / 2 },
      4
    ),
    laterInsideGap: regionAround(
      offsetPoint(nextGap, nextInsideNormal, insideOffset)
    ),
    laterOutsideGap: regionAround(
      offsetPoint(nextGap, nextInsideNormal, outsideOffset)
    ),
    center: regionAround(
      { x: raster.elementWidth / 2, y: raster.elementHeight * 0.6 },
      8
    )
  }
}

const getRectCornerSpanningGradientProbeRegions = (raster: RasterCapture) => {
  const bandWidth = Math.max(4, Math.round(raster.elementWidth * 0.1))
  const bandHeight = Math.max(2, raster.strokeWidthPx - 2)
  const topNearCornerLeftX =
    raster.padding + raster.elementWidth * 0.78 - bandWidth / 2
  const topNearCornerRightX =
    raster.padding + raster.elementWidth * 0.92 - bandWidth / 2

  return {
    topNearCornerLeft: {
      x: topNearCornerLeftX,
      y: raster.padding + 1,
      width: bandWidth,
      height: bandHeight
    },
    topNearCornerRight: {
      x: topNearCornerRightX,
      y: raster.padding + 1,
      width: bandWidth,
      height: bandHeight
    },
    rightNearCorner: {
      x: raster.padding + raster.elementWidth - raster.strokeWidthPx + 1,
      y: raster.padding + raster.elementHeight * 0.3,
      width: bandHeight,
      height: bandWidth
    },
    topFarGap: {
      x: raster.padding + raster.elementWidth * 0.25 - bandWidth / 2,
      y: raster.padding + 1,
      width: bandWidth,
      height: bandHeight
    },
    cornerOutsideLeak: {
      x: topNearCornerRightX,
      y: raster.padding - raster.strokeWidthPx + 1,
      width: bandWidth,
      height: bandHeight
    },
    center: {
      x: raster.padding + raster.elementWidth / 2 - 4,
      y: raster.padding + raster.elementHeight / 2 - 4,
      width: 8,
      height: 8
    }
  }
}

const getRectCornerSpanningOutsideGradientProbeRegions = (
  raster: RasterCapture
) => {
  const bandWidth = Math.max(4, Math.round(raster.elementWidth * 0.1))
  const bandHeight = Math.max(2, raster.strokeWidthPx - 2)
  const topNearCornerLeftX =
    raster.padding + raster.elementWidth * 0.78 - bandWidth / 2
  const topNearCornerRightX =
    raster.padding + raster.elementWidth * 0.92 - bandWidth / 2

  return {
    topNearCornerOutsideLeft: {
      x: topNearCornerLeftX,
      y: raster.padding - raster.strokeWidthPx + 1,
      width: bandWidth,
      height: bandHeight
    },
    topNearCornerOutsideRight: {
      x: topNearCornerRightX,
      y: raster.padding - raster.strokeWidthPx + 1,
      width: bandWidth,
      height: bandHeight
    },
    rightNearCornerOutside: {
      x: raster.padding + raster.elementWidth + 1,
      y: raster.padding + raster.elementHeight * 0.3,
      width: bandHeight,
      height: bandWidth
    },
    topFarGap: {
      x: raster.padding + raster.elementWidth * 0.25 - bandWidth / 2,
      y: raster.padding - raster.strokeWidthPx + 1,
      width: bandWidth,
      height: bandHeight
    },
    cornerInsideLeak: {
      x: topNearCornerRightX,
      y: raster.padding + 1,
      width: bandWidth,
      height: bandHeight
    },
    center: {
      x: raster.padding + raster.elementWidth / 2 - 4,
      y: raster.padding + raster.elementHeight / 2 - 4,
      width: 8,
      height: 8
    }
  }
}

const getTrapezoidCornerSpanningProbeRegions = (raster: RasterCapture) => {
  const bandWidth = Math.max(4, Math.round(raster.elementWidth * 0.1))
  const bandHeight = Math.max(2, raster.strokeWidthPx - 2)
  const topNearCornerX =
    raster.padding + raster.elementWidth * 0.84 - bandWidth / 2
  const topGapX = raster.padding + raster.elementWidth * 0.25 - bandWidth / 2
  const slantedNearCornerX =
    raster.padding + raster.elementWidth * 0.83 - bandHeight / 2
  const slantedNearCornerY =
    raster.padding + raster.elementHeight * 0.26 - bandWidth / 2

  return {
    topNearCornerInside: {
      x: topNearCornerX,
      y: raster.padding + 1,
      width: bandWidth,
      height: bandHeight
    },
    slantedNearCornerInside: {
      x: slantedNearCornerX,
      y: slantedNearCornerY,
      width: bandHeight,
      height: bandWidth
    },
    topFarGap: {
      x: topGapX,
      y: raster.padding + 1,
      width: bandWidth,
      height: bandHeight
    },
    cornerOutsideLeak: {
      x: topNearCornerX,
      y: raster.padding - raster.strokeWidthPx + 1,
      width: bandWidth,
      height: bandHeight
    },
    topNearCornerOutside: {
      x: topNearCornerX,
      y: raster.padding - raster.strokeWidthPx + 1,
      width: bandWidth,
      height: bandHeight
    },
    slantedNearCornerOutside: {
      x: raster.padding + raster.elementWidth * 0.965 - bandHeight / 2,
      y: slantedNearCornerY,
      width: bandHeight,
      height: bandWidth
    },
    cornerInsideLeak: {
      x: topNearCornerX,
      y: raster.padding + 1,
      width: bandWidth,
      height: bandHeight
    },
    center: {
      x: raster.padding + raster.elementWidth / 2 - 4,
      y: raster.padding + raster.elementHeight / 2 - 4,
      width: 8,
      height: 8
    }
  }
}

const getTrapezoidCornerSpanningGradientProbeRegions = (
  raster: RasterCapture
) => {
  const bandWidth = Math.max(4, Math.round(raster.elementWidth * 0.1))
  const bandHeight = Math.max(2, raster.strokeWidthPx - 2)
  const topNearCornerLeftX =
    raster.padding + raster.elementWidth * 0.74 - bandWidth / 2
  const topNearCornerRightX =
    raster.padding + raster.elementWidth * 0.88 - bandWidth / 2
  const slantedNearCornerX =
    raster.padding + raster.elementWidth * 0.83 - bandHeight / 2
  const slantedNearCornerY =
    raster.padding + raster.elementHeight * 0.26 - bandWidth / 2

  return {
    topNearCornerLeft: {
      x: topNearCornerLeftX,
      y: raster.padding + 1,
      width: bandWidth,
      height: bandHeight
    },
    topNearCornerRight: {
      x: topNearCornerRightX,
      y: raster.padding + 1,
      width: bandWidth,
      height: bandHeight
    },
    slantedNearCorner: {
      x: slantedNearCornerX,
      y: slantedNearCornerY,
      width: bandHeight,
      height: bandWidth
    },
    topFarGap: {
      x: raster.padding + raster.elementWidth * 0.25 - bandWidth / 2,
      y: raster.padding + 1,
      width: bandWidth,
      height: bandHeight
    },
    cornerOutsideLeak: {
      x: topNearCornerRightX,
      y: raster.padding - raster.strokeWidthPx + 1,
      width: bandWidth,
      height: bandHeight
    },
    center: {
      x: raster.padding + raster.elementWidth / 2 - 4,
      y: raster.padding + raster.elementHeight / 2 - 4,
      width: 8,
      height: 8
    }
  }
}

const getOvalProbeRegions = (raster: RasterCapture) => {
  const centerColumn = raster.padding + raster.elementWidth / 2 - 2
  const centerRow = raster.padding + raster.elementHeight / 2 - 2
  const bandWidth = 4
  const bandHeight = Math.max(2, raster.strokeWidthPx - 2)

  return {
    topInside: {
      x: centerColumn,
      y: raster.padding + 2,
      width: bandWidth,
      height: bandHeight
    },
    topOutside: {
      x: centerColumn,
      y: raster.padding - raster.strokeWidthPx + 2,
      width: bandWidth,
      height: bandHeight
    },
    leftInside: {
      x: raster.padding + 2,
      y: centerRow,
      width: bandHeight,
      height: bandWidth
    },
    leftOutside: {
      x: raster.padding - raster.strokeWidthPx + 2,
      y: centerRow,
      width: bandHeight,
      height: bandWidth
    },
    center: {
      x: raster.padding + raster.elementWidth / 2 - 4,
      y: raster.padding + raster.elementHeight / 2 - 4,
      width: 8,
      height: 8
    }
  }
}

const ensureSelectedStrokeRow = async (page: Page, strokeIndex = 0) => {
  const propertiesPanel = getPropertiesPanel(page)
  const targetRow = propertiesPanel.getByTestId(`prop-stroke-${strokeIndex}`)

  while ((await targetRow.count()) === 0) {
    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await page.waitForTimeout(120)
  }

  await expect(targetRow).toBeVisible()
}

const patchSelectedVectorToClosedRectangle = async (page: Page) => {
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
      b: { id: 'b', kind: 'anchor', x: 80, y: 0, anchorType: 'sharp' },
      c: { id: 'c', kind: 'anchor', x: 80, y: 40, anchorType: 'sharp' },
      d: { id: 'd', kind: 'anchor', x: 0, y: 40, anchorType: 'sharp' }
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
        width: 80,
        height: 40
      },
      { undoable: false }
    )
  })

  await setSelectedElementSize(page, { width: 80, height: 40 })
  await page.waitForTimeout(180)
}

const patchSelectedVectorToClosedSharpSeamTriangle = async (page: Page) => {
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
      a: { id: 'a', kind: 'anchor', x: 40, y: 0, anchorType: 'sharp' },
      b: { id: 'b', kind: 'anchor', x: 80, y: 100, anchorType: 'sharp' },
      c: { id: 'c', kind: 'anchor', x: 0, y: 100, anchorType: 'sharp' }
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
      ca: {
        id: 'ca',
        startId: 'c',
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
            pointIds: ['a', 'b', 'c'],
            segmentIds: ['ab', 'bc', 'ca'],
            closed: true
          }
        },
        closed: true,
        width: 80,
        height: 100
      },
      { undoable: false }
    )
  })

  await page.waitForTimeout(180)
}

const patchSelectedVectorToClosedTrapezoid = async (page: Page) => {
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
      b: { id: 'b', kind: 'anchor', x: 80, y: 0, anchorType: 'sharp' },
      c: { id: 'c', kind: 'anchor', x: 60, y: 40, anchorType: 'sharp' },
      d: { id: 'd', kind: 'anchor', x: 0, y: 40, anchorType: 'sharp' }
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
        width: 80,
        height: 40
      },
      { undoable: false }
    )
  })

  await page.waitForTimeout(180)
}

const buildLongShortSegmentFixture = (
  segmentCount = 36
): LongShortSegmentFixture => {
  const center = { x: 260, y: 220 }
  const points: Record<string, VectorTopologyPoint> = {}
  const segments: Record<string, VectorTopologySegment> = {}
  const pointIds: string[] = []
  const segmentIds: string[] = []
  const sourcePath: { x: number; y: number }[] = []

  for (let index = 0; index < segmentCount; index += 1) {
    const angle = (Math.PI * 2 * index) / segmentCount
    const radiusX = 185 + (index % 5 === 0 ? 18 : index % 4 === 0 ? -12 : 0)
    const radiusY = 145 + (index % 6 === 0 ? -14 : index % 3 === 0 ? 10 : 0)
    const pointId = `sp-${index}`
    pointIds.push(pointId)
    points[pointId] = {
      id: pointId,
      kind: 'anchor',
      x: center.x + Math.cos(angle) * radiusX,
      y: center.y + Math.sin(angle) * radiusY,
      anchorType: index % 4 === 0 || index % 7 === 0 ? 'sharp' : 'smooth'
    }
  }

  for (let index = 0; index < segmentCount; index += 1) {
    const startId = `sp-${index}`
    const endId = `sp-${(index + 1) % segmentCount}`
    const segmentId = `ss-${index}`
    const start = points[startId]
    const end = points[endId]
    const useCubic = index % 2 === 0 || index % 5 === 0
    let outControlId: string | null = null
    let inControlId: string | null = null

    if (useCubic) {
      const dx = end.x - start.x
      const dy = end.y - start.y
      const bend = index % 5 === 0 ? 0.12 : 0.07
      outControlId = `${segmentId}-out`
      inControlId = `${segmentId}-in`
      points[outControlId] = {
        id: outControlId,
        kind: 'control',
        x: start.x + dx * 0.35 - dy * bend,
        y: start.y + dy * 0.35 + dx * bend
      }
      points[inControlId] = {
        id: inControlId,
        kind: 'control',
        x: end.x - dx * 0.35 - dy * bend,
        y: end.y - dy * 0.35 + dx * bend
      }
      pointIds.push(outControlId, inControlId)
    }

    segments[segmentId] = {
      id: segmentId,
      startId,
      endId,
      outControlId,
      inControlId
    }
    segmentIds.push(segmentId)

    if (useCubic && outControlId && inControlId) {
      appendSampledSegment(
        sourcePath,
        (t) =>
          cubicPoint(
            start,
            points[outControlId as string],
            points[inControlId as string],
            end,
            t
          ),
        10
      )
    } else {
      appendSampledSegment(sourcePath, (t) => lerpPoint(start, end, t), 1)
    }
  }

  return {
    points,
    segments,
    network: {
      pointIds,
      segmentIds,
      closed: true
    },
    sourcePath,
    totalLength: getPolylineLength(sourcePath)
  }
}

const patchSelectedVectorToLongShortSegments = async (page: Page) => {
  const fixture = buildLongShortSegmentFixture()

  await page.evaluate((fixture) => {
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

    core?.changeComputedData?.(
      [selectedId],
      {
        points: fixture.points,
        segments: fixture.segments,
        networks: {
          [primaryNetwork.id]: {
            ...fixture.network,
            id: primaryNetwork.id
          }
        },
        closed: true,
        width: 520,
        height: 430
      },
      { undoable: false }
    )
  }, fixture)

  await page.waitForTimeout(180)
}

const patchSelectedVectorToSelfIntersecting = async (page: Page) => {
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
      b: { id: 'b', kind: 'anchor', x: 40, y: 40, anchorType: 'sharp' },
      c: { id: 'c', kind: 'anchor', x: 0, y: 40, anchorType: 'sharp' },
      d: { id: 'd', kind: 'anchor', x: 40, y: 0, anchorType: 'sharp' }
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
        width: 40,
        height: 40
      },
      { undoable: false }
    )
  })

  await page.waitForTimeout(180)
}

const patchSelectedVectorToClosedCubicLoop = async (page: Page) => {
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
      a: { id: 'a', kind: 'anchor', x: 40, y: 0, anchorType: 'smooth' },
      b: { id: 'b', kind: 'anchor', x: 80, y: 40, anchorType: 'smooth' },
      c: { id: 'c', kind: 'anchor', x: 40, y: 80, anchorType: 'smooth' },
      d: { id: 'd', kind: 'anchor', x: 0, y: 40, anchorType: 'smooth' },
      aIn: { id: 'aIn', kind: 'control', x: 18, y: 0, controlRole: 'in' },
      aOut: { id: 'aOut', kind: 'control', x: 62, y: 0, controlRole: 'out' },
      bIn: { id: 'bIn', kind: 'control', x: 80, y: 18, controlRole: 'in' },
      bOut: { id: 'bOut', kind: 'control', x: 80, y: 62, controlRole: 'out' },
      cIn: { id: 'cIn', kind: 'control', x: 62, y: 80, controlRole: 'in' },
      cOut: { id: 'cOut', kind: 'control', x: 18, y: 80, controlRole: 'out' },
      dIn: { id: 'dIn', kind: 'control', x: 0, y: 62, controlRole: 'in' },
      dOut: { id: 'dOut', kind: 'control', x: 0, y: 18, controlRole: 'out' }
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
        inControlId: 'cIn'
      },
      cd: {
        id: 'cd',
        startId: 'c',
        endId: 'd',
        outControlId: 'cOut',
        inControlId: 'dIn'
      },
      da: {
        id: 'da',
        startId: 'd',
        endId: 'a',
        outControlId: 'dOut',
        inControlId: 'aIn'
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
        width: 80,
        height: 80
      },
      { undoable: false }
    )
  })

  await page.waitForTimeout(180)
}

const patchSelectedVectorToReportedClosedStar = async (page: Page) => {
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
      'tp-56': {
        id: 'tp-56',
        kind: 'anchor',
        x: 246.91886685202462,
        y: 0,
        anchorType: 'sharp'
      },
      'tp-57': {
        id: 'tp-57',
        kind: 'anchor',
        x: 75.04396933738008,
        y: 457.5261356375752,
        anchorType: 'smooth'
      },
      'tp-56:out': {
        id: 'tp-56:out',
        kind: 'control',
        x: 195.9809570843745,
        y: 149.61104635348715,
        controlRole: 'out'
      },
      'tp-57:in': {
        id: 'tp-57:in',
        kind: 'control',
        x: -46.963000165973426,
        y: 476.8923212730281,
        controlRole: 'in'
      },
      'tp-57:out': {
        id: 'tp-57:out',
        kind: 'control',
        x: 227.55268121657173,
        y: 433.3184035932593,
        controlRole: 'out'
      },
      'tp-58': {
        id: 'tp-58',
        kind: 'anchor',
        x: 423.6353107755326,
        y: 198.5034027633924,
        anchorType: 'sharp'
      },
      'tp-59': {
        id: 'tp-59',
        kind: 'anchor',
        x: 0,
        y: 91.98938176840147,
        anchorType: 'sharp'
      },
      'tp-60': {
        id: 'tp-60',
        kind: 'anchor',
        x: 307.43819696281525,
        y: 428.4768571843963,
        anchorType: 'smooth'
      },
      'tp-59:out': {
        id: 'tp-59:out',
        kind: 'control',
        x: 0,
        y: 91.98938176840147,
        controlRole: 'out'
      },
      'tp-60:in': {
        id: 'tp-60:in',
        kind: 'control',
        x: 275.9681453052044,
        y: 498.6792801129134,
        controlRole: 'in'
      },
      'tp-60:out': {
        id: 'tp-60:out',
        kind: 'control',
        x: 338.9082486204261,
        y: 358.2744342558792,
        controlRole: 'out'
      }
    }

    const nextSegments = {
      'ts-95': {
        id: 'ts-95',
        startId: 'tp-56',
        endId: 'tp-57',
        outControlId: 'tp-56:out',
        inControlId: 'tp-57:in'
      },
      'ts-96': {
        id: 'ts-96',
        startId: 'tp-57',
        endId: 'tp-58',
        outControlId: 'tp-57:out',
        inControlId: null
      },
      'ts-97': {
        id: 'ts-97',
        startId: 'tp-58',
        endId: 'tp-59',
        outControlId: null,
        inControlId: null
      },
      'ts-98': {
        id: 'ts-98',
        startId: 'tp-59',
        endId: 'tp-60',
        outControlId: 'tp-59:out',
        inControlId: 'tp-60:in'
      },
      'ts-99': {
        id: 'ts-99',
        startId: 'tp-60',
        endId: 'tp-56',
        outControlId: 'tp-60:out',
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
            pointIds: ['tp-56', 'tp-57', 'tp-58', 'tp-59', 'tp-60'],
            segmentIds: ['ts-95', 'ts-96', 'ts-97', 'ts-98', 'ts-99'],
            closed: true
          }
        },
        closed: true,
        width: 423.6353107755326,
        height: 458.34939129152076
      },
      { undoable: false }
    )
  })

  await page.waitForTimeout(180)
}

const patchSelectedVectorToOpenLine = async (page: Page) => {
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
      a: { id: 'a', kind: 'anchor', x: 0, y: 10, anchorType: 'sharp' },
      b: { id: 'b', kind: 'anchor', x: 40, y: 10, anchorType: 'sharp' }
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
        width: 40,
        height: 20
      },
      { undoable: false }
    )
  })

  await page.waitForTimeout(180)
}

const patchSelectedVectorToMultiNetworkRectangles = async (page: Page) => {
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const selectedId = core?.deps?.selection?.getElementSelectionIds?.()?.[0]
    if (!selectedId) {
      throw new Error('No selected vector to patch')
    }

    const element = core?.deps?.sceneTree?.getElementById?.(selectedId)
    const computed = element?.getAllComputedData?.()
    if (!computed) {
      throw new Error('Missing vector topology')
    }

    const nextPoints = {
      a0: { id: 'a0', kind: 'anchor', x: 0, y: 0, anchorType: 'sharp' },
      a1: { id: 'a1', kind: 'anchor', x: 40, y: 0, anchorType: 'sharp' },
      a2: { id: 'a2', kind: 'anchor', x: 40, y: 40, anchorType: 'sharp' },
      a3: { id: 'a3', kind: 'anchor', x: 0, y: 40, anchorType: 'sharp' },
      b0: { id: 'b0', kind: 'anchor', x: 60, y: 0, anchorType: 'sharp' },
      b1: { id: 'b1', kind: 'anchor', x: 100, y: 0, anchorType: 'sharp' },
      b2: { id: 'b2', kind: 'anchor', x: 100, y: 40, anchorType: 'sharp' },
      b3: { id: 'b3', kind: 'anchor', x: 60, y: 40, anchorType: 'sharp' }
    }

    const nextSegments = {
      a01: {
        id: 'a01',
        startId: 'a0',
        endId: 'a1',
        outControlId: null,
        inControlId: null
      },
      a12: {
        id: 'a12',
        startId: 'a1',
        endId: 'a2',
        outControlId: null,
        inControlId: null
      },
      a23: {
        id: 'a23',
        startId: 'a2',
        endId: 'a3',
        outControlId: null,
        inControlId: null
      },
      a30: {
        id: 'a30',
        startId: 'a3',
        endId: 'a0',
        outControlId: null,
        inControlId: null
      },
      b01: {
        id: 'b01',
        startId: 'b0',
        endId: 'b1',
        outControlId: null,
        inControlId: null
      },
      b12: {
        id: 'b12',
        startId: 'b1',
        endId: 'b2',
        outControlId: null,
        inControlId: null
      },
      b23: {
        id: 'b23',
        startId: 'b2',
        endId: 'b3',
        outControlId: null,
        inControlId: null
      },
      b30: {
        id: 'b30',
        startId: 'b3',
        endId: 'b0',
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
          'network-a': {
            id: 'network-a',
            pointIds: ['a0', 'a1', 'a2', 'a3'],
            segmentIds: ['a01', 'a12', 'a23', 'a30'],
            closed: true
          },
          'network-b': {
            id: 'network-b',
            pointIds: ['b0', 'b1', 'b2', 'b3'],
            segmentIds: ['b01', 'b12', 'b23', 'b30'],
            closed: true
          }
        },
        closed: true,
        width: 100,
        height: 40
      },
      { undoable: false }
    )
  })

  await page.waitForTimeout(180)
}

const ensureElementSelected = async (
  page: Page,
  expectedType?: 'rect' | 'oval' | 'vector'
) => {
  await page.evaluate(
    ({ expectedType }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      const selectedIds =
        core?.deps?.selection?.getElementSelectionIds?.() ?? []
      if (selectedIds.length > 0) {
        return
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

const setSelectedElementRotation = async (page: Page, rotation: number) => {
  await page.evaluate(
    ({ rotation }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      const selectedId = core?.deps?.selection?.getElementSelectionIds?.()?.[0]
      if (!selectedId) {
        throw new Error('No selected element to rotate')
      }

      const element = core?.deps?.sceneTree?.getElementById?.(selectedId)
      element?.updateComputedData?.('rotation', rotation, { undoable: false })
    },
    { rotation }
  )

  await page.waitForTimeout(120)
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

const createTwoPointVectorPath = async (page: Page) => {
  const first = await getCanvasPosition(page, 0.3, 0.3)
  const second = await getCanvasPosition(page, 0.42, 0.38)

  await page.keyboard.press('p')
  await page.waitForTimeout(100)
  await page.mouse.click(first.x, first.y)
  await page.waitForTimeout(120)
  await page.mouse.click(second.x, second.y)
  await page.waitForTimeout(240)
  await page.keyboard.press('v')
  await page.waitForTimeout(120)
}

const configureCenterDashedStroke = async (
  page: Page,
  config: {
    elementType?: 'rect' | 'oval' | 'vector'
    join?: 'miter' | 'bevel' | 'round'
    cap?: 'butt' | 'square' | 'round'
    pattern?: string
    offset?: string
    width?: number
  }
) => {
  await ensureElementSelected(page, config.elementType)
  const propertiesPanel = getPropertiesPanel(page)
  await ensureSelectedStrokeRow(page, 0)

  await propertiesPanel
    .getByTestId('prop-stroke-style-0')
    .selectOption('dashed')
  await propertiesPanel
    .getByTestId('prop-stroke-position-0')
    .selectOption('center')
  await propertiesPanel
    .getByTestId('prop-stroke-join-0')
    .selectOption(config.join ?? 'bevel')
  await propertiesPanel
    .getByTestId('prop-stroke-cap-0')
    .selectOption(config.cap ?? 'butt')
  await propertiesPanel
    .getByTestId('prop-stroke-width-0')
    .fill(String(config.width ?? STROKE_WIDTH))
  await propertiesPanel.getByTestId('prop-stroke-width-0').press('Enter')
  await fillStrokeDashGap(
    propertiesPanel,
    0,
    config.pattern ?? FULL_LOOP_PATTERN
  )
  if (Number(config.offset ?? '0') !== 0) {
    await patchSelectedStrokeDashOffset(page, 0, config.offset ?? '0')
  }
  await propertiesPanel.getByTestId('prop-stroke-color-0').fill(STROKE_COLOR)
  await propertiesPanel.getByTestId('prop-stroke-color-0').press('Enter')
  await page.waitForTimeout(180)
}

const setSelectedStrokePosition = async (
  page: Page,
  position: 'center' | 'inside' | 'outside'
) => {
  const propertiesPanel = getPropertiesPanel(page)
  await propertiesPanel
    .getByTestId('prop-stroke-position-0')
    .selectOption(position)
  await page.waitForTimeout(180)
}

const configureConstrainedDashedStroke = async (
  page: Page,
  config: {
    elementType?: 'rect' | 'oval' | 'vector'
    position: 'inside' | 'outside'
    join?: 'miter' | 'bevel' | 'round'
    cap?: 'butt' | 'square' | 'round'
    pattern?: string
    offset?: string
    width?: number
  }
) => {
  await ensureElementSelected(page, config.elementType)
  await configureConstrainedDashedStrokeRow(page, 0, config)
  await page.waitForTimeout(180)
}

const configureConstrainedDashedStrokeRow = async (
  page: Page,
  strokeIndex: number,
  config: {
    elementType?: 'rect' | 'oval' | 'vector'
    position: 'inside' | 'outside'
    join?: 'miter' | 'bevel' | 'round'
    cap?: 'butt' | 'square' | 'round'
    pattern?: string
    offset?: string
    width?: number
  }
) => {
  await ensureElementSelected(page, config.elementType)
  const propertiesPanel = getPropertiesPanel(page)
  await ensureSelectedStrokeRow(page, strokeIndex)

  await propertiesPanel
    .getByTestId(`prop-stroke-style-${strokeIndex}`)
    .selectOption('dashed')
  await propertiesPanel
    .getByTestId(`prop-stroke-position-${strokeIndex}`)
    .selectOption(config.position)
  await propertiesPanel
    .getByTestId(`prop-stroke-join-${strokeIndex}`)
    .selectOption(config.join ?? 'bevel')
  await propertiesPanel
    .getByTestId(`prop-stroke-cap-${strokeIndex}`)
    .selectOption(config.cap ?? 'butt')
  await propertiesPanel
    .getByTestId(`prop-stroke-width-${strokeIndex}`)
    .fill(String(config.width ?? STROKE_WIDTH))
  await propertiesPanel
    .getByTestId(`prop-stroke-width-${strokeIndex}`)
    .press('Enter')
  await fillStrokeDashGap(
    propertiesPanel,
    strokeIndex,
    config.pattern ?? FULL_LOOP_PATTERN
  )
  if (Number(config.offset ?? '0') !== 0) {
    await patchSelectedStrokeDashOffset(page, strokeIndex, config.offset ?? '0')
  }
  await propertiesPanel
    .getByTestId(`prop-stroke-color-${strokeIndex}`)
    .fill(STROKE_COLOR)
  await propertiesPanel
    .getByTestId(`prop-stroke-color-${strokeIndex}`)
    .press('Enter')
}

const getSelectedStrokeRowSnapshot = async (page: Page, strokeIndex: number) =>
  page.evaluate((index) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const selectedId = core?.deps?.selection?.getElementSelectionIds?.()?.[0]
    if (!selectedId) {
      throw new Error('No selected element for stroke snapshot')
    }

    const element = core?.deps?.sceneTree?.getElementById?.(selectedId)
    const computed = element?.getAllComputedData?.() ?? {}
    const stroke = Array.isArray(computed.strokes)
      ? computed.strokes[index]
      : undefined

    if (!stroke) {
      throw new Error(`Missing selected stroke row ${index}`)
    }

    return {
      style: stroke.style,
      position: stroke.position,
      width: stroke.width,
      dashPattern: stroke.dashPattern,
      joinType: stroke.joinType,
      capType: stroke.capType
    }
  }, strokeIndex)

const patchSelectedStrokeRowToLinearGradient = async (
  page: Page,
  strokeIndex: number
) => {
  await page.evaluate(
    ({ strokeIndex, gradient }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      const selectedId = core?.deps?.selection?.getElementSelectionIds?.()?.[0]
      if (!selectedId) {
        throw new Error('No selected element to patch stroke gradient')
      }

      const element = core?.deps?.sceneTree?.getElementById?.(selectedId)
      const computed = element?.getAllComputedData?.() ?? {}
      const nextStrokes = Array.isArray(computed?.strokes)
        ? computed.strokes.map(
            (stroke: Record<string, unknown>, index: number) =>
              index === strokeIndex
                ? {
                    ...stroke,
                    kind: 'gradient',
                    gradient
                  }
                : stroke
          )
        : null

      if (!nextStrokes) {
        throw new Error(`Missing stroke row ${strokeIndex}`)
      }

      core?.changeComputedData?.(
        [selectedId],
        {
          strokes: nextStrokes
        },
        { undoable: false }
      )
    },
    {
      strokeIndex,
      gradient: DEFAULT_STROKE_GRADIENT
    }
  )

  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const selectedId = core?.deps?.selection?.getElementSelectionIds?.()?.[0]
    if (!selectedId) {
      throw new Error('No selected element to sync render data')
    }

    const element = core?.deps?.sceneTree?.getElementById?.(selectedId)
    const computed = element?.getAllComputedData?.()
    const saved = element?.save?.()

    if (!computed || !saved) {
      throw new Error('Missing selected element render data')
    }

    core?.deps?.render?.updateElement?.(
      selectedId,
      'computed',
      undefined,
      undefined,
      {
        ...saved,
        ...computed
      }
    )
  })

  await page.waitForTimeout(180)
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

test.describe('constrained dashed corner and source-equivalence matrix', () => {
  test('benchmark: closed rectangle-equivalent vector inside bevel corner-spanning constrained dashed stroke renders through the first vector corner-spanning topology family product path', async ({
    page
  }) => {
    await createVectorPath(page, 0.3, 0.3, 0.1, 0.1)
    await clearVectorOverlayState(page)
    await ensureElementSelected(page, 'vector')
    await patchSelectedVectorToClosedRectangle(page)
    await setSelectedElementRotation(page, 0)
    await configureConstrainedDashedStroke(page, {
      elementType: 'vector',
      position: 'inside',
      join: 'bevel',
      cap: 'butt',
      pattern: ORTHOGONAL_80X40_CORNER_SPANNING_PATTERN,
      offset: ORTHOGONAL_80X40_CORNER_SPANNING_OFFSET
    })

    const raster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const probes = getRectCornerSpanningProbeRegions(raster)

    const [
      topNearCornerInside,
      rightNearCornerInside,
      topFarGap,
      cornerOutsideLeak,
      center
    ] = await Promise.all([
      getGreenCoverage(page, raster, probes.topNearCornerInside),
      getGreenCoverage(page, raster, probes.rightNearCornerInside),
      getGreenCoverage(page, raster, probes.topFarGap),
      getGreenCoverage(page, raster, probes.cornerOutsideLeak),
      getGreenCoverage(page, raster, probes.center)
    ])

    expect(topNearCornerInside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(rightNearCornerInside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(topFarGap).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
    expect(cornerOutsideLeak).toBeLessThan(MAX_EXTERIOR_LEAK)
    expect(center).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
  })

  test('benchmark: closed rectangle-equivalent vector inside bevel corner-spanning constrained dashed gradient stroke renders through the one-sided candidate paint vector path', async ({
    page
  }) => {
    await createVectorPath(page, 0.3, 0.3, 0.1, 0.1)
    await clearVectorOverlayState(page)
    await ensureElementSelected(page, 'vector')
    await patchSelectedVectorToClosedRectangle(page)
    await setSelectedElementRotation(page, 0)
    await configureConstrainedDashedStroke(page, {
      elementType: 'vector',
      position: 'inside',
      join: 'bevel',
      cap: 'butt',
      pattern: ORTHOGONAL_80X40_CORNER_SPANNING_PATTERN,
      offset: ORTHOGONAL_80X40_CORNER_SPANNING_OFFSET
    })
    await patchSelectedStrokeRowToLinearGradient(page, 0)

    const raster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const probes = getRectCornerSpanningGradientProbeRegions(raster)

    const [
      topNearCornerLeft,
      topNearCornerRight,
      rightNearCorner,
      topFarGap,
      cornerOutsideLeak,
      center
    ] = await Promise.all([
      getAverageColor(page, raster, probes.topNearCornerLeft),
      getAverageColor(page, raster, probes.topNearCornerRight),
      getAverageColor(page, raster, probes.rightNearCorner),
      getAverageColor(page, raster, probes.topFarGap),
      getAverageColor(page, raster, probes.cornerOutsideLeak),
      getAverageColor(page, raster, probes.center)
    ])

    expect(topNearCornerLeft.a).toBeGreaterThan(180)
    expect(topNearCornerRight.a).toBeGreaterThan(180)
    expect(rightNearCorner.a).toBeGreaterThan(180)
    expect(getRedBlueSkew(topNearCornerLeft)).toBeGreaterThan(
      getRedBlueSkew(topNearCornerRight) + 15
    )
    expect(topNearCornerLeft.r).toBeGreaterThan(topNearCornerLeft.b + 40)
    expect(topNearCornerRight.b).toBeGreaterThan(80)
    expect(Math.abs(getRedBlueSkew(topFarGap))).toBeLessThan(20)
    expect(topFarGap.r).toBeLessThan(80)
    expect(topFarGap.g).toBeLessThan(80)
    expect(topFarGap.b).toBeLessThan(80)
    expect(cornerOutsideLeak.r).toBeLessThan(80)
    expect(cornerOutsideLeak.g).toBeLessThan(80)
    expect(cornerOutsideLeak.b).toBeLessThan(80)
    expect(center.r).toBeLessThan(80)
    expect(center.g).toBeLessThan(80)
    expect(center.b).toBeLessThan(80)
  })

  test('benchmark: closed rectangle-equivalent vector inside miter corner-spanning constrained dashed stroke renders through the matching vector corner-spanning topology family product path', async ({
    page
  }) => {
    await createVectorPath(page, 0.3, 0.3, 0.1, 0.1)
    await clearVectorOverlayState(page)
    await ensureElementSelected(page, 'vector')
    await patchSelectedVectorToClosedRectangle(page)
    await configureConstrainedDashedStroke(page, {
      elementType: 'vector',
      position: 'inside',
      join: 'miter',
      cap: 'butt',
      pattern: ORTHOGONAL_80X40_CORNER_SPANNING_PATTERN,
      offset: ORTHOGONAL_80X40_CORNER_SPANNING_OFFSET
    })

    const raster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const probes = getRectCornerSpanningProbeRegions(raster)

    const [
      topNearCornerInside,
      rightNearCornerInside,
      topFarGap,
      cornerOutsideLeak,
      center
    ] = await Promise.all([
      getGreenCoverage(page, raster, probes.topNearCornerInside),
      getGreenCoverage(page, raster, probes.rightNearCornerInside),
      getGreenCoverage(page, raster, probes.topFarGap),
      getGreenCoverage(page, raster, probes.cornerOutsideLeak),
      getGreenCoverage(page, raster, probes.center)
    ])

    expect(topNearCornerInside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(rightNearCornerInside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(topFarGap).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
    expect(cornerOutsideLeak).toBeLessThan(MAX_EXTERIOR_LEAK)
    expect(center).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
  })

  test('benchmark: closed rectangle-equivalent vector inside round corner-spanning constrained dashed stroke renders through the uniform-width corner-spanning topology family product path', async ({
    page
  }) => {
    await createVectorPath(page, 0.3, 0.3, 0.1, 0.1)
    await clearVectorOverlayState(page)
    await ensureElementSelected(page, 'vector')
    await patchSelectedVectorToClosedRectangle(page)
    await configureConstrainedDashedStroke(page, {
      elementType: 'vector',
      position: 'inside',
      join: 'round',
      cap: 'butt',
      pattern: ORTHOGONAL_80X40_CORNER_SPANNING_PATTERN,
      offset: ORTHOGONAL_80X40_CORNER_SPANNING_OFFSET
    })

    const raster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const probes = getRectCornerSpanningProbeRegions(raster)

    const [
      topNearCornerInside,
      rightNearCornerInside,
      topFarGap,
      cornerOutsideLeak,
      center
    ] = await Promise.all([
      getGreenCoverage(page, raster, probes.topNearCornerInside),
      getGreenCoverage(page, raster, probes.rightNearCornerInside),
      getGreenCoverage(page, raster, probes.topFarGap),
      getGreenCoverage(page, raster, probes.cornerOutsideLeak),
      getGreenCoverage(page, raster, probes.center)
    ])

    expect(topNearCornerInside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(rightNearCornerInside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(topFarGap).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
    expect(cornerOutsideLeak).toBeLessThan(MAX_EXTERIOR_LEAK)
    expect(center).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
  })

  test('benchmark: closed rectangle-equivalent vector outside bevel corner-spanning constrained dashed stroke renders through the next bounded vector corner-spanning topology family product path', async ({
    page
  }) => {
    await createVectorPath(page, 0.3, 0.3, 0.1, 0.1)
    await clearVectorOverlayState(page)
    await ensureElementSelected(page, 'vector')
    await patchSelectedVectorToClosedRectangle(page)
    await setSelectedElementRotation(page, 0)
    await configureConstrainedDashedStroke(page, {
      elementType: 'vector',
      position: 'outside',
      join: 'bevel',
      cap: 'butt',
      pattern: ORTHOGONAL_80X40_CORNER_SPANNING_PATTERN,
      offset: ORTHOGONAL_80X40_CORNER_SPANNING_OFFSET
    })

    const raster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const probes = getRectCornerSpanningProbeRegions(raster)

    const [
      topNearCornerOutside,
      rightNearCornerOutside,
      topFarGap,
      cornerInsideLeak,
      center
    ] = await Promise.all([
      getGreenCoverage(page, raster, probes.topNearCornerOutside),
      getGreenCoverage(page, raster, probes.rightNearCornerOutside),
      getGreenCoverage(page, raster, probes.topFarGap),
      getGreenCoverage(page, raster, probes.cornerInsideLeak),
      getGreenCoverage(page, raster, probes.center)
    ])

    expect(topNearCornerOutside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(rightNearCornerOutside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(topFarGap).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
    expect(cornerInsideLeak).toBeLessThan(MAX_EXTERIOR_LEAK)
    expect(center).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
  })

  test('benchmark: closed rectangle-equivalent vector outside bevel corner-spanning constrained dashed gradient stroke renders through the next supported paint vector product path', async ({
    page
  }) => {
    await createVectorPath(page, 0.3, 0.3, 0.1, 0.1)
    await clearVectorOverlayState(page)
    await ensureElementSelected(page, 'vector')
    await patchSelectedVectorToClosedRectangle(page)
    await setSelectedElementRotation(page, 0)
    await configureConstrainedDashedStroke(page, {
      elementType: 'vector',
      position: 'outside',
      join: 'bevel',
      cap: 'butt',
      pattern: ORTHOGONAL_80X40_CORNER_SPANNING_PATTERN,
      offset: ORTHOGONAL_80X40_CORNER_SPANNING_OFFSET
    })
    await patchSelectedStrokeRowToLinearGradient(page, 0)

    const raster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const probes = getRectCornerSpanningOutsideGradientProbeRegions(raster)

    const [
      topNearCornerOutsideLeft,
      topNearCornerOutsideRight,
      rightNearCornerOutside,
      topFarGap,
      cornerInsideLeak,
      center
    ] = await Promise.all([
      getAverageColor(page, raster, probes.topNearCornerOutsideLeft),
      getAverageColor(page, raster, probes.topNearCornerOutsideRight),
      getAverageColor(page, raster, probes.rightNearCornerOutside),
      getAverageColor(page, raster, probes.topFarGap),
      getAverageColor(page, raster, probes.cornerInsideLeak),
      getAverageColor(page, raster, probes.center)
    ])

    expect(topNearCornerOutsideLeft.a).toBeGreaterThan(180)
    expect(topNearCornerOutsideRight.a).toBeGreaterThan(180)
    expect(rightNearCornerOutside.a).toBeGreaterThan(180)
    expect(getRedBlueSkew(topNearCornerOutsideLeft)).toBeGreaterThan(
      getRedBlueSkew(topNearCornerOutsideRight) + 15
    )
    expect(topNearCornerOutsideLeft.r).toBeGreaterThan(
      topNearCornerOutsideLeft.b + 40
    )
    expect(topFarGap.r).toBeLessThan(80)
    expect(topFarGap.g).toBeLessThan(80)
    expect(topFarGap.b).toBeLessThan(80)
    expect(cornerInsideLeak.r).toBeLessThan(80)
    expect(cornerInsideLeak.g).toBeLessThan(80)
    expect(cornerInsideLeak.b).toBeLessThan(80)
    expect(center.r).toBeLessThan(80)
    expect(center.g).toBeLessThan(80)
    expect(center.b).toBeLessThan(80)
  })

  test('benchmark: closed rectangle-equivalent vector outside miter corner-spanning constrained dashed stroke renders through the matching bounded vector corner-spanning topology family product path', async ({
    page
  }) => {
    await createVectorPath(page, 0.3, 0.3, 0.1, 0.1)
    await clearVectorOverlayState(page)
    await ensureElementSelected(page, 'vector')
    await patchSelectedVectorToClosedRectangle(page)
    await setSelectedElementRotation(page, 0)
    await configureConstrainedDashedStroke(page, {
      elementType: 'vector',
      position: 'outside',
      join: 'miter',
      cap: 'butt',
      pattern: ORTHOGONAL_80X40_CORNER_SPANNING_PATTERN,
      offset: ORTHOGONAL_80X40_CORNER_SPANNING_OFFSET
    })

    const raster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const probes = getRectCornerSpanningProbeRegions(raster)

    const [
      topNearCornerOutside,
      rightNearCornerOutside,
      topFarGap,
      cornerInsideLeak,
      center
    ] = await Promise.all([
      getGreenCoverage(page, raster, probes.topNearCornerOutside),
      getGreenCoverage(page, raster, probes.rightNearCornerOutside),
      getGreenCoverage(page, raster, probes.topFarGap),
      getGreenCoverage(page, raster, probes.cornerInsideLeak),
      getGreenCoverage(page, raster, probes.center)
    ])

    expect(topNearCornerOutside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(rightNearCornerOutside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(topFarGap).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
    expect(cornerInsideLeak).toBeLessThan(MAX_EXTERIOR_LEAK)
    expect(center).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
  })

  test('benchmark: closed rectangle-equivalent vector outside round corner-spanning constrained dashed stroke renders through the uniform-width corner-spanning topology family product path', async ({
    page
  }) => {
    await createVectorPath(page, 0.3, 0.3, 0.1, 0.1)
    await clearVectorOverlayState(page)
    await ensureElementSelected(page, 'vector')
    await patchSelectedVectorToClosedRectangle(page)
    await setSelectedElementRotation(page, 0)
    await configureConstrainedDashedStroke(page, {
      elementType: 'vector',
      position: 'outside',
      join: 'round',
      cap: 'butt',
      pattern: ORTHOGONAL_80X40_CORNER_SPANNING_PATTERN,
      offset: ORTHOGONAL_80X40_CORNER_SPANNING_OFFSET
    })

    const raster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const probes = getRectCornerSpanningProbeRegions(raster)

    const [
      topNearCornerOutside,
      rightNearCornerOutside,
      topFarGap,
      cornerInsideLeak,
      center
    ] = await Promise.all([
      getGreenCoverage(page, raster, probes.topNearCornerOutside),
      getGreenCoverage(page, raster, probes.rightNearCornerOutside),
      getGreenCoverage(page, raster, probes.topFarGap),
      getGreenCoverage(page, raster, probes.cornerInsideLeak),
      getGreenCoverage(page, raster, probes.center)
    ])

    expect(topNearCornerOutside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(rightNearCornerOutside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(topFarGap).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
    expect(cornerInsideLeak).toBeLessThan(MAX_EXTERIOR_LEAK)
    expect(center).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
  })

  test('benchmark: closed non-rectangle-equivalent vector inside bevel corner-spanning constrained dashed stroke renders through the first broader vector corner-spanning topology family product path', async ({
    page
  }) => {
    await createVectorPath(page, 0.3, 0.3, 0.1, 0.1)
    await clearVectorOverlayState(page)
    await ensureElementSelected(page, 'vector')
    await patchSelectedVectorToClosedTrapezoid(page)
    await setSelectedElementRotation(page, 0)
    await configureConstrainedDashedStroke(page, {
      elementType: 'vector',
      position: 'inside',
      join: 'bevel',
      cap: 'butt',
      pattern: ORTHOGONAL_80X40_CORNER_SPANNING_PATTERN,
      offset: ORTHOGONAL_80X40_CORNER_SPANNING_OFFSET
    })

    const raster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const probes = getTrapezoidCornerSpanningProbeRegions(raster)

    const [
      topNearCornerInside,
      slantedNearCornerInside,
      topFarGap,
      cornerOutsideLeak,
      center
    ] = await Promise.all([
      getGreenCoverage(page, raster, probes.topNearCornerInside),
      getGreenCoverage(page, raster, probes.slantedNearCornerInside),
      getGreenCoverage(page, raster, probes.topFarGap),
      getGreenCoverage(page, raster, probes.cornerOutsideLeak),
      getGreenCoverage(page, raster, probes.center)
    ])

    expect(topNearCornerInside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(slantedNearCornerInside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(topFarGap).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
    expect(cornerOutsideLeak).toBeLessThan(MAX_EXTERIOR_LEAK)
    expect(center).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
  })

  test('benchmark: closed non-rectangle-equivalent vector inside bevel corner-spanning constrained dashed gradient stroke renders through the broader one-sided candidate paint vector path', async ({
    page
  }) => {
    await createVectorPath(page, 0.3, 0.3, 0.1, 0.1)
    await clearVectorOverlayState(page)
    await ensureElementSelected(page, 'vector')
    await patchSelectedVectorToClosedTrapezoid(page)
    await setSelectedElementRotation(page, 0)
    await configureConstrainedDashedStroke(page, {
      elementType: 'vector',
      position: 'inside',
      join: 'bevel',
      cap: 'butt',
      pattern: ORTHOGONAL_80X40_CORNER_SPANNING_PATTERN,
      offset: ORTHOGONAL_80X40_CORNER_SPANNING_OFFSET
    })
    await patchSelectedStrokeRowToLinearGradient(page, 0)

    const raster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const probes = getTrapezoidCornerSpanningGradientProbeRegions(raster)

    const [
      topNearCornerLeft,
      topNearCornerRight,
      slantedNearCorner,
      topFarGap,
      cornerOutsideLeak,
      center
    ] = await Promise.all([
      getAverageColor(page, raster, probes.topNearCornerLeft),
      getAverageColor(page, raster, probes.topNearCornerRight),
      getAverageColor(page, raster, probes.slantedNearCorner),
      getAverageColor(page, raster, probes.topFarGap),
      getAverageColor(page, raster, probes.cornerOutsideLeak),
      getAverageColor(page, raster, probes.center)
    ])

    expect(topNearCornerLeft.a).toBeGreaterThan(180)
    expect(topNearCornerRight.a).toBeGreaterThan(180)
    expect(slantedNearCorner.a).toBeGreaterThan(180)
    expect(getRedBlueSkew(topNearCornerLeft)).toBeGreaterThan(
      getRedBlueSkew(topNearCornerRight) + 15
    )
    expect(topNearCornerLeft.r).toBeGreaterThan(topNearCornerLeft.b + 40)
    expect(topNearCornerRight.b).toBeGreaterThan(80)
    expect(Math.abs(getRedBlueSkew(topFarGap))).toBeLessThan(20)
    expect(topFarGap.r).toBeLessThan(80)
    expect(topFarGap.g).toBeLessThan(80)
    expect(topFarGap.b).toBeLessThan(80)
    expect(cornerOutsideLeak.r).toBeLessThan(80)
    expect(cornerOutsideLeak.g).toBeLessThan(80)
    expect(cornerOutsideLeak.b).toBeLessThan(80)
    expect(center.r).toBeLessThan(80)
    expect(center.g).toBeLessThan(80)
    expect(center.b).toBeLessThan(80)
  })

  test('benchmark: closed non-rectangle-equivalent vector inside miter corner-spanning constrained dashed stroke renders through the matching broader vector corner-spanning topology family product path', async ({
    page
  }) => {
    await createVectorPath(page, 0.3, 0.3, 0.1, 0.1)
    await clearVectorOverlayState(page)
    await ensureElementSelected(page, 'vector')
    await patchSelectedVectorToClosedTrapezoid(page)
    await setSelectedElementRotation(page, 0)
    await configureConstrainedDashedStroke(page, {
      elementType: 'vector',
      position: 'inside',
      join: 'miter',
      cap: 'butt',
      pattern: ORTHOGONAL_80X40_CORNER_SPANNING_PATTERN,
      offset: ORTHOGONAL_80X40_CORNER_SPANNING_OFFSET
    })

    const raster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const probes = getTrapezoidCornerSpanningProbeRegions(raster)

    const [
      topNearCornerInside,
      slantedNearCornerInside,
      topFarGap,
      cornerOutsideLeak,
      center
    ] = await Promise.all([
      getGreenCoverage(page, raster, probes.topNearCornerInside),
      getGreenCoverage(page, raster, probes.slantedNearCornerInside),
      getGreenCoverage(page, raster, probes.topFarGap),
      getGreenCoverage(page, raster, probes.cornerOutsideLeak),
      getGreenCoverage(page, raster, probes.center)
    ])

    expect(topNearCornerInside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(slantedNearCornerInside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(topFarGap).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
    expect(cornerOutsideLeak).toBeLessThan(MAX_EXTERIOR_LEAK)
    expect(center).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
  })

  test('benchmark: closed non-rectangle-equivalent vector outside bevel corner-spanning constrained dashed stroke renders through the next broader vector corner-spanning topology family product path', async ({
    page
  }) => {
    await createVectorPath(page, 0.3, 0.3, 0.1, 0.1)
    await clearVectorOverlayState(page)
    await ensureElementSelected(page, 'vector')
    await patchSelectedVectorToClosedTrapezoid(page)
    await setSelectedElementRotation(page, 0)
    await configureConstrainedDashedStroke(page, {
      elementType: 'vector',
      position: 'outside',
      join: 'bevel',
      cap: 'butt',
      pattern: ORTHOGONAL_80X40_CORNER_SPANNING_PATTERN,
      offset: ORTHOGONAL_80X40_CORNER_SPANNING_OFFSET
    })

    const raster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const probes = getTrapezoidCornerSpanningProbeRegions(raster)

    const [
      topNearCornerOutside,
      slantedNearCornerOutside,
      topFarGap,
      cornerInsideLeak,
      center
    ] = await Promise.all([
      getGreenCoverage(page, raster, probes.topNearCornerOutside),
      getGreenCoverage(page, raster, probes.slantedNearCornerOutside),
      getGreenCoverage(page, raster, probes.topFarGap),
      getGreenCoverage(page, raster, probes.cornerInsideLeak),
      getGreenCoverage(page, raster, probes.center)
    ])

    expect(topNearCornerOutside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(slantedNearCornerOutside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(topFarGap).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
    expect(cornerInsideLeak).toBeLessThan(MAX_EXTERIOR_LEAK)
    expect(center).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
  })

  test('benchmark: closed non-rectangle-equivalent vector outside miter corner-spanning constrained dashed stroke renders through the matching broader vector corner-spanning topology family product path', async ({
    page
  }) => {
    await createVectorPath(page, 0.3, 0.3, 0.1, 0.1)
    await clearVectorOverlayState(page)
    await ensureElementSelected(page, 'vector')
    await patchSelectedVectorToClosedTrapezoid(page)
    await setSelectedElementRotation(page, 0)
    await configureConstrainedDashedStroke(page, {
      elementType: 'vector',
      position: 'outside',
      join: 'miter',
      cap: 'butt',
      pattern: ORTHOGONAL_80X40_CORNER_SPANNING_PATTERN,
      offset: ORTHOGONAL_80X40_CORNER_SPANNING_OFFSET
    })

    const raster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const probes = getTrapezoidCornerSpanningProbeRegions(raster)

    const [
      topNearCornerOutside,
      slantedNearCornerOutside,
      topFarGap,
      cornerInsideLeak,
      center
    ] = await Promise.all([
      getGreenCoverage(page, raster, probes.topNearCornerOutside),
      getGreenCoverage(page, raster, probes.slantedNearCornerOutside),
      getGreenCoverage(page, raster, probes.topFarGap),
      getGreenCoverage(page, raster, probes.cornerInsideLeak),
      getGreenCoverage(page, raster, probes.center)
    ])

    expect(topNearCornerOutside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(slantedNearCornerOutside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(topFarGap).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
    expect(cornerInsideLeak).toBeLessThan(MAX_EXTERIOR_LEAK)
    expect(center).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
  })

  test('benchmark: closed rectangle-equivalent vector inside constrained dashed single-edge stroke renders through the next single-edge topology family product path', async ({
    page
  }) => {
    await createVectorPath(page, 0.3, 0.3, 0.1, 0.1)
    await clearVectorOverlayState(page)
    await ensureElementSelected(page, 'vector')
    await patchSelectedVectorToClosedRectangle(page)
    await configureConstrainedDashedStroke(page, {
      elementType: 'vector',
      position: 'inside',
      join: 'bevel',
      cap: 'butt',
      pattern: ORTHOGONAL_80X40_SINGLE_EDGE_PATTERN,
      offset: ORTHOGONAL_80X40_SINGLE_EDGE_OFFSET
    })

    const raster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const probes = getRectSingleEdgeProbeRegions(raster)

    const [intervalInside, laterTopInsideGap, intervalOutside, center] =
      await Promise.all([
        getGreenCoverage(page, raster, probes.intervalInside),
        getGreenCoverage(page, raster, probes.laterTopInsideGap),
        getGreenCoverage(page, raster, probes.intervalOutside),
        getGreenCoverage(page, raster, probes.center)
      ])

    expect(intervalInside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(laterTopInsideGap).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
    expect(intervalOutside).toBeLessThan(MAX_EXTERIOR_LEAK)
    expect(center).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
  })

  test('benchmark: closed rectangle-equivalent vector outside constrained dashed single-edge stroke renders through the same next single-edge topology family product path', async ({
    page
  }) => {
    await createVectorPath(page, 0.3, 0.3, 0.1, 0.1)
    await clearVectorOverlayState(page)
    await ensureElementSelected(page, 'vector')
    await patchSelectedVectorToClosedRectangle(page)
    await configureConstrainedDashedStroke(page, {
      elementType: 'vector',
      position: 'outside',
      join: 'bevel',
      cap: 'butt',
      pattern: ORTHOGONAL_80X40_SINGLE_EDGE_PATTERN,
      offset: ORTHOGONAL_80X40_SINGLE_EDGE_OFFSET
    })

    const raster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const probes = getRectSingleEdgeProbeRegions(raster)

    const [intervalOutside, intervalInside, laterTopOutsideGap, center] =
      await Promise.all([
        getGreenCoverage(page, raster, probes.intervalOutside),
        getGreenCoverage(page, raster, probes.intervalInside),
        getGreenCoverage(page, raster, probes.laterTopOutsideGap),
        getGreenCoverage(page, raster, probes.center)
      ])

    expect(intervalOutside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(intervalInside).toBeLessThan(MAX_EXTERIOR_LEAK)
    expect(laterTopOutsideGap).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
    expect(center).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
  })

  test('benchmark: closed non-rectangle-equivalent vector inside constrained dashed single-edge stroke renders through the broader single-edge topology family vector path', async ({
    page
  }) => {
    await createVectorPath(page, 0.3, 0.3, 0.1, 0.1)
    await clearVectorOverlayState(page)
    await ensureElementSelected(page, 'vector')
    await patchSelectedVectorToClosedTrapezoid(page)
    await configureConstrainedDashedStroke(page, {
      elementType: 'vector',
      position: 'inside',
      join: 'bevel',
      cap: 'butt',
      pattern: ORTHOGONAL_80X40_SINGLE_EDGE_PATTERN,
      offset: ORTHOGONAL_80X40_SINGLE_EDGE_OFFSET
    })

    const raster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const probes = getRectSingleEdgeProbeRegions(raster)

    const [intervalInside, laterTopInsideGap, intervalOutside, center] =
      await Promise.all([
        getGreenCoverage(page, raster, probes.intervalInside),
        getGreenCoverage(page, raster, probes.laterTopInsideGap),
        getGreenCoverage(page, raster, probes.intervalOutside),
        getGreenCoverage(page, raster, probes.center)
      ])

    expect(intervalInside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(laterTopInsideGap).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
    expect(intervalOutside).toBeLessThan(MAX_EXTERIOR_LEAK)
    expect(center).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
  })

  test('benchmark: closed non-rectangle-equivalent vector outside constrained dashed single-edge stroke renders through the same broader single-edge topology family vector path', async ({
    page
  }) => {
    await createVectorPath(page, 0.3, 0.3, 0.1, 0.1)
    await clearVectorOverlayState(page)
    await ensureElementSelected(page, 'vector')
    await patchSelectedVectorToClosedTrapezoid(page)
    await configureConstrainedDashedStroke(page, {
      elementType: 'vector',
      position: 'outside',
      join: 'bevel',
      cap: 'butt',
      pattern: ORTHOGONAL_80X40_SINGLE_EDGE_PATTERN,
      offset: ORTHOGONAL_80X40_SINGLE_EDGE_OFFSET
    })

    const raster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const probes = getRectSingleEdgeProbeRegions(raster)

    const [intervalOutside, intervalInside, laterTopOutsideGap, center] =
      await Promise.all([
        getGreenCoverage(page, raster, probes.intervalOutside),
        getGreenCoverage(page, raster, probes.intervalInside),
        getGreenCoverage(page, raster, probes.laterTopOutsideGap),
        getGreenCoverage(page, raster, probes.center)
      ])

    expect(intervalOutside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(intervalInside).toBeLessThan(MAX_EXTERIOR_LEAK)
    expect(laterTopOutsideGap).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
    expect(center).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
  })

  test('benchmark: closed non-rectangle-equivalent vector inside constrained dashed full-loop stroke renders through the broader supported constrained dashed vector path', async ({
    page
  }) => {
    await createVectorPath(page, 0.3, 0.3, 0.1, 0.1)
    await clearVectorOverlayState(page)
    await ensureElementSelected(page, 'vector')
    await patchSelectedVectorToClosedTrapezoid(page)
    await configureConstrainedDashedStroke(page, {
      elementType: 'vector',
      position: 'inside',
      join: 'bevel',
      cap: 'butt',
      pattern: FULL_LOOP_PATTERN
    })

    const raster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const probes = getRectProbeRegions(raster)

    const [topInside, topOutside, center] = await Promise.all([
      getGreenCoverage(page, raster, probes.topInside),
      getGreenCoverage(page, raster, probes.topOutside),
      getGreenCoverage(page, raster, probes.center)
    ])

    expect(topInside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(topOutside).toBeLessThan(MAX_EXTERIOR_LEAK)
    expect(center).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
  })

  test('benchmark: closed non-rectangle-equivalent vector outside constrained dashed full-loop stroke renders through the same broader supported constrained dashed vector path', async ({
    page
  }) => {
    await createVectorPath(page, 0.3, 0.3, 0.1, 0.1)
    await clearVectorOverlayState(page)
    await ensureElementSelected(page, 'vector')
    await patchSelectedVectorToClosedTrapezoid(page)
    await configureConstrainedDashedStroke(page, {
      elementType: 'vector',
      position: 'outside',
      join: 'bevel',
      cap: 'butt',
      pattern: FULL_LOOP_PATTERN
    })

    const raster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const probes = getRectProbeRegions(raster)

    const [topOutside, topInside, center] = await Promise.all([
      getGreenCoverage(page, raster, probes.topOutside),
      getGreenCoverage(page, raster, probes.topInside),
      getGreenCoverage(page, raster, probes.center)
    ])

    expect(topOutside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(topInside).toBeLessThan(MAX_EXTERIOR_LEAK)
    expect(center).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
  })

  test('benchmark: shape-generated and vector-generated inside constrained dashed full-loop coverage stay equivalent on the first source-equivalence topology family gate', async ({
    page
  }) => {
    await createRectangle(page, 0.3, 0.3)
    await configureConstrainedDashedStroke(page, {
      elementType: 'rect',
      position: 'inside',
      join: 'bevel',
      cap: 'butt',
      pattern: FULL_LOOP_PATTERN
    })

    const rectRaster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const rectProbes = getRectProbeRegions(rectRaster)
    const [rectTopInside, rectCenter] = await Promise.all([
      getGreenCoverage(page, rectRaster, rectProbes.topInside),
      getGreenCoverage(page, rectRaster, rectProbes.center)
    ])

    await resetCanvas(page)
    await createVectorPath(page, 0.3, 0.3, 0.1, 0.1)
    await clearVectorOverlayState(page)
    await ensureElementSelected(page, 'vector')
    await patchSelectedVectorToClosedRectangle(page)
    await configureConstrainedDashedStroke(page, {
      elementType: 'vector',
      position: 'inside',
      join: 'bevel',
      cap: 'butt',
      pattern: FULL_LOOP_PATTERN
    })

    const vectorRaster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const vectorProbes = getRectProbeRegions(vectorRaster)
    const [vectorTopInside, vectorCenter] = await Promise.all([
      getGreenCoverage(page, vectorRaster, vectorProbes.topInside),
      getGreenCoverage(page, vectorRaster, vectorProbes.center)
    ])

    expect(rectTopInside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(vectorTopInside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(Math.abs(rectTopInside - vectorTopInside)).toBeLessThan(0.08)
    expect(rectCenter).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
    expect(vectorCenter).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
    expect(Math.abs(rectCenter - vectorCenter)).toBeLessThan(0.03)
  })

  test('benchmark: shape-generated and vector-generated inside round-join full-loop constrained dashed coverage stay equivalent on the first supported join/cap source-equivalence topology family gate', async ({
    page
  }) => {
    await createRectangle(page, 0.3, 0.3)
    await setSelectedElementSize(page, { width: 80, height: 40 })
    await setSelectedElementRotation(page, 0)
    await configureConstrainedDashedStroke(page, {
      elementType: 'rect',
      position: 'inside',
      join: 'round',
      cap: 'butt',
      pattern: FULL_LOOP_PATTERN
    })

    const rectRaster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const rectProbes = getRectProbeRegions(rectRaster)
    const [rectTopInside, rectLeftInside, rectCenter] = await Promise.all([
      getGreenCoverage(page, rectRaster, rectProbes.topInside),
      getGreenCoverage(page, rectRaster, rectProbes.leftInside),
      getGreenCoverage(page, rectRaster, rectProbes.center)
    ])

    await resetCanvas(page)
    await createVectorPath(page, 0.3, 0.3, 0.1, 0.1)
    await clearVectorOverlayState(page)
    await ensureElementSelected(page, 'vector')
    await patchSelectedVectorToClosedRectangle(page)
    await setSelectedElementRotation(page, 0)
    await configureConstrainedDashedStroke(page, {
      elementType: 'vector',
      position: 'inside',
      join: 'round',
      cap: 'butt',
      pattern: FULL_LOOP_PATTERN
    })

    const vectorRaster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const vectorProbes = getRectProbeRegions(vectorRaster)
    const [vectorTopInside, vectorLeftInside, vectorCenter] = await Promise.all(
      [
        getGreenCoverage(page, vectorRaster, vectorProbes.topInside),
        getGreenCoverage(page, vectorRaster, vectorProbes.leftInside),
        getGreenCoverage(page, vectorRaster, vectorProbes.center)
      ]
    )

    expect(rectTopInside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(vectorTopInside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(Math.abs(rectTopInside - vectorTopInside)).toBeLessThan(0.08)
    expect(rectLeftInside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(vectorLeftInside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(Math.abs(rectLeftInside - vectorLeftInside)).toBeLessThan(0.08)
    expect(rectCenter).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
    expect(vectorCenter).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
    expect(Math.abs(rectCenter - vectorCenter)).toBeLessThan(0.03)
  })

  test('benchmark: shape-generated and vector-generated outside round-join full-loop constrained dashed coverage stay equivalent on the next supported join/cap source-equivalence topology family gate', async ({
    page
  }) => {
    await createRectangle(page, 0.3, 0.3)
    await setSelectedElementSize(page, { width: 80, height: 40 })
    await setSelectedElementRotation(page, 0)
    await configureConstrainedDashedStroke(page, {
      elementType: 'rect',
      position: 'outside',
      join: 'round',
      cap: 'butt',
      pattern: FULL_LOOP_PATTERN
    })

    const rectRaster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const rectProbes = getRectProbeRegions(rectRaster)
    const [rectTopOutside, rectLeftOutside, rectTopInside, rectCenter] =
      await Promise.all([
        getGreenCoverage(page, rectRaster, rectProbes.topOutside),
        getGreenCoverage(page, rectRaster, rectProbes.leftOutside),
        getGreenCoverage(page, rectRaster, rectProbes.topInside),
        getGreenCoverage(page, rectRaster, rectProbes.center)
      ])

    await resetCanvas(page)
    await createVectorPath(page, 0.3, 0.3, 0.1, 0.1)
    await clearVectorOverlayState(page)
    await ensureElementSelected(page, 'vector')
    await patchSelectedVectorToClosedRectangle(page)
    await setSelectedElementRotation(page, 0)
    await configureConstrainedDashedStroke(page, {
      elementType: 'vector',
      position: 'outside',
      join: 'round',
      cap: 'butt',
      pattern: FULL_LOOP_PATTERN
    })

    const vectorRaster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const vectorProbes = getRectProbeRegions(vectorRaster)
    const [vectorTopOutside, vectorLeftOutside, vectorTopInside, vectorCenter] =
      await Promise.all([
        getGreenCoverage(page, vectorRaster, vectorProbes.topOutside),
        getGreenCoverage(page, vectorRaster, vectorProbes.leftOutside),
        getGreenCoverage(page, vectorRaster, vectorProbes.topInside),
        getGreenCoverage(page, vectorRaster, vectorProbes.center)
      ])

    expect(rectTopOutside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(vectorTopOutside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(Math.abs(rectTopOutside - vectorTopOutside)).toBeLessThan(0.08)
    expect(rectLeftOutside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(vectorLeftOutside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(Math.abs(rectLeftOutside - vectorLeftOutside)).toBeLessThan(0.08)
    expect(rectTopInside).toBeLessThan(MAX_EXTERIOR_LEAK)
    expect(vectorTopInside).toBeLessThan(MAX_EXTERIOR_LEAK)
    expect(Math.abs(rectTopInside - vectorTopInside)).toBeLessThan(0.03)
    expect(rectCenter).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
    expect(vectorCenter).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
    expect(Math.abs(rectCenter - vectorCenter)).toBeLessThan(0.03)
  })

  test('benchmark: shape-generated and vector-generated outside constrained dashed full-loop coverage stay equivalent on the same source-equivalence topology family gate', async ({
    page
  }) => {
    await createRectangle(page, 0.3, 0.3)
    await configureConstrainedDashedStroke(page, {
      elementType: 'rect',
      position: 'outside',
      join: 'bevel',
      cap: 'butt',
      pattern: FULL_LOOP_PATTERN
    })

    const rectRaster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const rectProbes = getRectProbeRegions(rectRaster)
    const [rectTopOutside, rectCenter] = await Promise.all([
      getGreenCoverage(page, rectRaster, rectProbes.topOutside),
      getGreenCoverage(page, rectRaster, rectProbes.center)
    ])

    await resetCanvas(page)
    await createVectorPath(page, 0.3, 0.3, 0.1, 0.1)
    await clearVectorOverlayState(page)
    await ensureElementSelected(page, 'vector')
    await patchSelectedVectorToClosedRectangle(page)
    await configureConstrainedDashedStroke(page, {
      elementType: 'vector',
      position: 'outside',
      join: 'bevel',
      cap: 'butt',
      pattern: FULL_LOOP_PATTERN
    })

    const vectorRaster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const vectorProbes = getRectProbeRegions(vectorRaster)
    const [vectorTopOutside, vectorCenter] = await Promise.all([
      getGreenCoverage(page, vectorRaster, vectorProbes.topOutside),
      getGreenCoverage(page, vectorRaster, vectorProbes.center)
    ])

    expect(rectTopOutside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(vectorTopOutside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(Math.abs(rectTopOutside - vectorTopOutside)).toBeLessThan(0.08)
    expect(rectCenter).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
    expect(vectorCenter).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
    expect(Math.abs(rectCenter - vectorCenter)).toBeLessThan(0.03)
  })

  test('benchmark: shape-generated and vector-generated inside constrained dashed single-edge coverage stay equivalent on the first single-edge topology family and source-equivalence topology family crossover gate', async ({
    page
  }) => {
    await createRectangle(page, 0.3, 0.3)
    await setSelectedElementSize(page, { width: 80, height: 40 })
    await setSelectedElementRotation(page, 0)
    await configureConstrainedDashedStroke(page, {
      elementType: 'rect',
      position: 'inside',
      join: 'bevel',
      cap: 'butt',
      pattern: ORTHOGONAL_80X40_SINGLE_EDGE_PATTERN,
      offset: ORTHOGONAL_80X40_SINGLE_EDGE_OFFSET
    })

    const rectRaster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const rectProbes = getRectSingleEdgeProbeRegions(rectRaster)
    const [rectInterval, rectGap, rectCenter] = await Promise.all([
      getGreenCoverage(page, rectRaster, rectProbes.intervalInside),
      getGreenCoverage(page, rectRaster, rectProbes.laterTopInsideGap),
      getGreenCoverage(page, rectRaster, rectProbes.center)
    ])

    await resetCanvas(page)
    await createVectorPath(page, 0.3, 0.3, 0.1, 0.1)
    await clearVectorOverlayState(page)
    await ensureElementSelected(page, 'vector')
    await patchSelectedVectorToClosedRectangle(page)
    await configureConstrainedDashedStroke(page, {
      elementType: 'vector',
      position: 'inside',
      join: 'bevel',
      cap: 'butt',
      pattern: ORTHOGONAL_80X40_SINGLE_EDGE_PATTERN,
      offset: ORTHOGONAL_80X40_SINGLE_EDGE_OFFSET
    })

    const vectorRaster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const vectorProbes = getRectSingleEdgeProbeRegions(vectorRaster)
    const [vectorInterval, vectorGap, vectorCenter] = await Promise.all([
      getGreenCoverage(page, vectorRaster, vectorProbes.intervalInside),
      getGreenCoverage(page, vectorRaster, vectorProbes.laterTopInsideGap),
      getGreenCoverage(page, vectorRaster, vectorProbes.center)
    ])

    expect(rectInterval).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(vectorInterval).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(Math.abs(rectInterval - vectorInterval)).toBeLessThan(0.08)
    expect(rectGap).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
    expect(vectorGap).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
    expect(Math.abs(rectGap - vectorGap)).toBeLessThan(0.03)
    expect(rectCenter).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
    expect(vectorCenter).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
    expect(Math.abs(rectCenter - vectorCenter)).toBeLessThan(0.03)
  })

  test('benchmark: shape-generated and vector-generated inside round-cap single-edge constrained dashed coverage stay equivalent on the next supported join/cap source-equivalence topology family gate', async ({
    page
  }) => {
    await createRectangle(page, 0.3, 0.3)
    await setSelectedElementSize(page, { width: 80, height: 40 })
    await setSelectedElementRotation(page, 0)
    await configureConstrainedDashedStroke(page, {
      elementType: 'rect',
      position: 'inside',
      join: 'bevel',
      cap: 'round',
      pattern: ORTHOGONAL_80X40_SINGLE_EDGE_PATTERN,
      offset: ORTHOGONAL_80X40_SINGLE_EDGE_OFFSET,
      width: 4
    })

    const rectRaster = await captureSelectedElementRaster(page, 4)
    const rectProbes = getVectorRectSingleEdgeRoundCapProbeRegions(rectRaster)
    const [rectCapInside, rectBodyInside, rectGap, rectCenter] =
      await Promise.all([
        getGreenCoverage(page, rectRaster, rectProbes.capInside),
        getGreenCoverage(page, rectRaster, rectProbes.bodyInside),
        getGreenCoverage(page, rectRaster, rectProbes.laterTopInsideGap),
        getGreenCoverage(page, rectRaster, rectProbes.center)
      ])

    await resetCanvas(page)
    await createVectorPath(page, 0.3, 0.3, 0.1, 0.1)
    await clearVectorOverlayState(page)
    await ensureElementSelected(page, 'vector')
    await patchSelectedVectorToClosedRectangle(page)
    await setSelectedElementRotation(page, 0)
    await configureConstrainedDashedStroke(page, {
      elementType: 'vector',
      position: 'inside',
      join: 'bevel',
      cap: 'round',
      pattern: ORTHOGONAL_80X40_SINGLE_EDGE_PATTERN,
      offset: ORTHOGONAL_80X40_SINGLE_EDGE_OFFSET,
      width: 4
    })

    const vectorRaster = await captureSelectedElementRaster(page, 4)
    const vectorProbes =
      getVectorRectSingleEdgeRoundCapProbeRegions(vectorRaster)
    const [vectorCapInside, vectorBodyInside, vectorGap, vectorCenter] =
      await Promise.all([
        getGreenCoverage(page, vectorRaster, vectorProbes.capInside),
        getGreenCoverage(page, vectorRaster, vectorProbes.bodyInside),
        getGreenCoverage(page, vectorRaster, vectorProbes.laterTopInsideGap),
        getGreenCoverage(page, vectorRaster, vectorProbes.center)
      ])

    expect(rectCapInside).toBeGreaterThan(MIN_VECTOR_CAP_TERMINAL_COVERAGE)
    expect(vectorCapInside).toBeGreaterThan(MIN_VECTOR_CAP_TERMINAL_COVERAGE)
    expect(Math.abs(rectCapInside - vectorCapInside)).toBeLessThan(0.12)
    expect(rectBodyInside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(vectorBodyInside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(Math.abs(rectBodyInside - vectorBodyInside)).toBeLessThan(0.08)
    expect(rectGap).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
    expect(vectorGap).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
    expect(Math.abs(rectGap - vectorGap)).toBeLessThan(0.03)
    expect(rectCenter).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
    expect(vectorCenter).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
    expect(Math.abs(rectCenter - vectorCenter)).toBeLessThan(0.03)
  })

  test('benchmark: shape-generated and vector-generated outside round-cap single-edge constrained dashed coverage stay equivalent on the next supported join/cap source-equivalence topology family gate', async ({
    page
  }) => {
    await createRectangle(page, 0.3, 0.3)
    await setSelectedElementSize(page, { width: 80, height: 40 })
    await setSelectedElementRotation(page, 0)
    await configureConstrainedDashedStroke(page, {
      elementType: 'rect',
      position: 'outside',
      join: 'bevel',
      cap: 'round',
      pattern: ORTHOGONAL_80X40_SINGLE_EDGE_PATTERN,
      offset: ORTHOGONAL_80X40_SINGLE_EDGE_OFFSET,
      width: 4
    })

    const rectRaster = await captureSelectedElementRaster(page, 4)
    const rectProbes =
      getVectorRectSingleEdgeOutsideRoundCapProbeRegions(rectRaster)
    const [
      rectCapOutside,
      rectBodyOutside,
      rectInsideLeak,
      rectGap,
      rectCenter
    ] = await Promise.all([
      getGreenCoverage(page, rectRaster, rectProbes.capOutside),
      getGreenCoverage(page, rectRaster, rectProbes.bodyOutside),
      getGreenCoverage(page, rectRaster, rectProbes.capInsideLeak),
      getGreenCoverage(page, rectRaster, rectProbes.laterTopOutsideGap),
      getGreenCoverage(page, rectRaster, rectProbes.center)
    ])

    await resetCanvas(page)
    await createVectorPath(page, 0.3, 0.3, 0.1, 0.1)
    await clearVectorOverlayState(page)
    await ensureElementSelected(page, 'vector')
    await patchSelectedVectorToClosedRectangle(page)
    await setSelectedElementRotation(page, 0)
    await configureConstrainedDashedStroke(page, {
      elementType: 'vector',
      position: 'outside',
      join: 'bevel',
      cap: 'round',
      pattern: ORTHOGONAL_80X40_SINGLE_EDGE_PATTERN,
      offset: ORTHOGONAL_80X40_SINGLE_EDGE_OFFSET,
      width: 4
    })

    const vectorRaster = await captureSelectedElementRaster(page, 4)
    const vectorProbes =
      getVectorRectSingleEdgeOutsideRoundCapProbeRegions(vectorRaster)
    const [
      vectorCapOutside,
      vectorBodyOutside,
      vectorInsideLeak,
      vectorGap,
      vectorCenter
    ] = await Promise.all([
      getGreenCoverage(page, vectorRaster, vectorProbes.capOutside),
      getGreenCoverage(page, vectorRaster, vectorProbes.bodyOutside),
      getGreenCoverage(page, vectorRaster, vectorProbes.capInsideLeak),
      getGreenCoverage(page, vectorRaster, vectorProbes.laterTopOutsideGap),
      getGreenCoverage(page, vectorRaster, vectorProbes.center)
    ])

    expect(rectCapOutside).toBeGreaterThan(MIN_VECTOR_CAP_TERMINAL_COVERAGE)
    expect(vectorCapOutside).toBeGreaterThan(MIN_VECTOR_CAP_TERMINAL_COVERAGE)
    expect(Math.abs(rectCapOutside - vectorCapOutside)).toBeLessThan(0.12)
    expect(rectBodyOutside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(vectorBodyOutside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(Math.abs(rectBodyOutside - vectorBodyOutside)).toBeLessThan(0.08)
    expect(rectInsideLeak).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
    expect(vectorInsideLeak).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
    expect(Math.abs(rectInsideLeak - vectorInsideLeak)).toBeLessThan(0.03)
    expect(rectGap).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
    expect(vectorGap).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
    expect(Math.abs(rectGap - vectorGap)).toBeLessThan(0.03)
    expect(rectCenter).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
    expect(vectorCenter).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
    expect(Math.abs(rectCenter - vectorCenter)).toBeLessThan(0.03)
  })

  test('benchmark: shape-generated and vector-generated inside full-loop gradient constrained dashed coverage stay equivalent on the first supported paint source-equivalence topology family gate', async ({
    page
  }) => {
    await createRectangle(page, 0.35, 0.35)
    await setSelectedElementSize(page, { width: 80, height: 40 })
    await setSelectedElementRotation(page, 0)
    await configureConstrainedDashedStroke(page, {
      elementType: 'rect',
      position: 'inside',
      join: 'bevel',
      cap: 'butt',
      pattern: FULL_LOOP_PATTERN
    })
    await patchSelectedStrokeRowToLinearGradient(page, 0)

    const rectRaster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const rectProbes = getRectGradientProbeRegions(rectRaster)
    const [rectTopInsideLeft, rectTopInsideRight] = await Promise.all([
      getAverageColor(page, rectRaster, rectProbes.topInsideLeft),
      getAverageColor(page, rectRaster, rectProbes.topInsideRight)
    ])

    await resetCanvas(page)
    await createVectorPath(page, 0.3, 0.3, 0.1, 0.1)
    await clearVectorOverlayState(page)
    await ensureElementSelected(page, 'vector')
    await patchSelectedVectorToClosedRectangle(page)
    await setSelectedElementRotation(page, 0)
    await configureConstrainedDashedStroke(page, {
      elementType: 'vector',
      position: 'inside',
      join: 'bevel',
      cap: 'butt',
      pattern: FULL_LOOP_PATTERN
    })
    await patchSelectedStrokeRowToLinearGradient(page, 0)

    const vectorRaster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const vectorProbes = getRectGradientProbeRegions(vectorRaster)
    const [vectorTopInsideLeft, vectorTopInsideRight] = await Promise.all([
      getAverageColor(page, vectorRaster, vectorProbes.topInsideLeft),
      getAverageColor(page, vectorRaster, vectorProbes.topInsideRight)
    ])

    expect(rectTopInsideLeft.a).toBeGreaterThan(180)
    expect(vectorTopInsideLeft.a).toBeGreaterThan(180)
    expect(Math.abs(rectTopInsideLeft.a - vectorTopInsideLeft.a)).toBeLessThan(
      20
    )
    expect(rectTopInsideRight.a).toBeGreaterThan(180)
    expect(vectorTopInsideRight.a).toBeGreaterThan(180)
    expect(
      Math.abs(rectTopInsideRight.a - vectorTopInsideRight.a)
    ).toBeLessThan(20)

    expect(getRedBlueSkew(rectTopInsideLeft)).toBeGreaterThan(40)
    expect(getRedBlueSkew(vectorTopInsideLeft)).toBeGreaterThan(40)
    expect(
      Math.abs(
        getRedBlueSkew(rectTopInsideLeft) - getRedBlueSkew(vectorTopInsideLeft)
      )
    ).toBeLessThan(40)

    expect(getRedBlueSkew(rectTopInsideRight)).toBeLessThan(-40)
    expect(getRedBlueSkew(vectorTopInsideRight)).toBeLessThan(-40)
    expect(
      Math.abs(
        getRedBlueSkew(rectTopInsideRight) -
          getRedBlueSkew(vectorTopInsideRight)
      )
    ).toBeLessThan(40)
  })

  test('benchmark: shape-generated and vector-generated outside constrained dashed single-edge coverage stay equivalent on the same single-edge topology family and source-equivalence topology family crossover gate', async ({
    page
  }) => {
    await createRectangle(page, 0.3, 0.3)
    await setSelectedElementSize(page, { width: 80, height: 40 })
    await setSelectedElementRotation(page, 0)
    await configureConstrainedDashedStroke(page, {
      elementType: 'rect',
      position: 'outside',
      join: 'bevel',
      cap: 'butt',
      pattern: ORTHOGONAL_80X40_SINGLE_EDGE_PATTERN,
      offset: ORTHOGONAL_80X40_SINGLE_EDGE_OFFSET
    })

    const rectRaster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const rectProbes = getRectSingleEdgeProbeRegions(rectRaster)
    const [rectInterval, rectGap, rectCenter] = await Promise.all([
      getGreenCoverage(page, rectRaster, rectProbes.intervalOutside),
      getGreenCoverage(page, rectRaster, rectProbes.laterTopOutsideGap),
      getGreenCoverage(page, rectRaster, rectProbes.center)
    ])

    await resetCanvas(page)
    await createVectorPath(page, 0.3, 0.3, 0.1, 0.1)
    await clearVectorOverlayState(page)
    await ensureElementSelected(page, 'vector')
    await patchSelectedVectorToClosedRectangle(page)
    await configureConstrainedDashedStroke(page, {
      elementType: 'vector',
      position: 'outside',
      join: 'bevel',
      cap: 'butt',
      pattern: ORTHOGONAL_80X40_SINGLE_EDGE_PATTERN,
      offset: ORTHOGONAL_80X40_SINGLE_EDGE_OFFSET
    })

    const vectorRaster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const vectorProbes = getRectSingleEdgeProbeRegions(vectorRaster)
    const [vectorInterval, vectorGap, vectorCenter] = await Promise.all([
      getGreenCoverage(page, vectorRaster, vectorProbes.intervalOutside),
      getGreenCoverage(page, vectorRaster, vectorProbes.laterTopOutsideGap),
      getGreenCoverage(page, vectorRaster, vectorProbes.center)
    ])

    expect(rectInterval).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(vectorInterval).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(Math.abs(rectInterval - vectorInterval)).toBeLessThan(0.08)
    expect(rectGap).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
    expect(vectorGap).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
    expect(Math.abs(rectGap - vectorGap)).toBeLessThan(0.03)
    expect(rectCenter).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
    expect(vectorCenter).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
    expect(Math.abs(rectCenter - vectorCenter)).toBeLessThan(0.03)
  })
})
