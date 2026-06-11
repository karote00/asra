/* eslint-disable @typescript-eslint/no-unused-vars */
import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
import {
  createOval,
  createRectangle,
  createVectorPath,
  getCanvasPosition,
  getPropertiesPanel,
  getSelectedElementRect,
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
  scale: number
  source: { x: number; y: number; width: number; height: number }
}

const PADDING = 24
const STROKE_WIDTH = 10
const MIN_SUPPORTED_COVERAGE = 0.6
const MAX_UNSUPPORTED_COVERAGE = 0.03
const MAX_EXTERIOR_LEAK = 0.12
const MAX_CAP_VARIANCE = 0.12
const MIN_MITER_TIP_COVERAGE = 0.18
const STROKE_COLOR = '00FF00'
const REPORTED_VECTOR_6_PRODUCT_STROKE_COLOR = 'DF0606'
const REPORTED_VECTOR_6_LOCAL_SCALE = 14
const REPORTED_VECTOR_6_LOCAL_WIDTH = 460
const REPORTED_VECTOR_6_LOCAL_HEIGHT = 400

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

const cropSelectedElementRaster = async (
  page: Page,
  raster: RasterCapture,
  localCenter: { x: number; y: number },
  options: { scale?: number; width?: number; height?: number } = {}
): Promise<LocalRasterCapture> => {
  const scale = options.scale ?? 10
  const width = options.width ?? 360
  const height = options.height ?? 300
  const sourceWidth = width / scale
  const sourceHeight = height / scale
  const source = {
    x: raster.padding + localCenter.x - sourceWidth / 2,
    y: raster.padding + localCenter.y - sourceHeight / 2,
    width: sourceWidth,
    height: sourceHeight
  }

  const base64 = await page.evaluate(
    async ({ base64, height, source, width }) => {
      const response = await fetch(`data:image/png;base64,${base64}`)
      const blob = await response.blob()
      const bitmap = await createImageBitmap(blob)
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) {
        throw new Error('Canvas 2D context unavailable')
      }

      context.imageSmoothingEnabled = false
      context.drawImage(
        bitmap,
        source.x,
        source.y,
        source.width,
        source.height,
        0,
        0,
        width,
        height
      )
      return canvas.toDataURL('image/png').split(',')[1] ?? ''
    },
    {
      base64: raster.base64,
      height,
      source,
      width
    }
  )

  return {
    base64,
    width,
    height,
    scale,
    source
  }
}

const attachPng = async (label: string, base64: string, testInfo: TestInfo) => {
  await writeFile(testInfo.outputPath(label), Buffer.from(base64, 'base64'))
  await testInfo.attach(label, {
    body: Buffer.from(base64, 'base64'),
    contentType: 'image/png'
  })
}

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

const getStrokeDebugDisableVisualOverlapCollapse = async (page: Page) =>
  page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    return (
      core?.getSystemProperty?.('strokeDebugDisableVisualOverlapCollapse') ===
      true
    )
  })

const getGreenCoverage = async (
  page: Page,
  raster: RasterCapture,
  region: { x: number; y: number; width: number; height: number }
) =>
  page.evaluate(
    async ({
      base64,
      region: targetRegion
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

const getBase64GreenCoverage = async (
  page: Page,
  base64: string,
  region: { x: number; y: number; width: number; height: number }
) =>
  page.evaluate(
    async ({
      base64,
      region: targetRegion
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
      base64,
      region
    }
  )

const getBase64RedCoverage = async (
  page: Page,
  base64: string,
  region: { x: number; y: number; width: number; height: number }
) =>
  page.evaluate(
    async ({
      base64,
      region: targetRegion
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
          if (
            a > 120 &&
            r > 95 &&
            g < 80 &&
            b < 80 &&
            r - g > 35 &&
            r - b > 35
          ) {
            red += 1
          }
        }
      }

      return total > 0 ? red / total : 0
    },
    {
      base64,
      region
    }
  )

const getBase64DoubleRedCoverage = async (
  page: Page,
  base64: string,
  region: { x: number; y: number; width: number; height: number }
) =>
  page.evaluate(
    async ({
      base64,
      region: targetRegion
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
      let doubleRed = 0
      for (let y = startY; y < endY; y += 1) {
        for (let x = startX; x < endX; x += 1) {
          const [r, g, b, a] = context.getImageData(x, y, 1, 1).data
          total += 1
          if (
            a > 180 &&
            r > 150 &&
            g < 55 &&
            b < 55 &&
            r - g > 95 &&
            r - b > 95
          ) {
            doubleRed += 1
          }
        }
      }

      return total > 0 ? doubleRed / total : 0
    },
    {
      base64,
      region
    }
  )

const getRedCoverage = async (
  page: Page,
  raster: RasterCapture,
  region: { x: number; y: number; width: number; height: number }
) => getBase64RedCoverage(page, raster.base64, targetRegion(region, raster))

const targetRegion = (
  region: { x: number; y: number; width: number; height: number },
  raster: RasterCapture
) => ({
  x: Math.max(0, region.x),
  y: Math.max(0, region.y),
  width: Math.min(region.width, raster.width - region.x),
  height: Math.min(region.height, raster.height - region.y)
})

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
    },
    center: {
      x: raster.padding + raster.elementWidth / 2 - 4,
      y: raster.padding + raster.elementHeight / 2 - 4,
      width: 8,
      height: 8
    }
  }
}

const getOpenPolylineProbeRegions = (raster: RasterCapture) => {
  const bandWidth = 4
  const bandHeight = Math.max(2, raster.strokeWidthPx - 2)

  return {
    topLine: {
      x: raster.padding + raster.elementWidth / 2 - bandWidth / 2,
      y: raster.padding - bandHeight / 2,
      width: bandWidth,
      height: bandHeight
    },
    rightLine: {
      x: raster.padding + raster.elementWidth - bandHeight / 2,
      y: raster.padding + raster.elementHeight / 2 - bandWidth / 2,
      width: bandHeight,
      height: bandWidth
    },
    centerGap: {
      x: raster.padding + raster.elementWidth / 2 - 4,
      y: raster.padding + raster.elementHeight / 2 - 4,
      width: 8,
      height: 8
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

const getLocalPointProbeRegion = (
  raster: RasterCapture,
  point: Vec2,
  size = 8
) => ({
  x: raster.padding + point.x - size / 2,
  y: raster.padding + point.y - size / 2,
  width: size,
  height: size
})

const getReportedVector6InsideSolidProbeRegions = (raster: RasterCapture) => {
  const px = raster.padding
  return {
    topSharpLeftExterior: {
      // Keep this probe outside the legal top stroke band. The old probe at
      // x=px+170/y=px+2 overlapped the intended inside stroke near tp-12 and
      // forced a false "exterior leak" failure.
      x: px + 146,
      y: px + 0,
      width: 18,
      height: 18
    },
    topSharpRightExterior: {
      // Symmetric true-exterior probe for the right side of tp-12. Keep it
      // outside the intended upper stroke edge instead of sampling the band.
      x: px + 214,
      y: px + 0,
      width: 18,
      height: 18
    },
    leftSharpExterior: {
      // True exterior left of tp-15. The previous probe overlapped the
      // intended descending stroke band and measured valid coverage.
      x: px - 12,
      y: px + 40,
      width: 14,
      height: 20
    },
    rightSharpUpperExterior: {
      // True void above the right sharp endpoint. The previous probe overlapped
      // the legal upper stroke band and forced valid geometry to be treated as
      // an exterior leak.
      x: px + 336,
      y: px + 88,
      width: 24,
      height: 18
    },
    rightSharpLowerExterior: {
      // This must sample the actual void below the right sharp endpoint.
      // The old probe overlapped the legitimate inside stroke band and
      // incorrectly forced self-intersection-style clipping.
      x: px + 327,
      y: px + 182,
      width: 24,
      height: 24
    },
    lowerCurveExterior: {
      x: px + 296,
      y: px + 320,
      width: 24,
      height: 24
    },
    crossingInteriorStroke: {
      // Positive probe for an authored crossing segment. Keep it in the stroke
      // core rather than straddling the antialiased edge, otherwise tiny raster
      // shifts can incorrectly report missing coverage.
      x: px + 204,
      y: px + 88,
      width: 20,
      height: 14
    },
    unrelatedCrossingVoid: {
      x: px + 290,
      y: px + 45,
      width: 28,
      height: 28
    },
    bridgedUpperVoid: {
      x: px + 250,
      y: px + 58,
      width: 42,
      height: 28
    },
    bridgedRightVoid: {
      // Void between the two right-side stroke bands. This catches a giant
      // bridge face without sampling the legal sharp-end join at tp-14.
      x: px + 326,
      y: px + 141,
      width: 12,
      height: 18
    }
  }
}

interface ReportedVector6LocalVisualTarget {
  label: string
  center: { x: number; y: number }
  minCoverage: number
  maxCoverage: number
}

interface ReportedVector6PointProbe {
  label: string
  point: { x: number; y: number }
  size?: number
  minCoverage?: number
  maxCoverage?: number
}

interface Vec2 {
  x: number
  y: number
}

type ReportedVector6PointOverrides = Record<string, Partial<Vec2>>

const cubicPoint = (p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t: number) => {
  const oneMinusT = 1 - t
  const a = oneMinusT * oneMinusT * oneMinusT
  const b = 3 * oneMinusT * oneMinusT * t
  const c = 3 * oneMinusT * t * t
  const d = t * t * t
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y
  }
}

const reportedVector6EndpointVisualTargets: ReportedVector6LocalVisualTarget[] =
  [
    {
      label: 'endpoint-tp-12-top',
      center: { x: 192.42083700791653, y: 0 },
      minCoverage: 0.002,
      maxCoverage: 0.42
    },
    {
      label: 'endpoint-tp-13-bottom-left-curve',
      center: { x: 11.358174406717296, y: 364.1297089212308 },
      minCoverage: 0.002,
      maxCoverage: 0.42
    },
    {
      label: 'endpoint-tp-14-right',
      center: { x: 360.120941483566, y: 144.31562775593738 },
      minCoverage: 0.002,
      // This crop includes the legal miter/join plus both adjacent segment
      // bodies. Exterior leaks are covered by the forbidden bridge probes; a
      // lower total-coverage ceiling incorrectly rejects the required miter.
      maxCoverage: 0.58
    },
    {
      label: 'endpoint-tp-15-left',
      center: { x: 0, y: 14.030686031827244 },
      minCoverage: 0.002,
      // Same as tp-14: the high-zoom endpoint crop intentionally contains a
      // dense legal join region. This threshold prevents accidental filled
      // bridges without treating a valid miter as an exterior leak.
      maxCoverage: 0.62
    },
    {
      label: 'endpoint-tp-16-bottom-right-curve',
      center: { x: 270.59180204238254, y: 345.42212754546125 },
      minCoverage: 0.002,
      // This endpoint sits where a cubic segment and a steep line meet. The
      // correct local crop contains a relatively dense legal stroke band, so
      // the cap is valid below the broader bridge threshold used elsewhere.
      maxCoverage: 0.46
    }
  ]

const reportedVector6SelfIntersectionVisualTargets: ReportedVector6LocalVisualTarget[] =
  [
    {
      label: 'self-intersection-upper-cross',
      center: { x: 215.77, y: 92.09 },
      minCoverage: 0.004,
      maxCoverage: 0.75
    },
    {
      label: 'self-intersection-left-cross',
      center: { x: 112.42, y: 160.22 },
      minCoverage: 0.004,
      maxCoverage: 0.75
    },
    {
      label: 'self-intersection-center-cross',
      center: { x: 164.19, y: 73.43 },
      minCoverage: 0.004,
      maxCoverage: 0.75
    },
    {
      label: 'self-intersection-lower-cross',
      center: { x: 200.81, y: 271.31 },
      minCoverage: 0.004,
      maxCoverage: 0.77
    },
    {
      label: 'self-intersection-right-cross',
      center: { x: 250.12, y: 234.23 },
      minCoverage: 0.004,
      maxCoverage: 0.75
    }
  ]

const reportedVector6SegmentBodyVisualTargets: ReportedVector6LocalVisualTarget[] =
  [
    {
      label: 'segment-ts-23-cubic-near-top',
      center: { x: 158, y: 78 },
      minCoverage: 0.08,
      maxCoverage: 0.82
    },
    {
      label: 'segment-ts-23-cubic-mid',
      center: { x: 112, y: 162 },
      minCoverage: 0.08,
      maxCoverage: 0.82
    },
    {
      label: 'segment-ts-23-cubic-lower',
      center: { x: 73.48, y: 218.9 },
      minCoverage: 0.08,
      maxCoverage: 0.82
    },
    {
      label: 'segment-ts-24-line-near-left',
      center: { x: 78, y: 346 },
      minCoverage: 0.08,
      maxCoverage: 0.82
    },
    {
      label: 'segment-ts-24-line-mid',
      center: { x: 210.79, y: 263.99 },
      minCoverage: 0.08,
      // Asyra canonical filled-face solid domains legitimately cover this crop a bit
      // more than the retired source-path local-side approximation.
      maxCoverage: 0.88
    },
    {
      label: 'segment-ts-24-line-near-right',
      center: { x: 310, y: 196 },
      minCoverage: 0.08,
      maxCoverage: 0.82
    },
    {
      label: 'segment-ts-25-line-near-right',
      center: { x: 318, y: 128 },
      minCoverage: 0.08,
      maxCoverage: 0.82
    },
    {
      label: 'segment-ts-25-line-mid',
      center: { x: 180.06, y: 79.17 },
      minCoverage: 0.08,
      maxCoverage: 0.82
    },
    {
      label: 'segment-ts-25-line-near-left',
      center: { x: 72, y: 40 },
      minCoverage: 0.08,
      maxCoverage: 0.82
    },
    {
      label: 'segment-ts-26-cubic-near-left',
      center: { x: 48, y: 58 },
      minCoverage: 0.08,
      maxCoverage: 0.82
    },
    {
      label: 'segment-ts-26-cubic-mid',
      center: { x: 132.79, y: 186.24 },
      minCoverage: 0.08,
      maxCoverage: 0.82
    },
    {
      label: 'segment-ts-26-cubic-lower',
      center: { x: 218, y: 302 },
      minCoverage: 0.08,
      maxCoverage: 0.82
    },
    {
      label: 'segment-ts-27-cubic-lower',
      center: { x: 266, y: 296 },
      minCoverage: 0.08,
      maxCoverage: 0.82
    },
    {
      label: 'segment-ts-27-cubic-mid',
      center: { x: 234.01, y: 166.2 },
      minCoverage: 0.08,
      maxCoverage: 0.82
    },
    {
      label: 'segment-ts-27-cubic-near-top',
      center: { x: 210, y: 70 },
      minCoverage: 0.08,
      maxCoverage: 0.82
    }
  ]

const reportedVector6RequiredStrokeProbes: ReportedVector6PointProbe[] = [
  {
    label: 'ts-23 cubic upper core',
    point: { x: 167, y: 60 },
    minCoverage: 0.2
  },
  {
    label: 'ts-23 cubic middle core',
    point: { x: 116, y: 158 },
    minCoverage: 0.22
  },
  {
    label: 'ts-23 cubic lower core',
    point: { x: 45.5, y: 261.4 },
    minCoverage: 0.18
  },
  {
    label: 'ts-24 line lower-left core',
    point: { x: 82, y: 352 },
    minCoverage: 0.1
  },
  {
    label: 'ts-24 line middle core',
    point: { x: 194, y: 279 },
    minCoverage: 0.22
  },
  {
    label: 'ts-24 line upper-right core',
    point: { x: 298, y: 196 },
    minCoverage: 0.22
  },
  {
    label: 'ts-25 line right core',
    point: { x: 314, y: 128 },
    minCoverage: 0.22
  },
  {
    label: 'ts-25 line middle core',
    point: { x: 190, y: 84 },
    minCoverage: 0.22
  },
  {
    label: 'ts-25 line left core',
    point: { x: 72, y: 41 },
    minCoverage: 0.18
  },
  {
    label: 'ts-26 cubic left core',
    point: { x: 39.3, y: 65.6 },
    minCoverage: 0.18
  },
  {
    label: 'ts-26 cubic middle core',
    point: { x: 134, y: 186 },
    minCoverage: 0.22
  },
  {
    label: 'ts-26 cubic lower core',
    point: { x: 222, y: 302 },
    minCoverage: 0.18
  },
  {
    label: 'ts-27 cubic lower core',
    point: { x: 265, y: 296 },
    minCoverage: 0.18
  },
  {
    label: 'ts-27 cubic middle core',
    point: { x: 235, y: 167 },
    minCoverage: 0.22
  },
  {
    label: 'ts-27 cubic upper core',
    point: { x: 209, y: 70 },
    minCoverage: 0.18
  }
]

const reportedVector6ForbiddenBridgeProbes: ReportedVector6PointProbe[] = [
  {
    label: 'upper-left empty face',
    point: { x: 120, y: 80 },
    maxCoverage: 0.05
  },
  {
    label: 'upper-right empty face',
    point: { x: 292, y: 72 },
    maxCoverage: 0.05
  },
  {
    label: 'right interior empty face',
    point: { x: 315, y: 150 },
    maxCoverage: 0.05
  },
  {
    label: 'center interior empty face',
    point: { x: 168, y: 165 },
    maxCoverage: 0.05
  },
  {
    label: 'lower-right interior empty face',
    // This probe must sit in a true empty face, not on the legal ts-27
    // source-span band. The previous point was within ~15px of ts-27 and
    // failed when the correct one-sided body got thicker around the curve.
    point: { x: 285, y: 245 },
    maxCoverage: 0.05
  }
]

const getReportedVector6DenseSegmentCoverageProbes = (
  pointOverrides: ReportedVector6PointOverrides = {}
): ReportedVector6PointProbe[] => {
  const basePoints: Record<string, Vec2> = {
    'tp-12': { x: 192.42083700791653, y: 0 },
    'tp-13': { x: 11.358174406717296, y: 364.1297089212308 },
    'tp-12:out': { x: 170.10536493824844, y: 119.07041481724248 },
    'tp-13:in': { x: -42.09205809548172, y: 343.2841182453731 },
    'tp-13:out': { x: 78.17096503446606, y: 390.18669726605293 },
    'tp-14': { x: 360.120941483566, y: 144.31562775593738 },
    'tp-15': { x: 0, y: 14.030686031827244 },
    'tp-15:out': { x: 0, y: 14.030686031827244 },
    'tp-16': { x: 270.59180204238254, y: 345.42212754546125 },
    'tp-16:in': { x: 263.9105229796076, y: 362.79345310867603 },
    'tp-16:out': { x: 277.2730811051575, y: 328.05080198224647 }
  }
  const points = Object.fromEntries(
    Object.entries(basePoints).map(([pointId, point]) => [
      pointId,
      { ...point, ...(pointOverrides[pointId] ?? {}) }
    ])
  ) as Record<string, Vec2>
  const segments = [
    {
      id: 'ts-23',
      start: 'tp-12',
      end: 'tp-13',
      out: 'tp-12:out',
      in: 'tp-13:in'
    },
    {
      id: 'ts-24',
      start: 'tp-13',
      end: 'tp-14',
      out: 'tp-13:out',
      in: null
    },
    {
      id: 'ts-25',
      start: 'tp-14',
      end: 'tp-15',
      out: null,
      in: null
    },
    {
      id: 'ts-26',
      start: 'tp-15',
      end: 'tp-16',
      out: 'tp-15:out',
      in: 'tp-16:in'
    },
    {
      id: 'ts-27',
      start: 'tp-16',
      end: 'tp-12',
      out: 'tp-16:out',
      in: null
    }
  ]
  const ratios = [
    0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7,
    0.75, 0.8, 0.85, 0.9, 0.95
  ]

  return segments.flatMap((segment) => {
    const p0 = points[segment.start]
    const p3 = points[segment.end]
    const p1 = segment.out ? points[segment.out] : p0
    const p2 = segment.in ? points[segment.in] : p3
    return ratios.map((ratio) => ({
      label: `${segment.id} dense source coverage ${ratio}`,
      point: cubicPoint(p0, p1, p2, p3, ratio),
      size: 10,
      minCoverage: 0.04
    }))
  })
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

const ensureSelectedStrokeRow = async (page: Page) => {
  const propertiesPanel = getPropertiesPanel(page)
  if (await propertiesPanel.getByTestId('prop-strokes-empty').isVisible()) {
    await propertiesPanel.getByTestId('prop-stroke-add').click()
  }

  await expect(propertiesPanel.getByTestId('prop-stroke-0')).toBeVisible()
}

const configureSelectedStroke = async (
  page: Page,
  config: {
    elementType?: 'rect' | 'oval' | 'vector'
    position: 'center' | 'inside' | 'outside'
    join: 'miter' | 'bevel' | 'round'
    cap: 'butt' | 'square' | 'round'
    width?: number
    color?: string
    opacity?: number
  }
) => {
  await ensureElementSelected(page, config.elementType)
  const propertiesPanel = getPropertiesPanel(page)
  await ensureSelectedStrokeRow(page)

  const width = String(config.width ?? STROKE_WIDTH)
  const color = config.color ?? STROKE_COLOR

  await propertiesPanel
    .getByTestId('prop-stroke-style-0')
    .selectOption('solid', { force: true })
  await propertiesPanel
    .getByTestId('prop-stroke-position-0')
    .selectOption(config.position, { force: true })
  await propertiesPanel
    .getByTestId('prop-stroke-join-0')
    .selectOption(config.join, { force: true })
  await propertiesPanel
    .getByTestId('prop-stroke-cap-0')
    .selectOption(config.cap, { force: true })
  await propertiesPanel.getByTestId('prop-stroke-width-0').fill(width)
  await propertiesPanel.getByTestId('prop-stroke-width-0').press('Enter')
  await propertiesPanel.getByTestId('prop-stroke-color-0').fill(color)
  await propertiesPanel.getByTestId('prop-stroke-color-0').press('Enter')
  if (config.opacity !== undefined) {
    await propertiesPanel
      .getByTestId('prop-stroke-opacity-0')
      .fill(String(config.opacity))
    await propertiesPanel.getByTestId('prop-stroke-opacity-0').press('Enter')
  }
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
      joinType: stroke.joinType,
      capType: stroke.capType
    }
  }, strokeIndex)

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
        fills: [],
        width: 80,
        height: 40
      },
      { undoable: false }
    )
  })

  await page.waitForTimeout(180)
}

const patchSelectedVectorToClosedSharpSeamWithoutClosingSegment = async (
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
            closed: true
          }
        },
        closed: true,
        fills: [],
        width: 80,
        height: 100
      },
      { undoable: false }
    )
  })

  await page.waitForTimeout(180)
}

const patchSelectedVectorToClosedSmoothCurveCornerSeam = async (page: Page) => {
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
      b: { id: 'b', kind: 'anchor', x: 80, y: 100, anchorType: 'sharp' },
      c: { id: 'c', kind: 'anchor', x: 0, y: 100, anchorType: 'sharp' },
      'c:out': {
        id: 'c:out',
        kind: 'control',
        x: 0,
        y: 80,
        controlForId: 'c',
        controlRole: 'out'
      },
      'a:in': {
        id: 'a:in',
        kind: 'control',
        x: 20,
        y: 0,
        controlForId: 'a',
        controlRole: 'in'
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
      },
      ca: {
        id: 'ca',
        startId: 'c',
        endId: 'a',
        outControlId: 'c:out',
        inControlId: 'a:in'
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
        fills: [],
        width: 80,
        height: 100
      },
      { undoable: false }
    )
  })

  await page.waitForTimeout(180)
}

const patchSelectedVectorToOpenPolyline = async (page: Page) => {
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
      c: { id: 'c', kind: 'anchor', x: 80, y: 40, anchorType: 'sharp' }
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
        width: 80,
        height: 40
      },
      { undoable: false }
    )
  })

  await page.waitForTimeout(180)
}

const patchSelectedVectorToSelfIntersectingBowtie = async (page: Page) => {
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
      b: { id: 'b', kind: 'anchor', x: 80, y: 40, anchorType: 'sharp' },
      c: { id: 'c', kind: 'anchor', x: 0, y: 40, anchorType: 'sharp' },
      d: { id: 'd', kind: 'anchor', x: 80, y: 0, anchorType: 'sharp' }
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

const _patchSelectedVectorToReportedVector6 = async (page: Page) => {
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

    core?.changeComputedData?.(
      [selectedId],
      {
        points,
        segments,
        networks: {
          [primaryNetwork.id]: {
            id: primaryNetwork.id,
            pointIds: ['tp-12', 'tp-13', 'tp-14', 'tp-15', 'tp-16'],
            segmentIds: ['ts-23', 'ts-24', 'ts-25', 'ts-26', 'ts-27'],
            closed: true
          }
        },
        closed: true,
        width: 360.120941483566,
        height: 366.06359840210007
      },
      { undoable: false }
    )
  })

  await page.waitForTimeout(180)
}

const _setSelectedVectorReportedSolidStroke = async (
  page: Page,
  options: { color?: string; opacity?: number } = {}
) => {
  await page.evaluate(
    ({ color, opacity }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      const selectedId = core?.deps?.selection?.getElementSelectionIds?.()?.[0]
      if (!selectedId) {
        throw new Error('No selected vector for stroke patch')
      }

      const element = core?.deps?.sceneTree?.getElementById?.(selectedId)
      const computed = element?.getAllComputedData?.() ?? {}
      const baseStroke = Array.isArray(computed.strokes)
        ? (computed.strokes[0] ?? {})
        : {}
      core?.changeComputedData?.(
        [selectedId],
        {
          strokes: [
            {
              ...baseStroke,
              id: baseStroke.id ?? 'reported-vector-6-solid-inside',
              kind: 'solid',
              style: 'solid',
              position: 'inside',
              width: 10,
              dashPattern: [],
              dashOffset: 0,
              color: `#${color}`,
              opacity: opacity === undefined ? 1 : opacity / 100,
              visible: true,
              gradient: null,
              fill: null,
              defaultColorFormat: 'hex',
              colorFormat: 'hex',
              joinType: 'miter',
              capType: 'butt',
              miterAngle: 28.96
            }
          ]
        },
        { undoable: false }
      )
    },
    {
      color: options.color ?? STROKE_COLOR,
      opacity: options.opacity
    }
  )

  await page.waitForTimeout(180)
}

const createReportedVector6InsideSolid = async (
  page: Page,
  options: {
    color?: string
    opacity?: number
    pointOverrides?: ReportedVector6PointOverrides
  } = {}
) => {
  await page.evaluate(
    ({ color, opacity, pointOverrides }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      const basePoints = {
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
      const origin = { x: 220, y: 159 }
      const localPoints = Object.fromEntries(
        Object.entries(basePoints).map(([pointId, point]) => [
          pointId,
          {
            ...point,
            ...(pointOverrides?.[pointId] ?? {})
          }
        ])
      )
      const points = Object.fromEntries(
        Object.entries(localPoints).map(([pointId, point]) => [
          pointId,
          {
            ...point,
            x: point.x + origin.x,
            y: point.y + origin.y
          }
        ])
      )
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const elementApis = (window as any).__AsyraE2E__?.elementApis
      const createdId = elementApis?.createElement?.(
        {
          type: 'vector',
          points,
          segments,
          networks: {
            'tn-4': {
              id: 'tn-4',
              pointIds: ['tp-12', 'tp-13', 'tp-14', 'tp-15', 'tp-16'],
              segmentIds: ['ts-23', 'ts-24', 'ts-25', 'ts-26', 'ts-27'],
              closed: true
            }
          },
          closed: true,
          pointCoordinateSpace: 'workspace'
        },
        { undoable: false }
      )
      if (!createdId) {
        throw new Error('Failed to create reported vector-6 fixture')
      }
      elementApis?.changeComputedData?.(
        [createdId],
        {
          x: origin.x,
          y: origin.y,
          width: 360.120941483566,
          height: 366.06359840210007,
          points,
          segments,
          networks: {
            'tn-4': {
              id: 'tn-4',
              pointIds: ['tp-12', 'tp-13', 'tp-14', 'tp-15', 'tp-16'],
              segmentIds: ['ts-23', 'ts-24', 'ts-25', 'ts-26', 'ts-27'],
              closed: true
            }
          },
          closed: true,
          pointCoordinateSpace: 'workspace',
          fills: [],
          strokes: [
            {
              id: 'reported-vector-6-solid-inside',
              kind: 'solid',
              style: 'solid',
              position: 'inside',
              width: 10,
              dashPattern: [],
              dashOffset: 0,
              fill: null,
              defaultColorFormat: 'hex',
              colorFormat: 'hex',
              color: `#${color}`,
              opacity: opacity === undefined ? 1 : opacity / 100,
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
    },
    {
      color: options.color ?? STROKE_COLOR,
      opacity: options.opacity,
      pointOverrides: options.pointOverrides ?? {}
    }
  )

  await clearVectorOverlayState(page)
  await ensureElementSelected(page, 'vector')
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

const prepareReportedVector6InsideSolid = async (
  page: Page,
  options: {
    color?: string
    opacity?: number
    pointOverrides?: ReportedVector6PointOverrides
  } = {}
) => {
  await createReportedVector6InsideSolid(page, options)
  if (process.env.ASYRA_DEBUG_REPORTED_VECTOR6 === '1') {
    const _debugComputed = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      const selectedId =
        core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
      const element = selectedId
        ? core?.deps?.sceneTree?.getElementById?.(selectedId)
        : null
      const computed = element?.getAllComputedData?.() ?? {}
      const renderElement = selectedId
        ? core?.deps?.render?.getElementById?.(selectedId)
        : null
      const root = core?.deps?.render?.viewport?.view as
        | { label?: string; children?: unknown[] }
        | undefined
      const labels: string[] = []
      const stack: { label?: string; children?: unknown[] }[] = root
        ? [root]
        : []
      while (stack.length > 0) {
        const current = stack.pop()
        if (!current) {
          continue
        }
        if (current.label) {
          labels.push(current.label)
        }
        current.children?.forEach((child: unknown) =>
          stack.push(child as { label?: string; children?: unknown[] })
        )
      }
      return {
        selectedId,
        x: computed.x,
        y: computed.y,
        width: computed.width,
        height: computed.height,
        pointCount: Object.keys(computed.points ?? {}).length,
        segmentCount: Object.keys(computed.segments ?? {}).length,
        networkCount: Object.keys(computed.networks ?? {}).length,
        visible: computed.visible,
        opacity: computed.opacity,
        zoom: core?.getSystemProperty?.('zoom') ?? null,
        viewport: core?.getSystemProperty?.('viewportPosition') ?? null,
        strokes: computed.strokes,
        renderCacheSize: renderElement?.__asyraStrokeMeshCache?.size ?? null,
        renderDiagnostics:
          renderElement?.__asyraConstrainedSolidRuntimeDiagnostics ?? null,
        renderLabels: labels.slice(0, 40)
      }
    })
  }
  // The exact geometry backend may load asynchronously after the first paint.
  // These tests validate settled product geometry, not the optimistic preview.
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
      renderCacheSize: renderElement?.__asyraStrokeMeshCache?.size ?? 0,
      exportPacketCount: exportPackets.length,
      exportPacketDebugMeta: exportPackets.map(
        (packet: { debugMeta?: Record<string, unknown> }) =>
          packet.debugMeta ?? {}
      )
    }
  })

const captureReportedVector6LocalTarget = async (
  page: Page,
  raster: RasterCapture,
  target: ReportedVector6LocalVisualTarget,
  testInfo: TestInfo,
  groupLabel: string
) => {
  const localRaster = await cropSelectedElementRaster(
    page,
    raster,
    target.center,
    {
      scale: REPORTED_VECTOR_6_LOCAL_SCALE,
      width: REPORTED_VECTOR_6_LOCAL_WIDTH,
      height: REPORTED_VECTOR_6_LOCAL_HEIGHT
    }
  )
  await attachPng(
    `reported-vector-6-solid-inside-${groupLabel}-${target.label}.png`,
    localRaster.base64,
    testInfo
  )
  const localCoverage = await getBase64GreenCoverage(page, localRaster.base64, {
    x: 0,
    y: 0,
    width: localRaster.width,
    height: localRaster.height
  })

  return { localCoverage, localRaster }
}

const getReportedVector6PointProbeRegion = (
  raster: RasterCapture,
  probe: ReportedVector6PointProbe
) => {
  const size = probe.size ?? 14
  return {
    x: raster.padding + probe.point.x - size / 2,
    y: raster.padding + probe.point.y - size / 2,
    width: size,
    height: size
  }
}

const assertReportedVector6GreenPointProbes = async (
  page: Page,
  raster: RasterCapture,
  probes: ReportedVector6PointProbe[]
) => {
  const results = await Promise.all(
    probes.map(async (probe) => ({
      probe,
      coverage: await getGreenCoverage(
        page,
        raster,
        getReportedVector6PointProbeRegion(raster, probe)
      )
    }))
  )

  for (const { coverage, probe } of results) {
    if (probe.minCoverage !== undefined) {
      expect(coverage, `${probe.label}: required coverage`).toBeGreaterThan(
        probe.minCoverage
      )
    }
    if (probe.maxCoverage !== undefined) {
      expect(coverage, `${probe.label}: forbidden coverage`).toBeLessThan(
        probe.maxCoverage
      )
    }
  }
}

const assertReportedVector6RedPointProbes = async (
  page: Page,
  raster: RasterCapture,
  probes: ReportedVector6PointProbe[]
) => {
  const results = await Promise.all(
    probes.map(async (probe) => ({
      probe,
      coverage: await getRedCoverage(
        page,
        raster,
        getReportedVector6PointProbeRegion(raster, probe)
      )
    }))
  )

  for (const { coverage, probe } of results) {
    if (probe.minCoverage !== undefined) {
      expect(coverage, `${probe.label}: required red coverage`).toBeGreaterThan(
        probe.minCoverage
      )
    }
    if (probe.maxCoverage !== undefined) {
      expect(coverage, `${probe.label}: forbidden red coverage`).toBeLessThan(
        probe.maxCoverage
      )
    }
  }
}

test.describe('Constrained Solid Stroke Primitive Visual Benchmarks', () => {
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

  test('benchmark: rectangle inside bevel keeps full supported band coverage', async ({
    page
  }) => {
    await createRectangle(page, 0.3, 0.3)
    await configureSelectedStroke(page, {
      elementType: 'rect',
      position: 'inside',
      join: 'bevel',
      cap: 'butt'
    })

    const raster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const probes = getRectProbeRegions(raster)

    const [topInside, topOutside, leftInside, center] = await Promise.all([
      getGreenCoverage(page, raster, probes.topInside),
      getGreenCoverage(page, raster, probes.topOutside),
      getGreenCoverage(page, raster, probes.leftInside),
      getGreenCoverage(page, raster, probes.center)
    ])

    expect(topInside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(leftInside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(topOutside).toBeLessThan(MAX_EXTERIOR_LEAK)
    expect(center).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
  })

  test('benchmark: rectangle outside bevel keeps full supported outer band coverage', async ({
    page
  }) => {
    await createRectangle(page, 0.3, 0.3)
    await configureSelectedStroke(page, {
      elementType: 'rect',
      position: 'outside',
      join: 'bevel',
      cap: 'butt'
    })

    const raster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const probes = getRectProbeRegions(raster)

    const [topOutside, topInside, leftOutside, center] = await Promise.all([
      getGreenCoverage(page, raster, probes.topOutside),
      getGreenCoverage(page, raster, probes.topInside),
      getGreenCoverage(page, raster, probes.leftOutside),
      getGreenCoverage(page, raster, probes.center)
    ])

    expect(topOutside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(leftOutside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(topInside).toBeLessThan(MAX_EXTERIOR_LEAK)
    expect(center).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
  })

  test('benchmark: rectangle inside miter keeps full supported band coverage', async ({
    page
  }) => {
    await createRectangle(page, 0.3, 0.3)
    await configureSelectedStroke(page, {
      elementType: 'rect',
      position: 'inside',
      join: 'miter',
      cap: 'butt'
    })

    const raster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const probes = getRectProbeRegions(raster)

    const [topInside, topOutside, leftInside, center] = await Promise.all([
      getGreenCoverage(page, raster, probes.topInside),
      getGreenCoverage(page, raster, probes.topOutside),
      getGreenCoverage(page, raster, probes.leftInside),
      getGreenCoverage(page, raster, probes.center)
    ])

    expect(topInside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(leftInside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(topOutside).toBeLessThan(MAX_EXTERIOR_LEAK)
    expect(center).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
  })

  test('benchmark: rectangle outside miter keeps full supported outer band coverage', async ({
    page
  }) => {
    await createRectangle(page, 0.3, 0.3)
    await configureSelectedStroke(page, {
      elementType: 'rect',
      position: 'outside',
      join: 'miter',
      cap: 'butt'
    })

    const raster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const probes = getRectProbeRegions(raster)

    const [topOutside, topInside, leftOutside, center] = await Promise.all([
      getGreenCoverage(page, raster, probes.topOutside),
      getGreenCoverage(page, raster, probes.topInside),
      getGreenCoverage(page, raster, probes.leftOutside),
      getGreenCoverage(page, raster, probes.center)
    ])

    expect(topOutside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(leftOutside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(topInside).toBeLessThan(MAX_EXTERIOR_LEAK)
    expect(center).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
  })

  test('benchmark: oval inside bevel stays visually smooth enough to keep the sampled inside band covered', async ({
    page
  }) => {
    await createOval(page, 0.35, 0.35)
    await configureSelectedStroke(page, {
      elementType: 'oval',
      position: 'inside',
      join: 'bevel',
      cap: 'butt',
      width: 8
    })

    const raster = await captureSelectedElementRaster(page, 8)
    const probes = getOvalProbeRegions(raster)

    const [topInside, topOutside, leftInside, leftOutside] = await Promise.all([
      getGreenCoverage(page, raster, probes.topInside),
      getGreenCoverage(page, raster, probes.topOutside),
      getGreenCoverage(page, raster, probes.leftInside),
      getGreenCoverage(page, raster, probes.leftOutside)
    ])

    expect(topInside).toBeGreaterThan(0.45)
    expect(leftInside).toBeGreaterThan(0.45)
    expect(topOutside).toBeLessThan(MAX_EXTERIOR_LEAK)
    expect(leftOutside).toBeLessThan(MAX_EXTERIOR_LEAK)
  })

  test('benchmark: oval inside miter keeps the sampled inside band covered', async ({
    page
  }) => {
    await createOval(page, 0.35, 0.35)
    await configureSelectedStroke(page, {
      elementType: 'oval',
      position: 'inside',
      join: 'miter',
      cap: 'butt',
      width: 8
    })

    const raster = await captureSelectedElementRaster(page, 8)
    const probes = getOvalProbeRegions(raster)

    const [topInside, topOutside, leftInside, leftOutside] = await Promise.all([
      getGreenCoverage(page, raster, probes.topInside),
      getGreenCoverage(page, raster, probes.topOutside),
      getGreenCoverage(page, raster, probes.leftInside),
      getGreenCoverage(page, raster, probes.leftOutside)
    ])

    expect(topInside).toBeGreaterThan(0.45)
    expect(leftInside).toBeGreaterThan(0.45)
    expect(topOutside).toBeLessThan(MAX_EXTERIOR_LEAK)
    expect(leftOutside).toBeLessThan(MAX_EXTERIOR_LEAK)
  })

  test('benchmark: oval outside bevel keeps the sampled outside band covered', async ({
    page
  }) => {
    await createOval(page, 0.35, 0.35)
    await configureSelectedStroke(page, {
      elementType: 'oval',
      position: 'outside',
      join: 'bevel',
      cap: 'butt',
      width: 8
    })

    const raster = await captureSelectedElementRaster(page, 8)
    const probes = getOvalProbeRegions(raster)

    const [topOutside, topInside, leftOutside, leftInside] = await Promise.all([
      getGreenCoverage(page, raster, probes.topOutside),
      getGreenCoverage(page, raster, probes.topInside),
      getGreenCoverage(page, raster, probes.leftOutside),
      getGreenCoverage(page, raster, probes.leftInside)
    ])

    expect(topOutside).toBeGreaterThan(0.45)
    expect(leftOutside).toBeGreaterThan(0.45)
    expect(topInside).toBeLessThan(MAX_EXTERIOR_LEAK)
    expect(leftInside).toBeLessThan(MAX_EXTERIOR_LEAK)
  })

  test('benchmark: oval outside miter keeps the sampled outside band covered', async ({
    page
  }) => {
    await createOval(page, 0.35, 0.35)
    await configureSelectedStroke(page, {
      elementType: 'oval',
      position: 'outside',
      join: 'miter',
      cap: 'butt',
      width: 8
    })

    const raster = await captureSelectedElementRaster(page, 8)
    const probes = getOvalProbeRegions(raster)

    const [topOutside, topInside, leftOutside, leftInside] = await Promise.all([
      getGreenCoverage(page, raster, probes.topOutside),
      getGreenCoverage(page, raster, probes.topInside),
      getGreenCoverage(page, raster, probes.leftOutside),
      getGreenCoverage(page, raster, probes.leftInside)
    ])

    expect(topOutside).toBeGreaterThan(0.45)
    expect(leftOutside).toBeGreaterThan(0.45)
    expect(topInside).toBeLessThan(MAX_EXTERIOR_LEAK)
    expect(leftInside).toBeLessThan(MAX_EXTERIOR_LEAK)
  })

  test('benchmark: closed constrained shapes keep butt and square caps visually equivalent', async ({
    page
  }) => {
    await createRectangle(page, 0.3, 0.3)
    await configureSelectedStroke(page, {
      elementType: 'rect',
      position: 'outside',
      join: 'bevel',
      cap: 'butt'
    })

    const buttRaster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const buttTopOutside = await getGreenCoverage(
      page,
      buttRaster,
      getRectProbeRegions(buttRaster).topOutside
    )

    await configureSelectedStroke(page, {
      elementType: 'rect',
      position: 'outside',
      join: 'bevel',
      cap: 'square'
    })

    const squareRaster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const squareTopOutside = await getGreenCoverage(
      page,
      squareRaster,
      getRectProbeRegions(squareRaster).topOutside
    )

    expect(Math.abs(buttTopOutside - squareTopOutside)).toBeLessThan(
      MAX_CAP_VARIANCE
    )
  })

  test('benchmark: closed constrained solid round join renders on inside slices', async ({
    page
  }) => {
    await createRectangle(page, 0.3, 0.3)
    await configureSelectedStroke(page, {
      elementType: 'rect',
      position: 'inside',
      join: 'round',
      cap: 'butt'
    })

    const raster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const probes = getRectProbeRegions(raster)
    const [insideCoverage, outsideCoverage] = await Promise.all([
      getGreenCoverage(page, raster, probes.topInside),
      getGreenCoverage(page, raster, probes.topOutside)
    ])

    expect(insideCoverage).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(outsideCoverage).toBeLessThan(MAX_EXTERIOR_LEAK)
  })

  test('benchmark: closed constrained solid round cap stays visually equivalent to butt caps', async ({
    page
  }) => {
    await createRectangle(page, 0.3, 0.3)
    await configureSelectedStroke(page, {
      elementType: 'rect',
      position: 'outside',
      join: 'bevel',
      cap: 'round'
    })

    const raster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const probes = getRectProbeRegions(raster)
    const [topOutside, leftOutside] = await Promise.all([
      getGreenCoverage(page, raster, probes.topOutside),
      getGreenCoverage(page, raster, probes.leftOutside)
    ])

    expect(topOutside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
    expect(leftOutside).toBeGreaterThan(MIN_SUPPORTED_COVERAGE)
  })

  test('benchmark: reported vector-6 inside solid keeps all source contours visible after dragging the top anchor inward', async ({
    page
  }, testInfo) => {
    const draggedTopPointOverrides: ReportedVector6PointOverrides = {
      'tp-12': { y: 130 },
      'tp-12:out': { y: 270 }
    }

    await prepareReportedVector6InsideSolid(page, {
      color: REPORTED_VECTOR_6_PRODUCT_STROKE_COLOR,
      opacity: 100,
      pointOverrides: draggedTopPointOverrides
    })

    const packetSummary = await getSelectedSolidStrokeRenderPacketSummary(page)
    expect(packetSummary.exportPacketCount).toBeGreaterThan(0)

    const raster = await captureSelectedElementRaster(page, STROKE_WIDTH, 48)
    await attachPng(
      'reported-vector-6-inside-solid-dragged-top-anchor-full.png',
      raster.base64,
      testInfo
    )

    const wholeRedCoverage = await getRedCoverage(page, raster, {
      x: 0,
      y: 0,
      width: raster.width,
      height: raster.height
    })
    expect(wholeRedCoverage).toBeGreaterThan(0.045)

    await assertReportedVector6RedPointProbes(
      page,
      raster,
      getReportedVector6DenseSegmentCoverageProbes(draggedTopPointOverrides)
    )
  })
})
