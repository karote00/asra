import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
import {
  getPropertiesPanel,
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

interface ZoomedLocalRasterCapture {
  base64: string
  width: number
  height: number
  clip: { x: number; y: number; width: number; height: number }
  rect: { x: number; y: number; width: number; height: number }
  canvasRect: { x: number; y: number; width: number; height: number }
  zoom: number
  viewport: Vec2
}

interface ReportedVector6PointProbe {
  label: string
  point: Vec2
  size?: number
  minCoverage?: number
  maxCoverage?: number
}

const PADDING = 24
const STROKE_WIDTH = 10
const REPORTED_VECTOR_6_PRODUCT_STROKE_COLOR = 'DF0606'

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

const attachPng = async (label: string, base64: string, testInfo: TestInfo) => {
  await writeFile(testInfo.outputPath(label), Buffer.from(base64, 'base64'))
  await testInfo.attach(label, {
    body: Buffer.from(base64, 'base64'),
    contentType: 'image/png'
  })
}

const getSelectedElementSnapshot = async (page: Page) => {
  const rect = await getSelectedElementRect(page)
  if (!rect) {
    throw new Error('No selected element snapshot available')
  }

  const viewportState = await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const canvasRect = document.querySelector('canvas')?.getBoundingClientRect()
    return {
      zoom: core?.getSystemProperty?.('zoom') ?? 1,
      viewport: core?.getSystemProperty?.('viewportPosition') ?? {
        x: 0,
        y: 0
      },
      canvasRect: canvasRect
        ? {
            x: canvasRect.x,
            y: canvasRect.y,
            width: canvasRect.width,
            height: canvasRect.height
          }
        : { x: 0, y: 0, width: 0, height: 0 }
    }
  })

  return {
    rect,
    zoom: viewportState.zoom,
    viewport: viewportState.viewport,
    canvasRect: viewportState.canvasRect
  }
}

const captureSelectedElementRaster = async (
  page: Page,
  padding = PADDING
): Promise<RasterCapture> => {
  const snapshot = await getSelectedElementSnapshot(page)
  const clip = {
    x: Math.max(
      0,
      Math.floor(
        snapshot.canvasRect.x +
          snapshot.rect.x * snapshot.zoom +
          snapshot.viewport.x -
          padding
      )
    ),
    y: Math.max(
      0,
      Math.floor(
        snapshot.canvasRect.y +
          snapshot.rect.y * snapshot.zoom +
          snapshot.viewport.y -
          padding
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
    padding
  }
}

const captureZoomedSelectedLocalRaster = async (
  page: Page,
  localPoint: Vec2,
  options: {
    zoom: number
    width: number
    height: number
    screenCenter?: Vec2
  }
): Promise<ZoomedLocalRasterCapture> => {
  const snapshot = await getSelectedElementSnapshot(page)
  const viewportSize = page.viewportSize()
  if (!viewportSize) {
    throw new Error('Viewport size unavailable')
  }

  const screenCenter = options.screenCenter ?? {
    x: viewportSize.width / 2,
    y: viewportSize.height / 2
  }
  const screenCenterInCanvas = {
    x: screenCenter.x - snapshot.canvasRect.x,
    y: screenCenter.y - snapshot.canvasRect.y
  }
  const viewport = {
    x: screenCenterInCanvas.x - (snapshot.rect.x + localPoint.x) * options.zoom,
    y: screenCenterInCanvas.y - (snapshot.rect.y + localPoint.y) * options.zoom
  }

  await page.evaluate(
    ({ zoom, viewport }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      core?.setSystemProperty?.('zoom', zoom)
      core?.setSystemProperty?.('viewportPosition', viewport)
    },
    { zoom: options.zoom, viewport }
  )
  await page.waitForTimeout(300)

  const clip = {
    x: Math.max(0, Math.floor(screenCenter.x - options.width / 2)),
    y: Math.max(0, Math.floor(screenCenter.y - options.height / 2)),
    width: options.width,
    height: options.height
  }
  const screenshot = await page.screenshot({ clip })

  return {
    base64: screenshot.toString('base64'),
    width: clip.width,
    height: clip.height,
    clip,
    rect: snapshot.rect,
    canvasRect: snapshot.canvasRect,
    zoom: options.zoom,
    viewport
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

const getBase64RedDominantStats = async (page: Page, base64: string) =>
  page.evaluate(async (imageBase64) => {
    const response = await fetch(`data:image/png;base64,${imageBase64}`)
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
    const redValues: number[] = []
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data
    for (let index = 0; index < data.length; index += 4) {
      const r = data[index]
      const g = data[index + 1]
      const b = data[index + 2]
      const a = data[index + 3]
      if (a > 120 && r > 80 && g < 70 && b < 70 && r - g > 35) {
        redValues.push(r)
      }
    }

    redValues.sort((left, right) => left - right)
    const percentile = (ratio: number) =>
      redValues.length > 0
        ? redValues[
            Math.min(
              redValues.length - 1,
              Math.max(0, Math.floor((redValues.length - 1) * ratio))
            )
          ]
        : 0
    const average =
      redValues.length > 0
        ? redValues.reduce((sum, value) => sum + value, 0) / redValues.length
        : 0

    return {
      redPixelCount: redValues.length,
      average,
      p95: percentile(0.95),
      p99: percentile(0.99),
      max: redValues[redValues.length - 1] ?? 0
    }
  }, base64)

const getSelectedSolidStrokeExportPolygons = async (page: Page) =>
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
    return exportPackets.flatMap(
      (packet: { polygons?: { x: number; y: number }[][] }) =>
        packet.polygons ?? []
    )
  })

const selectReportedVector6ClosedSeamAnchorForPathEditing = async (
  page: Page
) => {
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const selectedId =
      core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
    if (!selectedId) {
      throw new Error('No selected vector available for path editing seam crop')
    }

    core?.setSystemProperty?.('pathEditingVectorId', selectedId)
    core?.setSystemProperty?.('pathEditingMode', true)
    core?.setSystemProperty?.('selectedVectorPoint', {
      elementId: selectedId,
      pointId: 'tp-12',
      index: 0,
      target: 'anchor',
      x: 192.42083700791653,
      y: 0
    })
    core?.setSystemProperty?.('selectedVectorSegment', null)
    core?.setSystemProperty?.('hoveredVectorPoint', null)
    core?.setSystemProperty?.('hoveredVectorSegment', null)
    core?.setSystemProperty?.('hoveredVectorSegmentInsertPoint', null)
  })
  await page.waitForTimeout(300)
}

const assertZoomedSeamRasterMatchesExportGeometry = async (
  page: Page,
  raster: ZoomedLocalRasterCapture,
  polygons: Vec2[][]
) => {
  const result = await page.evaluate(
    async ({ raster, polygons }) => {
      const response = await fetch(`data:image/png;base64,${raster.base64}`)
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
      const data = context.getImageData(0, 0, canvas.width, canvas.height).data
      const pointInPolygon = (
        point: { x: number; y: number },
        polygon: { x: number; y: number }[]
      ) => {
        let inside = false
        for (
          let currentIndex = 0, previousIndex = polygon.length - 1;
          currentIndex < polygon.length;
          previousIndex = currentIndex, currentIndex += 1
        ) {
          const current = polygon[currentIndex]
          const previous = polygon[previousIndex]
          const intersects =
            current.y > point.y !== previous.y > point.y &&
            point.x <
              ((previous.x - current.x) * (point.y - current.y)) /
                (previous.y - current.y) +
                current.x
          if (intersects) {
            inside = !inside
          }
        }

        return inside
      }
      const pointToSegmentDistance = (
        point: { x: number; y: number },
        start: { x: number; y: number },
        end: { x: number; y: number }
      ) => {
        const dx = end.x - start.x
        const dy = end.y - start.y
        const lengthSquared = dx * dx + dy * dy
        if (lengthSquared <= 1e-6) {
          return Math.hypot(point.x - start.x, point.y - start.y)
        }
        const ratio = Math.max(
          0,
          Math.min(
            1,
            ((point.x - start.x) * dx + (point.y - start.y) * dy) /
              lengthSquared
          )
        )
        return Math.hypot(
          point.x - (start.x + dx * ratio),
          point.y - (start.y + dy * ratio)
        )
      }
      const distanceToPolygonBoundary = (
        point: { x: number; y: number },
        polygon: { x: number; y: number }[]
      ) =>
        polygon.reduce((nearest, current, index) => {
          const next = polygon[(index + 1) % polygon.length]
          return Math.min(nearest, pointToSegmentDistance(point, current, next))
        }, Infinity)

      let coveredSamples = 0
      let missingSamples = 0
      const missingExamples: {
        x: number
        y: number
        pixelX: number
        pixelY: number
      }[] = []
      for (let y = 0; y <= 42; y += 0.5) {
        for (let x = 170; x <= 215; x += 0.5) {
          const localPoint = { x, y }
          const containingPolygon = polygons.find((polygon) =>
            pointInPolygon(localPoint, polygon)
          )
          if (!containingPolygon) {
            continue
          }
          if (distanceToPolygonBoundary(localPoint, containingPolygon) < 2) {
            continue
          }

          const pixelX = Math.round(
            raster.canvasRect.x +
              (raster.rect.x + x) * raster.zoom +
              raster.viewport.x -
              raster.clip.x
          )
          const pixelY = Math.round(
            raster.canvasRect.y +
              (raster.rect.y + y) * raster.zoom +
              raster.viewport.y -
              raster.clip.y
          )
          if (
            pixelX < 0 ||
            pixelY < 0 ||
            pixelX >= canvas.width ||
            pixelY >= canvas.height
          ) {
            continue
          }

          coveredSamples += 1
          const offset = (pixelY * canvas.width + pixelX) * 4
          const r = data[offset]
          const g = data[offset + 1]
          const b = data[offset + 2]
          const a = data[offset + 3]
          const red = a > 120 && r > 80 && g < 80 && b < 80 && r - g > 30
          const editingOverlay =
            a > 120 && ((b > 120 && b - r > 25) || (r > 95 && g > 95 && b > 95))
          if (!red && !editingOverlay) {
            missingSamples += 1
            if (missingExamples.length < 12) {
              missingExamples.push({ x, y, pixelX, pixelY })
            }
          }
        }
      }

      return {
        coveredSamples,
        missingSamples,
        missingRatio:
          coveredSamples > 0 ? missingSamples / coveredSamples : Number.NaN,
        missingExamples
      }
    },
    { raster, polygons }
  )

  expect(result.coveredSamples).toBeGreaterThan(200)
  expect(
    result.missingRatio,
    JSON.stringify(result, null, 2)
  ).toBeLessThanOrEqual(0.12)
}

const assertZoomedCenterSeamDistanceField = async (
  page: Page,
  raster: ZoomedLocalRasterCapture,
  exportPolygons: Vec2[][]
) => {
  const result = await page.evaluate(
    async ({ raster, strokeWidth, exportPolygons }) => {
      const response = await fetch(`data:image/png;base64,${raster.base64}`)
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
      const data = context.getImageData(0, 0, canvas.width, canvas.height).data
      const cubicPoint = (
        p0: Vec2,
        p1: Vec2,
        p2: Vec2,
        p3: Vec2,
        t: number
      ) => {
        const u = 1 - t
        return {
          x:
            u * u * u * p0.x +
            3 * u * u * t * p1.x +
            3 * u * t * t * p2.x +
            t * t * t * p3.x,
          y:
            u * u * u * p0.y +
            3 * u * u * t * p1.y +
            3 * u * t * t * p2.y +
            t * t * t * p3.y
        }
      }
      const pointToSegmentDistance = (point: Vec2, a: Vec2, b: Vec2) => {
        const dx = b.x - a.x
        const dy = b.y - a.y
        const lengthSquared = dx * dx + dy * dy
        if (lengthSquared <= 1e-6) {
          return Math.hypot(point.x - a.x, point.y - a.y)
        }

        const ratio = Math.max(
          0,
          Math.min(
            1,
            ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared
          )
        )
        return Math.hypot(
          point.x - (a.x + dx * ratio),
          point.y - (a.y + dy * ratio)
        )
      }
      const normalize = (point: Vec2) => {
        const length = Math.hypot(point.x, point.y)
        return length > 1e-6
          ? { x: point.x / length, y: point.y / length }
          : null
      }
      const cubicDerivative = (
        p0: Vec2,
        p1: Vec2,
        p2: Vec2,
        p3: Vec2,
        t: number
      ) => {
        const u = 1 - t
        return {
          x:
            3 * u * u * (p1.x - p0.x) +
            6 * u * t * (p2.x - p1.x) +
            3 * t * t * (p3.x - p2.x),
          y:
            3 * u * u * (p1.y - p0.y) +
            6 * u * t * (p2.y - p1.y) +
            3 * t * t * (p3.y - p2.y)
        }
      }
      const authoredSegments = [
        {
          p0: { x: 192.42083700791653, y: 0 },
          p1: { x: 170.10536493824844, y: 119.07041481724248 },
          p2: { x: -42.09205809548172, y: 343.2841182453731 },
          p3: { x: 11.358174406717296, y: 364.1297089212308 }
        },
        {
          p0: { x: 270.59180204238254, y: 345.42212754546125 },
          p1: { x: 277.2730811051575, y: 328.05080198224647 },
          p2: { x: 192.42083700791653, y: 0 },
          p3: { x: 192.42083700791653, y: 0 }
        },
        {
          p0: { x: 11.358174406717296, y: 364.1297089212308 },
          p1: { x: 78.17096503446606, y: 390.18669726605293 },
          p2: { x: 360.120941483566, y: 144.31562775593738 },
          p3: { x: 360.120941483566, y: 144.31562775593738 }
        },
        {
          p0: { x: 360.120941483566, y: 144.31562775593738 },
          p1: { x: 360.120941483566, y: 144.31562775593738 },
          p2: { x: 0, y: 14.030686031827244 },
          p3: { x: 0, y: 14.030686031827244 }
        },
        {
          p0: { x: 0, y: 14.030686031827244 },
          p1: { x: 0, y: 14.030686031827244 },
          p2: { x: 263.9105229796076, y: 362.79345310867603 },
          p3: { x: 270.59180204238254, y: 345.42212754546125 }
        }
      ]
      const sampleSegments = (segments: typeof authoredSegments) =>
        segments.flatMap((segment) => {
          const samples: Vec2[] = []
          for (let index = 0; index <= 120; index += 1) {
            samples.push(
              cubicPoint(
                segment.p0,
                segment.p1,
                segment.p2,
                segment.p3,
                index / 120
              )
            )
          }

          return samples.slice(0, -1).map((sample, index) => ({
            a: sample,
            b: samples[index + 1]
          }))
        })
      const sampledSeamSegments = sampleSegments(authoredSegments.slice(0, 2))
      const sampledAuthoredSegments = sampleSegments(authoredSegments)
      const distanceToAuthoredSeam = (point: Vec2) =>
        Math.min(
          ...sampledSeamSegments.map((segment) =>
            pointToSegmentDistance(point, segment.a, segment.b)
          )
        )
      const distanceToAuthoredPath = (point: Vec2) =>
        Math.min(
          ...sampledAuthoredSegments.map((segment) =>
            pointToSegmentDistance(point, segment.a, segment.b)
          )
        )
      const isRedPixel = (pixelX: number, pixelY: number) => {
        const offset = (pixelY * canvas.width + pixelX) * 4
        const r = data[offset]
        const g = data[offset + 1]
        const b = data[offset + 2]
        const a = data[offset + 3]
        return a > 120 && r > 80 && g < 80 && b < 80 && r - g > 30
      }
      const localToPixel = (point: Vec2) => ({
        x: Math.round(
          raster.canvasRect.x +
            (raster.rect.x + point.x) * raster.zoom +
            raster.viewport.x -
            raster.clip.x
        ),
        y: Math.round(
          raster.canvasRect.y +
            (raster.rect.y + point.y) * raster.zoom +
            raster.viewport.y -
            raster.clip.y
        )
      })
      const pointInPolygon = (point: Vec2, polygon: Vec2[]) => {
        let inside = false
        for (
          let currentIndex = 0, previousIndex = polygon.length - 1;
          currentIndex < polygon.length;
          previousIndex = currentIndex, currentIndex += 1
        ) {
          const current = polygon[currentIndex]
          const previous = polygon[previousIndex]
          const intersects =
            current.y > point.y !== previous.y > point.y &&
            point.x <
              ((previous.x - current.x) * (point.y - current.y)) /
                (previous.y - current.y) +
                current.x
          if (intersects) {
            inside = !inside
          }
        }

        return inside
      }
      const isInExportGeometry = (point: Vec2) =>
        exportPolygons.some((polygon) => pointInPolygon(point, polygon))
      const hollowRegions = [
        { minX: 174, maxX: 206, minY: 0, maxY: 42 },
        { minX: 180, maxX: 205, minY: 42, maxY: 82 }
      ]
      const isInHollowGuard = (point: Vec2) =>
        hollowRegions.some(
          (region) =>
            point.x >= region.minX &&
            point.x <= region.maxX &&
            point.y >= region.minY &&
            point.y <= region.maxY
        )

      const positiveFailures: {
        x: number
        y: number
        distance: number
        pixelX: number
        pixelY: number
        exportCovered: boolean
        rgba: [number, number, number, number]
      }[] = []
      const negativeFailures: {
        x: number
        y: number
        distance: number
        pixelX: number
        pixelY: number
      }[] = []
      const endTailFailures: {
        t: number
        offset: number
        x: number
        y: number
        pixelX: number
        pixelY: number
        exportCovered: boolean
        rgba: [number, number, number, number]
      }[] = []
      let positiveSamples = 0
      let negativeSamples = 0
      let positiveMissing = 0
      let negativeRed = 0
      let endTailSamples = 0
      let endTailMissing = 0
      let longestEndTailMissingRun = 0
      let longestMissingRun = 0
      let currentMissingRun = 0
      const missingBounds = {
        minX: Number.POSITIVE_INFINITY,
        minY: Number.POSITIVE_INFINITY,
        maxX: Number.NEGATIVE_INFINITY,
        maxY: Number.NEGATIVE_INFINITY
      }
      const sampleStep = 0.5

      for (let y = 0; y <= 230; y += sampleStep) {
        currentMissingRun = 0
        for (let x = 174; x <= 240; x += sampleStep) {
          const point = { x, y }
          if (isInHollowGuard(point)) {
            continue
          }

          const distance = distanceToAuthoredSeam(point)
          const pixel = localToPixel(point)
          if (
            pixel.x < 0 ||
            pixel.y < 0 ||
            pixel.x >= canvas.width ||
            pixel.y >= canvas.height ||
            pixel.x < 24 ||
            pixel.y < 24 ||
            pixel.x > canvas.width - 25 ||
            pixel.y > canvas.height - 25
          ) {
            continue
          }

          if (distance <= strokeWidth / 2 - 1.25) {
            positiveSamples += 1
            if (!isRedPixel(pixel.x, pixel.y)) {
              positiveMissing += 1
              currentMissingRun += 1
              longestMissingRun = Math.max(longestMissingRun, currentMissingRun)
              missingBounds.minX = Math.min(missingBounds.minX, point.x)
              missingBounds.minY = Math.min(missingBounds.minY, point.y)
              missingBounds.maxX = Math.max(missingBounds.maxX, point.x)
              missingBounds.maxY = Math.max(missingBounds.maxY, point.y)
              if (positiveFailures.length < 12) {
                positiveFailures.push({
                  ...point,
                  distance,
                  pixelX: pixel.x,
                  pixelY: pixel.y,
                  exportCovered: isInExportGeometry(point),
                  rgba: [
                    data[(pixel.y * canvas.width + pixel.x) * 4],
                    data[(pixel.y * canvas.width + pixel.x) * 4 + 1],
                    data[(pixel.y * canvas.width + pixel.x) * 4 + 2],
                    data[(pixel.y * canvas.width + pixel.x) * 4 + 3]
                  ]
                })
              }
            } else {
              currentMissingRun = 0
            }
          }
        }
      }

      for (const region of hollowRegions) {
        for (let y = region.minY; y <= region.maxY; y += sampleStep) {
          for (let x = region.minX; x <= region.maxX; x += sampleStep) {
            const point = { x, y }
            const distance = distanceToAuthoredPath(point)
            if (distance < strokeWidth / 2 + 2) {
              continue
            }

            const pixel = localToPixel(point)
            if (
              pixel.x < 0 ||
              pixel.y < 0 ||
              pixel.x >= canvas.width ||
              pixel.y >= canvas.height
            ) {
              continue
            }

            negativeSamples += 1
            if (isRedPixel(pixel.x, pixel.y)) {
              negativeRed += 1
              if (negativeFailures.length < 12) {
                negativeFailures.push({
                  ...point,
                  distance,
                  pixelX: pixel.x,
                  pixelY: pixel.y
                })
              }
            }
          }
        }
      }

      const endTail = authoredSegments[1]
      for (let t = 0.82; t <= 0.93; t += 0.005) {
        const center = cubicPoint(
          endTail.p0,
          endTail.p1,
          endTail.p2,
          endTail.p3,
          t
        )
        const tangent = normalize(
          cubicDerivative(endTail.p0, endTail.p1, endTail.p2, endTail.p3, t)
        )
        if (!tangent) {
          continue
        }

        const normal = { x: -tangent.y, y: tangent.x }
        let currentEndTailMissingRun = 0
        for (let offset = -3.25; offset <= 3.25; offset += 0.5) {
          const point = {
            x: center.x + normal.x * offset,
            y: center.y + normal.y * offset
          }
          const pixel = localToPixel(point)
          if (
            pixel.x < 24 ||
            pixel.y < 48 ||
            pixel.x > canvas.width - 25 ||
            pixel.y > canvas.height - 25
          ) {
            continue
          }

          endTailSamples += 1
          if (!isRedPixel(pixel.x, pixel.y)) {
            endTailMissing += 1
            currentEndTailMissingRun += 1
            longestEndTailMissingRun = Math.max(
              longestEndTailMissingRun,
              currentEndTailMissingRun
            )
            if (endTailFailures.length < 12) {
              endTailFailures.push({
                t,
                offset,
                ...point,
                pixelX: pixel.x,
                pixelY: pixel.y,
                exportCovered: isInExportGeometry(point),
                rgba: [
                  data[(pixel.y * canvas.width + pixel.x) * 4],
                  data[(pixel.y * canvas.width + pixel.x) * 4 + 1],
                  data[(pixel.y * canvas.width + pixel.x) * 4 + 2],
                  data[(pixel.y * canvas.width + pixel.x) * 4 + 3]
                ]
              })
            }
          } else {
            currentEndTailMissingRun = 0
          }
        }
      }

      return {
        positiveSamples,
        positiveMissing,
        positiveMissingRatio:
          positiveSamples > 0 ? positiveMissing / positiveSamples : Number.NaN,
        positiveFailures,
        negativeSamples,
        negativeRed,
        negativeRedRatio:
          negativeSamples > 0 ? negativeRed / negativeSamples : Number.NaN,
        negativeFailures,
        endTailSamples,
        endTailMissing,
        endTailMissingRatio:
          endTailSamples > 0 ? endTailMissing / endTailSamples : Number.NaN,
        endTailFailures,
        longestEndTailMissingRun,
        longestMissingRun,
        missingBounds:
          positiveMissing > 0
            ? missingBounds
            : { minX: null, minY: null, maxX: null, maxY: null }
      }
    },
    { raster, strokeWidth: STROKE_WIDTH, exportPolygons }
  )

  expect(result.positiveSamples).toBeGreaterThan(500)
  expect(result.negativeSamples).toBeGreaterThan(100)
  expect(result.endTailSamples).toBeGreaterThanOrEqual(80)
  expect(
    result.endTailMissingRatio,
    JSON.stringify(result, null, 2)
  ).toBeLessThanOrEqual(0.005)
  expect(result.longestEndTailMissingRun, JSON.stringify(result, null, 2)).toBe(
    0
  )
  expect(
    result.positiveMissingRatio,
    JSON.stringify(result, null, 2)
  ).toBeLessThanOrEqual(0.005)
  expect(result.longestMissingRun, JSON.stringify(result, null, 2)).toBe(0)
  expect(
    result.negativeRedRatio,
    JSON.stringify(result, null, 2)
  ).toBeLessThanOrEqual(0.02)
}

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

const getReportedVector6DenseSegmentCoverageProbes =
  (): ReportedVector6PointProbe[] => {
    const points: Record<string, Vec2> = {
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
    const segments = [
      ['ts-23', 'tp-12', 'tp-13', 'tp-12:out', 'tp-13:in'],
      ['ts-24', 'tp-13', 'tp-14', 'tp-13:out', null],
      ['ts-25', 'tp-14', 'tp-15', null, null],
      ['ts-26', 'tp-15', 'tp-16', 'tp-15:out', 'tp-16:in'],
      ['ts-27', 'tp-16', 'tp-12', 'tp-16:out', null]
    ] as const
    const ratios = [
      0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65,
      0.7, 0.75, 0.8, 0.85, 0.9, 0.95
    ]

    return segments.flatMap(([id, start, end, out, input]) => {
      const p0 = points[start]
      const p3 = points[end]
      const p1 = out ? points[out] : p0
      const p2 = input ? points[input] : p3
      return ratios.map((ratio) => ({
        label: `${id} dense source coverage ${ratio}`,
        point: cubicPoint(p0, p1, p2, p3, ratio),
        size: 10,
        minCoverage: 0.04
      }))
    })
  }

const getReportedVector6ForbiddenBridgeProbes =
  (): ReportedVector6PointProbe[] => [
    {
      label: 'tp-12 top protrusion',
      point: { x: 192.4, y: -7 },
      size: 12,
      maxCoverage: 0.05
    },
    {
      label: 'tp-15 left protrusion',
      point: { x: -8, y: 10 },
      size: 12,
      maxCoverage: 0.05
    },
    {
      label: 'tp-14 right protrusion',
      point: { x: 368, y: 144 },
      size: 12,
      maxCoverage: 0.05
    },
    {
      label: 'tp-16 lower protrusion',
      point: { x: 275, y: 354 },
      size: 12,
      maxCoverage: 0.05
    },
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
      point: { x: 285, y: 245 },
      maxCoverage: 0.05
    }
  ]

const getPointProbeRegion = (
  raster: RasterCapture,
  probe: ReportedVector6PointProbe
) => {
  const size = probe.size ?? 10
  return {
    x: raster.padding + probe.point.x - size / 2,
    y: raster.padding + probe.point.y - size / 2,
    width: size,
    height: size
  }
}

const assertRedPointProbes = async (
  page: Page,
  raster: RasterCapture,
  probes: ReportedVector6PointProbe[]
) => {
  const results = await Promise.all(
    probes.map(async (probe) => ({
      probe,
      coverage: await getBase64RedCoverage(
        page,
        raster.base64,
        getPointProbeRegion(raster, probe)
      )
    }))
  )
  const failures = results.filter(
    ({ coverage, probe }) =>
      (probe.minCoverage !== undefined && coverage < probe.minCoverage) ||
      (probe.maxCoverage !== undefined && coverage > probe.maxCoverage)
  )
  expect(
    failures.map(({ coverage, probe }) => ({ ...probe, coverage })),
    JSON.stringify(failures, null, 2)
  ).toEqual([])
}

const assertCenterSeamCoverage = async (page: Page, raster: RasterCapture) => {
  await assertRedPointProbes(page, raster, [
    {
      label: 'center closed seam left of tp-12',
      point: { x: 183, y: 15 },
      size: 12,
      minCoverage: 0.12
    },
    {
      label: 'center closed seam inner bridge below tp-12',
      point: { x: 192, y: 27 },
      size: 8,
      minCoverage: 0.08
    },
    {
      label: 'center closed seam right of tp-12',
      point: { x: 202, y: 15 },
      size: 12,
      minCoverage: 0.12
    }
  ])
}

const assertCenterHollowRegionsStayEmpty = async (
  page: Page,
  raster: RasterCapture
) => {
  await assertRedPointProbes(page, raster, [
    {
      label: 'center top hollow must remain empty',
      point: { x: 192, y: 58 },
      size: 18,
      maxCoverage: 0.02
    },
    {
      label: 'center upper hollow body must remain empty',
      point: { x: 192, y: 68 },
      size: 16,
      maxCoverage: 0.02
    },
    {
      label: 'center upper-right hollow body must remain empty',
      point: { x: 198, y: 74 },
      size: 8,
      maxCoverage: 0.02
    }
  ])
}

const assertReportedVector6CenterSolidLocalAlpha = async (
  page: Page,
  testInfo: TestInfo
) => {
  const probes = [
    {
      label: 'reported-vector-6-center-seam-alpha.png',
      point: { x: 192, y: 24 }
    },
    {
      label: 'reported-vector-6-center-lower-curve-alpha.png',
      point: { x: 270, y: 345 }
    },
    {
      label: 'reported-vector-6-center-crossing-alpha.png',
      point: { x: 190, y: 210 }
    }
  ]

  for (const probe of probes) {
    const raster = await captureZoomedSelectedLocalRaster(page, probe.point, {
      zoom: 4,
      width: 180,
      height: 180
    })
    await attachPng(probe.label, raster.base64, testInfo)
    const redStats = await getBase64RedDominantStats(page, raster.base64)
    expect(
      redStats.redPixelCount,
      JSON.stringify({ label: probe.label, redStats }, null, 2)
    ).toBeGreaterThan(80)
    expect(
      redStats.p99,
      JSON.stringify({ label: probe.label, redStats }, null, 2)
    ).toBeLessThanOrEqual(150)
  }
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

const createSelfIntersectingCenterSolid = async (page: Page) => {
  await page.evaluate(
    ({ color, strokeWidth }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const elementApis = (window as any).__AsyraE2E__?.elementApis
      const points = {
        'x-0': {
          id: 'x-0',
          kind: 'anchor',
          x: 20,
          y: 0,
          anchorType: 'sharp'
        },
        'x-1': {
          id: 'x-1',
          kind: 'anchor',
          x: 300,
          y: 340,
          anchorType: 'sharp'
        },
        'x-2': {
          id: 'x-2',
          kind: 'anchor',
          x: 300,
          y: 0,
          anchorType: 'sharp'
        },
        'x-3': {
          id: 'x-3',
          kind: 'anchor',
          x: 20,
          y: 340,
          anchorType: 'sharp'
        }
      }
      const segments = {
        'xs-0': {
          id: 'xs-0',
          startId: 'x-0',
          endId: 'x-1',
          outControlId: null,
          inControlId: null
        },
        'xs-1': {
          id: 'xs-1',
          startId: 'x-1',
          endId: 'x-2',
          outControlId: null,
          inControlId: null
        },
        'xs-2': {
          id: 'xs-2',
          startId: 'x-2',
          endId: 'x-3',
          outControlId: null,
          inControlId: null
        },
        'xs-3': {
          id: 'xs-3',
          startId: 'x-3',
          endId: 'x-0',
          outControlId: null,
          inControlId: null
        }
      }
      const networks = {
        'xn-0': {
          id: 'xn-0',
          pointIds: ['x-0', 'x-1', 'x-2', 'x-3'],
          segmentIds: ['xs-0', 'xs-1', 'xs-2', 'xs-3'],
          closed: true
        }
      }
      const createdId = elementApis?.createElement?.(
        { type: 'vector', points, segments, networks, closed: true },
        { undoable: false }
      )
      if (!createdId) {
        throw new Error(
          'Failed to create self-intersecting center solid fixture'
        )
      }
      elementApis?.changeComputedData?.(
        [createdId],
        {
          x: 260,
          y: 180,
          width: 320,
          height: 340,
          points,
          segments,
          networks,
          closed: true,
          fills: [],
          strokes: [
            {
              id: 'self-intersecting-center-solid',
              kind: 'solid',
              style: 'solid',
              position: 'center',
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
    },
    {
      color: REPORTED_VECTOR_6_PRODUCT_STROKE_COLOR,
      strokeWidth: 30
    }
  )

  await page.waitForTimeout(600)
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
      renderElementState: renderElement
        ? {
            visible: renderElement.visible,
            renderable: renderElement.renderable,
            alpha: renderElement.alpha,
            worldAlpha: renderElement.worldAlpha,
            childCount: renderElement.children?.length,
            parentVisible: renderElement.parent?.visible,
            parentRenderable: renderElement.parent?.renderable
          }
        : null,
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
      strokeMeshCacheSummary: Array.from(
        renderElement?.__asyraStrokeMeshCache?.entries?.() ?? []
      ).map(
        ([cacheKey, entry]: [
          string,
          {
            kind?: string
            container?: {
              visible?: boolean
              children?: unknown[]
              parent?: unknown
            }
            graphics?: { visible?: boolean; parent?: unknown }
            projection?: { setVisible?: unknown }
          }
        ]) => ({
          cacheKey,
          kind: entry.kind,
          visible:
            entry.container?.visible ?? entry.graphics?.visible ?? undefined,
          childCount: entry.container?.children?.length ?? undefined,
          hasParent:
            entry.container?.parent !== undefined ||
            entry.graphics?.parent !== undefined,
          hasProjection: entry.projection !== undefined
        })
      ),
      centerPathSolidStrokeRenderCount:
        renderElement?.__asyraCenterPathSolidStrokeRenderCount ?? 0,
      exportPacketDebugMeta: exportPackets.map(
        (packet: { debugMeta?: Record<string, unknown> }) =>
          packet.debugMeta ?? {}
      )
    }
  })

test.describe('Reported Vector-6 Inside Solid Visual Regression', () => {
  test('renders self-intersecting center solid without product double-alpha overlap', async ({
    page
  }, testInfo) => {
    await createSelfIntersectingCenterSolid(page)

    const crossingRaster = await captureZoomedSelectedLocalRaster(
      page,
      { x: 160, y: 170 },
      { zoom: 4, width: 360, height: 360 }
    )
    await attachPng(
      'self-intersecting-center-solid-product-crossing.png',
      crossingRaster.base64,
      testInfo
    )

    const packetSummary = await getSelectedSolidStrokeRenderPacketSummary(page)
    const redStats = await getBase64RedDominantStats(
      page,
      crossingRaster.base64
    )
    expect(packetSummary.debugDisableVisualOverlapCollapse).toBe(false)
    expect(packetSummary.centerPathSolidStrokeRenderCount).toBe(0)
    expect(
      packetSummary.strokeMeshCacheSummary.some(
        (entry) => entry.kind === 'masked-solid'
      ),
      JSON.stringify(packetSummary, null, 2)
    ).toBe(true)
    expect(redStats.redPixelCount).toBeGreaterThan(1000)
    expect(
      redStats.p99,
      JSON.stringify({ redStats, packetSummary }, null, 2)
    ).toBeLessThanOrEqual(150)

    await setStrokeDebugDisableVisualOverlapCollapse(page, true)
    const debugSummary = await getSelectedSolidStrokeRenderPacketSummary(page)
    expect(debugSummary.centerPathSolidStrokeRenderCount).toBe(0)
    expect(debugSummary.strokeMeshCacheSummary.length).toBeGreaterThan(0)
  })

  test('preserves every authored segment from start to end', async ({
    page
  }, testInfo) => {
    await createReportedVector6InsideSolid(page)

    const raster = await captureSelectedElementRaster(page)
    await attachPng(
      'reported-vector-6-solid-dense-global.png',
      raster.base64,
      testInfo
    )
    await assertRedPointProbes(
      page,
      raster,
      getReportedVector6DenseSegmentCoverageProbes()
    )
    await assertRedPointProbes(
      page,
      raster,
      getReportedVector6ForbiddenBridgeProbes()
    )

    const packetSummary = await getSelectedSolidStrokeRenderPacketSummary(page)
    expect(packetSummary.debugDisableVisualOverlapCollapse).toBe(false)
    expect(packetSummary.exportPacketCount).toBeGreaterThan(0)
    expect(
      packetSummary.exportPacketDebugMeta.every(
        (debugMeta) =>
          debugMeta.geometryFamily === 'constrained-solid' &&
          debugMeta.resolutionStatus === 'exact-constrained' &&
          debugMeta.runtimeStatus === 'accepted' &&
          debugMeta.sourceTopology === 'self-intersecting' &&
          debugMeta.domainPlanSideAuthority === 'implicit-fill-hole-domain' &&
          debugMeta.domainPlanBoundaryRole === 'filled-face' &&
          debugMeta.domainPlanTerminalRole === undefined &&
          debugMeta.domainPlanSplitRangeTerminals === undefined
      ),
      JSON.stringify(packetSummary.exportPacketDebugMeta, null, 2)
    ).toBe(true)
  })

  test('switches reported vector-6 from inside solid to center solid without freezing the UI', async ({
    page
  }, testInfo) => {
    await createReportedVector6InsideSolid(page)

    const propertiesPanel = getPropertiesPanel(page)
    const strokePositionSelect = propertiesPanel.getByTestId(
      'prop-stroke-position-0'
    )
    await expect(strokePositionSelect).toBeVisible()

    const switchStartedAt = Date.now()
    await strokePositionSelect.selectOption('center')
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
            packet.debugMeta?.geometryFamily === 'solid-center' &&
            packet.debugMeta?.strokePosition === 'center'
        )
      )
    })
    const switchMs = Date.now() - switchStartedAt
    const packetSummary = await getSelectedSolidStrokeRenderPacketSummary(page)

    expect(switchMs).toBeLessThan(2000)
    expect(packetSummary.exportPacketCount).toBe(1)
    expect(packetSummary.centerPathSolidStrokeRenderCount).toBe(0)
    expect(
      packetSummary.strokeMeshCacheSummary.some(
        (entry) => entry.kind === 'masked-solid'
      ),
      JSON.stringify(packetSummary, null, 2)
    ).toBe(true)
    expect(packetSummary.polygonCount).toBeLessThanOrEqual(6500)
    expect(packetSummary.pointCount).toBeLessThanOrEqual(18000)
    const raster = await captureSelectedElementRaster(page)
    await attachPng(
      'reported-vector-6-solid-center-overlap.png',
      raster.base64,
      testInfo
    )
    const fullPageRaster = await page.screenshot()
    await attachPng(
      'reported-vector-6-solid-center-full-page.png',
      fullPageRaster.toString('base64'),
      testInfo
    )
    const redStats = await getBase64RedDominantStats(page, raster.base64)
    expect(
      redStats.redPixelCount,
      JSON.stringify({ redStats, packetSummary }, null, 2)
    ).toBeGreaterThan(500)
    expect(
      redStats.p95,
      JSON.stringify({ redStats, packetSummary }, null, 2)
    ).toBeLessThanOrEqual(150)
    expect(
      redStats.p99,
      JSON.stringify({ redStats, packetSummary }, null, 2)
    ).toBeLessThanOrEqual(150)
    await assertCenterSeamCoverage(page, raster)
    await assertCenterHollowRegionsStayEmpty(page, raster)
    await assertReportedVector6CenterSolidLocalAlpha(page, testInfo)
    const exportPolygons = await getSelectedSolidStrokeExportPolygons(page)
    const productSeamRaster = await captureZoomedSelectedLocalRaster(
      page,
      { x: 207, y: 60 },
      { zoom: 8, width: 400, height: 720 }
    )
    await attachPng(
      'reported-vector-6-solid-center-product-seam-distance-field.png',
      productSeamRaster.base64,
      testInfo
    )
    await assertZoomedCenterSeamDistanceField(
      page,
      productSeamRaster,
      exportPolygons
    )
    await selectReportedVector6ClosedSeamAnchorForPathEditing(page)
    const seamRaster = await captureZoomedSelectedLocalRaster(
      page,
      { x: 192.42083700791653, y: 20 },
      { zoom: 8, width: 240, height: 180 }
    )
    await attachPng(
      'reported-vector-6-solid-center-seam-zoomed.png',
      seamRaster.base64,
      testInfo
    )
    await assertZoomedSeamRasterMatchesExportGeometry(
      page,
      seamRaster,
      await getSelectedSolidStrokeExportPolygons(page)
    )
    const lowerSeamRaster = await captureZoomedSelectedLocalRaster(
      page,
      { x: 230, y: 185 },
      { zoom: 8, width: 240, height: 220 }
    )
    await attachPng(
      'reported-vector-6-solid-center-closed-seam-lower-zoomed.png',
      lowerSeamRaster.base64,
      testInfo
    )
    const topOverviewRaster = await captureZoomedSelectedLocalRaster(
      page,
      { x: 192, y: 72 },
      { zoom: 4, width: 520, height: 720 }
    )
    await attachPng(
      'reported-vector-6-solid-center-closed-seam-top-overview.png',
      topOverviewRaster.base64,
      testInfo
    )
    expect(
      packetSummary.exportPacketDebugMeta.every(
        (debugMeta) =>
          debugMeta.geometryFamily === 'solid-center' &&
          debugMeta.resolutionStatus === 'center-product' &&
          debugMeta.runtimeReason === 'center-stroke' &&
          debugMeta.strokePosition === 'center' &&
          debugMeta.visualOverlapCollapseStatus === 'exact-union'
      ),
      JSON.stringify(packetSummary.exportPacketDebugMeta, null, 2)
    ).toBe(true)
    await expect(propertiesPanel).toBeVisible()
  })
})
