import { test, expect } from '@playwright/test'
import {
  waitForAppReady,
  resetCanvas,
  createRectangle,
  hasSelectedElement,
  clickCanvas,
  getContentsPanel,
  getCanvasPosition
} from './test-utils'

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
      .locator('[class*="flex items-center justify-between"]')
      .first()

    // Check if the item has the selected background style
    const itemClass = (await rectangleItem.getAttribute('class')) ?? ''
    // Selected items should have 'bg-panel-lighter' class
    expect(itemClass).toContain('bg-panel-lighter')
  })
})
