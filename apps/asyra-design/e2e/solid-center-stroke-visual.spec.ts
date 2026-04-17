import { expect, test, type Page } from '@playwright/test'
import {
  createRectangle,
  getPropertiesPanel,
  getSelectedElementRect,
  resetCanvas,
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

const PADDING = 24
const STROKE_WIDTH = 10
const STROKE_COLOR = '00FF00'
const MIN_BAND_COVERAGE = 0.6
const MIN_MITER_CORNER_COVERAGE = 0.55
const MAX_BEVEL_CORNER_COVERAGE = 0.45
const MAX_EDGE_COVERAGE_DELTA = 0.12
const MAX_CENTER_COVERAGE = 0.03
const MAX_UNSUPPORTED_COVERAGE = 0.03
const MIN_BEVEL_DIAGONAL_COVERAGE = 0.35

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
      Math.floor(snapshot.rect.x * snapshot.zoom + snapshot.viewport.x - padding)
    ),
    y: Math.max(
      0,
      Math.floor(snapshot.rect.y * snapshot.zoom + snapshot.viewport.y - padding)
    ),
    width: Math.max(1, Math.ceil(snapshot.rect.width * snapshot.zoom + padding * 2)),
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
          if (a > 180 && g > 170 && r < 120 && b < 120 && g - r > 70 && g - b > 70) {
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

const configureRectangleCenterStroke = async (
  page: Page,
  config: {
    join: 'miter' | 'bevel' | 'round'
    cap?: 'butt' | 'square' | 'round'
    width?: number
    color?: string
  }
) => {
  const propertiesPanel = getPropertiesPanel(page)
  await ensureStrokeRow(page)

  const width = String(config.width ?? STROKE_WIDTH)
  const color = config.color ?? STROKE_COLOR

  await propertiesPanel.getByTestId('prop-stroke-style-0').selectOption('solid')
  await propertiesPanel.getByTestId('prop-stroke-position-0').selectOption('center')
  await propertiesPanel.getByTestId('prop-stroke-join-0').selectOption(config.join)
  await propertiesPanel
    .getByTestId('prop-stroke-cap-0')
    .selectOption(config.cap ?? 'butt')
  await propertiesPanel.getByTestId('prop-stroke-width-0').fill(width)
  await propertiesPanel.getByTestId('prop-stroke-width-0').press('Enter')
  await propertiesPanel.getByTestId('prop-stroke-color-0').fill(color)
  await propertiesPanel.getByTestId('prop-stroke-color-0').press('Enter')
  await page.waitForTimeout(180)
}

const getCenterRectProbeRegions = (raster: RasterCapture) => {
  const centerColumn = raster.padding + raster.elementWidth / 2 - 2
  const centerRow = raster.padding + raster.elementHeight / 2 - 2
  const bandWidth = 4
  const strokeBand = Math.max(2, raster.strokeWidthPx - 2)
  const outerHalf = Math.max(2, Math.round(raster.strokeWidthPx / 2))
  const cornerProbe = Math.max(2, outerHalf - 2)

  return {
    topBand: {
      x: centerColumn,
      y: raster.padding - outerHalf + 1,
      width: bandWidth,
      height: strokeBand
    },
    leftBand: {
      x: raster.padding - outerHalf + 1,
      y: centerRow,
      width: strokeBand,
      height: bandWidth
    },
    center: {
      x: raster.padding + raster.elementWidth / 2 - 4,
      y: raster.padding + raster.elementHeight / 2 - 4,
      width: 8,
      height: 8
    },
    outerCornerSquare: {
      x: raster.padding - outerHalf + 1,
      y: raster.padding - outerHalf + 1,
      width: cornerProbe,
      height: cornerProbe
    },
    bevelDiagonal: {
      x: raster.padding - outerHalf + 1,
      y: raster.padding - outerHalf + 1,
      width: outerHalf + 2,
      height: outerHalf + 2
    }
  }
}

test.describe('Solid Center Stroke Visual Benchmarks', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await resetCanvas(page)
  })

  test('benchmark: rectangle center miter keeps a filled outer corner square', async ({
    page
  }) => {
    await createRectangle(page, 0.3, 0.3)
    await configureRectangleCenterStroke(page, {
      join: 'miter',
      cap: 'butt'
    })

    const raster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const probes = getCenterRectProbeRegions(raster)

    const [topBand, leftBand, center, outerCornerSquare] = await Promise.all([
      getGreenCoverage(page, raster, probes.topBand),
      getGreenCoverage(page, raster, probes.leftBand),
      getGreenCoverage(page, raster, probes.center),
      getGreenCoverage(page, raster, probes.outerCornerSquare)
    ])

    expect(topBand).toBeGreaterThan(MIN_BAND_COVERAGE)
    expect(leftBand).toBeGreaterThan(MIN_BAND_COVERAGE)
    expect(center).toBeLessThan(MAX_CENTER_COVERAGE)
    expect(outerCornerSquare).toBeGreaterThan(MIN_MITER_CORNER_COVERAGE)
  })

  test('benchmark: rectangle center bevel cuts the outer corner square away', async ({
    page
  }) => {
    await createRectangle(page, 0.3, 0.3)
    await configureRectangleCenterStroke(page, {
      join: 'bevel',
      cap: 'butt'
    })

    const raster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const probes = getCenterRectProbeRegions(raster)

    const [topBand, leftBand, center, outerCornerSquare, bevelDiagonal] =
      await Promise.all([
      getGreenCoverage(page, raster, probes.topBand),
      getGreenCoverage(page, raster, probes.leftBand),
      getGreenCoverage(page, raster, probes.center),
      getGreenCoverage(page, raster, probes.outerCornerSquare),
      getGreenCoverage(page, raster, probes.bevelDiagonal)
    ])

    expect(topBand).toBeGreaterThan(MIN_BAND_COVERAGE)
    expect(leftBand).toBeGreaterThan(MIN_BAND_COVERAGE)
    expect(center).toBeLessThan(MAX_CENTER_COVERAGE)
    expect(outerCornerSquare).toBeLessThan(MAX_BEVEL_CORNER_COVERAGE)
    expect(bevelDiagonal).toBeGreaterThan(MIN_BEVEL_DIAGONAL_COVERAGE)
  })

  test('benchmark: rectangle center bevel keeps flat-edge thickness equivalent to miter', async ({
    page
  }) => {
    await createRectangle(page, 0.3, 0.3)
    await configureRectangleCenterStroke(page, {
      join: 'miter',
      cap: 'butt'
    })

    const miterRaster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const miterTopBand = await getGreenCoverage(
      page,
      miterRaster,
      getCenterRectProbeRegions(miterRaster).topBand
    )

    await configureRectangleCenterStroke(page, {
      join: 'bevel',
      cap: 'butt'
    })

    const bevelRaster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const bevelTopBand = await getGreenCoverage(
      page,
      bevelRaster,
      getCenterRectProbeRegions(bevelRaster).topBand
    )

    expect(Math.abs(miterTopBand - bevelTopBand)).toBeLessThan(
      MAX_EDGE_COVERAGE_DELTA
    )
  })

  test('benchmark: unsupported round join remains visually absent on center solid rectangles', async ({
    page
  }) => {
    await createRectangle(page, 0.3, 0.3)
    await configureRectangleCenterStroke(page, {
      join: 'round',
      cap: 'butt'
    })

    const raster = await captureSelectedElementRaster(page, STROKE_WIDTH)
    const probes = getCenterRectProbeRegions(raster)

    const [topBand, leftBand, outerCornerSquare] = await Promise.all([
      getGreenCoverage(page, raster, probes.topBand),
      getGreenCoverage(page, raster, probes.leftBand),
      getGreenCoverage(page, raster, probes.outerCornerSquare)
    ])

    expect(topBand).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
    expect(leftBand).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
    expect(outerCornerSquare).toBeLessThan(MAX_UNSUPPORTED_COVERAGE)
  })
})
