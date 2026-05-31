import { expect, test, type Page } from '@playwright/test'
import {
  createRectangle,
  fillStrokeDashGap,
  getPropertiesPanel,
  getSelectedElementRect,
  resetCanvas,
  setStrokeDiagnosticsMode,
  waitForAppReady
} from './test-utils'

const PADDING = 24
const MIN_DEBUG_OVERLAY_COVERAGE = 0.01
const MIN_OWNERSHIP_OVERLAY_COVERAGE = 0.005
const MIN_BAILOUT_OVERLAY_COVERAGE = 0.01

interface RasterCapture {
  base64: string
  width: number
  height: number
}

const ensureDebugFlag = async (
  page: Page,
  overrides: {
    mode?: 'overlap' | 'ownership' | 'bailout' | 'all'
    forceBailoutReason?: 'owner-tie-unresolved'
  } = {}
) => {
  await page.evaluate(() => {
    ;(
      window as unknown as { __ASYRA_CENTER_DASHED_OVERLAP_DEBUG__?: unknown }
    ).__ASYRA_CENTER_DASHED_OVERLAP_DEBUG__ = undefined
  })
  await page.evaluate((config) => {
    ;(
      window as unknown as {
        __ASYRA_CENTER_DASHED_OVERLAP_DEBUG__?: {
          enabled?: boolean
          mode?: 'overlap' | 'ownership' | 'bailout' | 'all'
          forceBailoutReason?: 'owner-tie-unresolved'
        }
      }
    ).__ASYRA_CENTER_DASHED_OVERLAP_DEBUG__ = {
      enabled: true,
      ...config
    }
  }, overrides)
}

const ensureTwoStrokeRows = async (page: Page) => {
  const propertiesPanel = getPropertiesPanel(page)
  if (await propertiesPanel.getByTestId('prop-strokes-empty').isVisible()) {
    await propertiesPanel.getByTestId('prop-stroke-add').click()
  }

  await expect(propertiesPanel.getByTestId('prop-stroke-0')).toBeVisible()

  const secondStroke = propertiesPanel.getByTestId('prop-stroke-1')
  if (!(await secondStroke.isVisible())) {
    await propertiesPanel.getByTestId('prop-stroke-add').click()
    await expect(secondStroke).toBeVisible()
  }
}

const configureSelectedRectangleForOverlap = async (page: Page) => {
  const propertiesPanel = getPropertiesPanel(page)
  await propertiesPanel.getByTestId('prop-width').fill('180')
  await propertiesPanel.getByTestId('prop-width').press('Enter')
  await propertiesPanel.getByTestId('prop-height').fill('120')
  await propertiesPanel.getByTestId('prop-height').press('Enter')

  for (const index of [0, 1]) {
    await propertiesPanel
      .getByTestId(`prop-stroke-style-${index}`)
      .selectOption('dashed')
    await propertiesPanel.getByTestId(`prop-stroke-width-${index}`).fill('18')
    await propertiesPanel
      .getByTestId(`prop-stroke-width-${index}`)
      .press('Enter')
    await fillStrokeDashGap(propertiesPanel, index, '36, 18')
  }

  await page.waitForTimeout(300)
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
    height: clip.height
  }
}

const getDebugOverlayCoverage = async (page: Page, raster: RasterCapture) =>
  page.evaluate(async ({ base64, width, height }) => {
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

    let overlay = 0
    let total = 0
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const [r, g, b, a] = context.getImageData(x, y, 1, 1).data
        total += 1
        const magentaLike = a > 20 && r > 150 && b > 150 && g < 120
        if (magentaLike) {
          overlay += 1
        }
      }
    }

    return total > 0 ? overlay / total : 0
  }, raster)

const getOwnershipOverlayCoverage = async (page: Page, raster: RasterCapture) =>
  page.evaluate(async ({ base64, width, height }) => {
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

    let overlay = 0
    let total = 0
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const [r, g, _b, a] = context.getImageData(x, y, 1, 1).data
        total += 1
        const ownershipLike = a > 20 && g > 150 && r < 150
        if (ownershipLike) {
          overlay += 1
        }
      }
    }

    return total > 0 ? overlay / total : 0
  }, raster)

const getBailoutOverlayCoverage = async (page: Page, raster: RasterCapture) =>
  page.evaluate(async ({ base64, width, height }) => {
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

    let overlay = 0
    let total = 0
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const [r, g, b, a] = context.getImageData(x, y, 1, 1).data
        total += 1
        const bailoutLike = a > 20 && r > 160 && g > 70 && g < 180 && b < 120
        if (bailoutLike) {
          overlay += 1
        }
      }
    }

    return total > 0 ? overlay / total : 0
  }, raster)

const getOverlapDiagnosticsSnapshot = async (page: Page) =>
  page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const selectedId = core?.deps?.selection?.getElementSelectionIds?.()?.[0]
    if (!selectedId) {
      return null
    }

    const graphic = core?.deps?.render?.getElementById?.(selectedId)
    return graphic?.__asyraCenterDashedOverlapDiagnostics ?? null
  })

test.describe('Center Dashed Overlap Visual', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await resetCanvas(page)
    await setStrokeDiagnosticsMode(page, 'full')
  })

  test('shows overlap debug overlay for a selected rectangle with overlapping dashed strokes', async ({
    page
  }) => {
    await ensureDebugFlag(page, { mode: 'overlap' })
    await createRectangle(page, 0.3, 0.3)
    await ensureTwoStrokeRows(page)
    await configureSelectedRectangleForOverlap(page)

    const diagnostics = await getOverlapDiagnosticsSnapshot(page)
    expect(diagnostics?.components?.length).toBeGreaterThan(0)
    expect(diagnostics?.edges?.length).toBeGreaterThan(0)

    const raster = await captureSelectedElementRaster(page)
    const overlayCoverage = await getDebugOverlayCoverage(page, raster)
    expect(overlayCoverage).toBeGreaterThan(MIN_DEBUG_OVERLAY_COVERAGE)
  })

  test('shows ownership debug overlay for a selected rectangle with deterministic owners on overlapping dashed strokes', async ({
    page
  }) => {
    await ensureDebugFlag(page, { mode: 'ownership' })
    await createRectangle(page, 0.3, 0.3)
    await ensureTwoStrokeRows(page)
    await configureSelectedRectangleForOverlap(page)

    const diagnostics = await getOverlapDiagnosticsSnapshot(page)
    expect(diagnostics?.ownership?.ownedRegions?.length).toBeGreaterThan(0)
    expect(diagnostics?.ownership?.unresolvedBailouts ?? []).toEqual([])

    const raster = await captureSelectedElementRaster(page)
    const overlayCoverage = await getOwnershipOverlayCoverage(page, raster)
    expect(overlayCoverage).toBeGreaterThan(MIN_OWNERSHIP_OVERLAY_COVERAGE)
  })

  test('shows bailout debug overlay when component-local ownership bailout is forced', async ({
    page
  }) => {
    await ensureDebugFlag(page, {
      mode: 'bailout',
      forceBailoutReason: 'owner-tie-unresolved'
    })
    await createRectangle(page, 0.3, 0.3)
    await ensureTwoStrokeRows(page)
    await configureSelectedRectangleForOverlap(page)

    const diagnostics = await getOverlapDiagnosticsSnapshot(page)
    expect(diagnostics?.ownership?.ownedRegions ?? []).toEqual([])
    expect(diagnostics?.ownership?.unresolvedBailouts?.length).toBeGreaterThan(
      0
    )

    const raster = await captureSelectedElementRaster(page)
    const overlayCoverage = await getBailoutOverlayCoverage(page, raster)
    expect(overlayCoverage).toBeGreaterThan(MIN_BAILOUT_OVERLAY_COVERAGE)
  })

  test('hides overlap debug overlay when the debug flag is disabled', async ({
    page
  }) => {
    await ensureDebugFlag(page, { mode: 'overlap' })
    await createRectangle(page, 0.3, 0.3)
    await ensureTwoStrokeRows(page)
    await configureSelectedRectangleForOverlap(page)

    await page.evaluate(() => {
      ;(
        window as unknown as {
          __ASYRA_CENTER_DASHED_OVERLAP_DEBUG__?: { enabled?: boolean }
        }
      ).__ASYRA_CENTER_DASHED_OVERLAP_DEBUG__ = { enabled: false }
    })
    await page.waitForTimeout(120)

    const raster = await captureSelectedElementRaster(page)
    const overlayCoverage = await getDebugOverlayCoverage(page, raster)
    expect(overlayCoverage).toBeLessThan(MIN_DEBUG_OVERLAY_COVERAGE / 2)
  })
})
