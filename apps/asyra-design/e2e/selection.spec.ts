import { test, expect, type Page } from '@playwright/test'
import {
  waitForAppReady,
  resetCanvas,
  createRectangle,
  hasSelectedElement,
  clickCanvas,
  getContentsPanel,
  getCanvasPosition,
  getSelectedElementRect,
  dragSelectedElementBy,
  getPropertiesPanel
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

interface SelectionRasterCapture {
  base64: string
  width: number
  height: number
  elementWidth: number
  elementHeight: number
  padding: number
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
  padding = 28
): Promise<SelectionRasterCapture> => {
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
    padding
  }
}

const getBlueCoverage = async (
  page: Page,
  raster: SelectionRasterCapture,
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
      let blue = 0
      for (let y = startY; y < endY; y += 1) {
        for (let x = startX; x < endX; x += 1) {
          const [r, g, b, a] = context.getImageData(x, y, 1, 1).data
          total += 1
          if (a > 180 && b > 180 && g > 90 && r < 80 && b - r > 120) {
            blue += 1
          }
        }
      }

      return total > 0 ? blue / total : 0
    },
    { base64: raster.base64, region }
  )

const ensureStrokeRow = async (page: Page) => {
  const propertiesPanel = getPropertiesPanel(page)
  await expect(
    propertiesPanel.getByTestId('prop-strokes-section')
  ).toBeVisible()
  if (await propertiesPanel.getByTestId('prop-strokes-empty').isVisible()) {
    await propertiesPanel.getByTestId('prop-stroke-add').click()
  }

  await expect(propertiesPanel.getByTestId('prop-stroke-0')).toBeVisible()
}

/**
 * E2E Tests for Element Selection
 * Based on: .project/bdd-features/selection.feature
 *
 * Feature: Element Selection
 *   As a user
 *   I want to select elements on the canvas
 *   So that I can modify their properties or transform them
 */

test.describe('Element Selection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await resetCanvas(page)
  })

  /**
   * Scenario: Select a single element by clicking
   *   Given I have the "Select" tool selected
   *   And there is a rectangle at (100, 100)
   *   When I click on the canvas at coordinates (110, 110)
   *   Then the rectangle should be selected
   *   And a selection box should appear around the rectangle
   */
  test('should select a single element by clicking on it', async ({ page }) => {
    // Create a rectangle
    await createRectangle(page, 0.3, 0.3)

    // Click on empty space first to deselect
    await clickCanvas(page, 0.8, 0.8)
    await page.waitForTimeout(200)

    // Verify element is not selected
    let isSelected = await hasSelectedElement(page)
    expect(isSelected).toBe(false)

    // Click on the rectangle to select it (same position where created)
    await clickCanvas(page, 0.3, 0.3)
    await page.waitForTimeout(200)

    // Verify element is now selected
    isSelected = await hasSelectedElement(page)
    expect(isSelected).toBe(true)
  })

  /**
   * Scenario: Deselect element by clicking empty space
   *   Given I have the "Select" tool selected
   *   And a rectangle is currently selected
   *   When I click on the canvas at coordinates (0, 0) where there are no elements
   *   Then the rectangle should be deselected
   *   And the selection box should disappear
   */
  test('should deselect element by clicking empty space', async ({ page }) => {
    // Create a rectangle (it will be selected after creation)
    await createRectangle(page, 0.4, 0.4)

    // Verify element is selected
    let isSelected = await hasSelectedElement(page)
    expect(isSelected).toBe(true)

    // Click on empty space (far from the rectangle)
    await clickCanvas(page, 0.9, 0.9)
    await page.waitForTimeout(200)

    // Verify element is now deselected
    isSelected = await hasSelectedElement(page)
    expect(isSelected).toBe(false)
  })

  test('should drag selected element to a new position', async ({ page }) => {
    await createRectangle(page, 0.35, 0.35)

    const before = await getSelectedElementRect(page)
    expect(before).not.toBeNull()
    if (!before) {
      return
    }

    await dragSelectedElementBy(page, 120, 80, 24)
    await page.waitForTimeout(150)

    const after = await getSelectedElementRect(page)
    expect(after).not.toBeNull()
    if (!after) {
      return
    }

    expect(after.id).toBe(before.id)
    expect(after.x).toBeGreaterThan(before.x)
    expect(after.y).toBeGreaterThan(before.y)
  })

  test('should drag hovered unlocked element even when not preselected', async ({
    page
  }) => {
    await createRectangle(page, 0.35, 0.35)

    const before = await getSelectedElementRect(page)
    expect(before).not.toBeNull()
    if (!before) {
      return
    }

    await clickCanvas(page, 0.9, 0.9)
    await page.waitForTimeout(120)
    expect(await hasSelectedElement(page)).toBe(false)

    const startClient = await page.evaluate(({ x, y, width, height }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      const zoom = core?.getSystemProperty?.('zoom') ?? 1
      const viewport = core?.getSystemProperty?.('viewportPosition') ?? {
        x: 0,
        y: 0
      }
      return {
        x: (x + width / 2) * zoom + viewport.x,
        y: (y + height / 2) * zoom + viewport.y
      }
    }, before)

    await page.mouse.move(startClient.x, startClient.y)
    await page.mouse.down()
    await page.mouse.move(startClient.x + 100, startClient.y + 70, {
      steps: 20
    })
    await page.mouse.up()
    await page.waitForTimeout(150)

    const after = await getSelectedElementRect(page)
    expect(after).not.toBeNull()
    if (!after) {
      return
    }

    expect(after.id).toBe(before.id)
    expect(after.x).toBeGreaterThan(before.x)
    expect(after.y).toBeGreaterThan(before.y)
  })

  test('should update hovered element id when moving over element bounds', async ({
    page
  }) => {
    await createRectangle(page, 0.32, 0.34)

    const selectedId = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      return core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
    })

    expect(selectedId).not.toBeNull()
    if (!selectedId) {
      return
    }

    const elementPos = await page.evaluate((elementId) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      const element = core?.deps?.sceneTree?.getElementById?.(elementId)
      const computed = element?.getAllComputedData?.() ?? {}
      const x = typeof computed.x === 'number' ? computed.x : null
      const y = typeof computed.y === 'number' ? computed.y : null
      const width = typeof computed.width === 'number' ? computed.width : null
      const height =
        typeof computed.height === 'number' ? computed.height : null
      const zoom = core?.getSystemProperty?.('zoom') ?? 1
      const viewport = core?.getSystemProperty?.('viewportPosition') ?? {
        x: 0,
        y: 0
      }

      if (x === null || y === null || width === null || height === null) {
        return null
      }

      return {
        x: (x + width / 2) * zoom + viewport.x,
        y: (y + height / 2) * zoom + viewport.y
      }
    }, selectedId)

    expect(elementPos).not.toBeNull()
    if (!elementPos) {
      return
    }

    await page.mouse.move(elementPos.x, elementPos.y)
    await expect
      .poll(async () => {
        return page.evaluate(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const core = (window as any).__Core__
          return core?.getSystemProperty?.('hoveredElementId') ?? null
        })
      })
      .toBe(selectedId)

    const emptyPos = await getCanvasPosition(page, 0.9, 0.9)
    await page.mouse.move(emptyPos.x, emptyPos.y)
    await expect
      .poll(async () => {
        return page.evaluate(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const core = (window as any).__Core__
          return core?.getSystemProperty?.('hoveredElementId') ?? null
        })
      })
      .toBeNull()
  })

  test('should keep selection box on authored element bounds even when stroke expands outward', async ({
    page
  }) => {
    await createRectangle(page, 0.32, 0.34)

    await ensureStrokeRow(page)
    const propertiesPanel = getPropertiesPanel(page)
    await propertiesPanel
      .getByTestId('prop-stroke-style-0')
      .selectOption('solid')
    await propertiesPanel
      .getByTestId('prop-stroke-position-0')
      .selectOption('outside')
    await propertiesPanel.getByTestId('prop-stroke-width-0').fill('16')
    await propertiesPanel.getByTestId('prop-stroke-width-0').press('Enter')
    await page.waitForTimeout(180)

    const raster = await captureSelectedElementRaster(page)
    const topAuthoredBand = {
      x: raster.padding + raster.elementWidth / 2 - 6,
      y: raster.padding - 1,
      width: 12,
      height: 3
    }
    const topStrokeOnlyBand = {
      x: raster.padding + raster.elementWidth / 2 - 6,
      y: raster.padding - 16,
      width: 12,
      height: 4
    }

    const [authoredCoverage, strokeOnlyCoverage] = await Promise.all([
      getBlueCoverage(page, raster, topAuthoredBand),
      getBlueCoverage(page, raster, topStrokeOnlyBand)
    ])

    expect(authoredCoverage).toBeGreaterThan(0.2)
    expect(strokeOnlyCoverage).toBeLessThan(0.05)
  })

  /**
   * Scenario: Select element via Contents Panel
   *   Given I have the "Select" tool selected
   *   And there is a rectangle named "Rectangle 1" in the Contents Panel
   *   When I click on "Rectangle 1" in the Contents Panel
   *   Then the rectangle "Rectangle 1" should be selected on the canvas
   */
  test('should select element via Contents Panel', async ({ page }) => {
    // Create a rectangle
    await createRectangle(page, 0.3, 0.3)

    // Deselect by clicking empty space
    await clickCanvas(page, 0.9, 0.9)
    await page.waitForTimeout(200)

    // Verify element is not selected
    let isSelected = await hasSelectedElement(page)
    expect(isSelected).toBe(false)

    // Find the element in the Contents Panel and click it
    const contentsPanel = getContentsPanel(page)
    const rectangleItem = contentsPanel
      .locator('[class*="flex items-center justify-between"]')
      .first()
    await rectangleItem.click()
    await page.waitForTimeout(200)

    // Verify element is now selected
    isSelected = await hasSelectedElement(page)
    expect(isSelected).toBe(true)
  })

  /**
   * Scenario: Deselect via Contents Panel
   *   Given I have the "Select" tool selected
   *   And a rectangle is currently selected
   *   When I click on an empty area in the Contents Panel
   *   Then the rectangle should be deselected
   */
  test('should deselect via Contents Panel empty area click', async ({
    page
  }) => {
    // Create a rectangle (it will be selected after creation)
    await createRectangle(page, 0.3, 0.3)

    // Verify element is selected
    let isSelected = await hasSelectedElement(page)
    expect(isSelected).toBe(true)

    // Click on the Contents Panel container (empty area below elements)
    const contentsPanel = getContentsPanel(page)
    const panelBounds = await contentsPanel.boundingBox()
    if (panelBounds) {
      // Click at the bottom of the panel where there are no elements
      await page.mouse.click(
        panelBounds.x + panelBounds.width / 2,
        panelBounds.y + panelBounds.height - 50
      )
      await page.waitForTimeout(200)
    }

    // Verify element is now deselected
    isSelected = await hasSelectedElement(page)
    expect(isSelected).toBe(false)
  })

  /**
   * Additional test: Selected element should be highlighted in Contents Panel
   */
  test('should highlight selected element in Contents Panel', async ({
    page
  }) => {
    // Create a rectangle (it will be selected after creation)
    await createRectangle(page, 0.3, 0.3)

    // Find the element in the Contents Panel
    const contentsPanel = getContentsPanel(page)
    const rectangleItem = contentsPanel
      .locator('[data-layer-element="true"]')
      .first()

    // Selected items should expose data-selected
    await expect(rectangleItem).toHaveAttribute('data-selected', 'true')
  })

  test('should multi-select elements via Contents Panel with shift', async ({
    page
  }) => {
    await createRectangle(page, 0.25, 0.3)
    await createRectangle(page, 0.45, 0.4)

    const contentsPanel = getContentsPanel(page)
    const firstRow = contentsPanel.locator('[data-layer-element="true"]').nth(0)
    const secondRow = contentsPanel
      .locator('[data-layer-element="true"]')
      .nth(1)

    await firstRow.click()
    await page.keyboard.down('Shift')
    await secondRow.click()
    await page.keyboard.up('Shift')
    await page.waitForTimeout(200)

    const selectedIds = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      return core?.deps?.selection?.getElementSelectionIds?.() ?? []
    })

    expect(selectedIds.length).toBe(2)
    await expect(firstRow).toHaveAttribute('data-selected', 'true')
    await expect(secondRow).toHaveAttribute('data-selected', 'true')
  })
})
