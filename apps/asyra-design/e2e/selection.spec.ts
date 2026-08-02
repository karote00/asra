import { test, expect } from '@playwright/test'
import {
  createTestDocumentURL,
  waitForAppReady,
  resetCanvas,
  createRectangle,
  hasSelectedElement,
  clickCanvas,
  getContentsPanel,
  getCanvasPosition,
  getSelectedElementRect,
  getElementRectClientCenter,
  getSelectedElementClientCenter,
  dragSelectedElementBy
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
    await page.goto(createTestDocumentURL())
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

  test('projects area-selection preview before pointer release', async ({
    page
  }) => {
    await createRectangle(page, 0.5, 0.5)
    const rectangle = await getSelectedElementRect(page)
    expect(rectangle).not.toBeNull()
    if (!rectangle) {
      return
    }

    await clickCanvas(page, 0.9, 0.9)
    await expect.poll(() => hasSelectedElement(page)).toBe(false)
    await page.evaluate(async () => {
      const { startSharedChannelCapture } = await import(
        '../src/testing/runtime-access'
      )
      startSharedChannelCapture('selection-preview-deliveries', 'selection')
    })

    const drag = await page.evaluate(async ({ x, y, width, height }) => {
      const core = (await import('../src/testing/runtime-access')).core
      const zoom = core?.getSystemProperty?.('zoom') ?? 1
      const viewport = core?.getSystemProperty?.('viewportPosition') ?? {
        x: 0,
        y: 0
      }
      return {
        start: {
          x: (x - 20) * zoom + viewport.x,
          y: (y - 20) * zoom + viewport.y
        },
        end: {
          x: (x + width + 20) * zoom + viewport.x,
          y: (y + height + 20) * zoom + viewport.y
        }
      }
    }, rectangle)

    await page.mouse.move(drag.start.x, drag.start.y)
    await page.mouse.down()
    await page.mouse.move(drag.end.x, drag.end.y, { steps: 12 })

    await expect.poll(() => hasSelectedElement(page)).toBe(true)
    const previewDeliveries = await page.evaluate(async () => {
      const { readTestCapture } = await import('../src/testing/runtime-access')
      return readTestCapture('selection-preview-deliveries')
    })
    expect(previewDeliveries).toContainEqual(
      expect.objectContaining({
        options: expect.objectContaining({ sharedDelivery: 'immediate' })
      })
    )
    await page.mouse.up()
    await page.evaluate(async () => {
      const { stopTestCapture } = await import('../src/testing/runtime-access')
      stopTestCapture('selection-preview-deliveries')
    })
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

    const startClient = await getElementRectClientCenter(page, before)

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

    const selectedId = await page.evaluate(async () => {
      const core = (await import('../src/testing/runtime-access')).core
      return core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
    })

    expect(selectedId).not.toBeNull()
    if (!selectedId) {
      return
    }

    const elementPos = await getSelectedElementClientCenter(page)

    expect(elementPos).not.toBeNull()
    if (!elementPos) {
      return
    }

    await page.mouse.move(elementPos.x, elementPos.y)
    await expect
      .poll(async () => {
        return page.evaluate(async () => {
          const core = (await import('../src/testing/runtime-access')).core
          return core?.getSystemProperty?.('hoveredElementId') ?? null
        })
      })
      .toBe(selectedId)

    const emptyPos = await getCanvasPosition(page, 0.9, 0.9)
    await page.mouse.move(emptyPos.x, emptyPos.y)
    await expect
      .poll(async () => {
        return page.evaluate(async () => {
          const core = (await import('../src/testing/runtime-access')).core
          return core?.getSystemProperty?.('hoveredElementId') ?? null
        })
      })
      .toBeNull()
  })

  test('should keep element hover stable while dragging across another element', async ({
    page
  }) => {
    await createRectangle(page, 0.25, 0.35)
    const dragOwner = await getSelectedElementRect(page)
    expect(dragOwner).not.toBeNull()
    if (!dragOwner) {
      return
    }

    await createRectangle(page, 0.65, 0.35)
    const crossedElement = await getSelectedElementRect(page)
    expect(crossedElement).not.toBeNull()
    if (!crossedElement) {
      return
    }

    const centers = await page.evaluate(
      async ({ dragOwner, crossedElement }) => {
        const core = (await import('../src/testing/runtime-access')).core
        const zoom = core?.getSystemProperty?.('zoom') ?? 1
        const viewport = core?.getSystemProperty?.('viewportPosition') ?? {
          x: 0,
          y: 0
        }
        const toClientCenter = (element: {
          x: number
          y: number
          width: number
          height: number
        }) => ({
          x: (element.x + element.width / 2) * zoom + viewport.x,
          y: (element.y + element.height / 2) * zoom + viewport.y
        })

        return {
          dragOwner: toClientCenter(dragOwner),
          crossedElement: toClientCenter(crossedElement)
        }
      },
      { dragOwner, crossedElement }
    )

    await page.mouse.move(centers.dragOwner.x, centers.dragOwner.y)
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const core = (await import('../src/testing/runtime-access')).core
          return core?.getSystemProperty?.('hoveredElementId') ?? null
        })
      )
      .toBe(dragOwner.id)
    await page.mouse.click(centers.dragOwner.x, centers.dragOwner.y)

    await page.evaluate(async () => {
      const { startSystemPropertyWriteCapture } = await import(
        '../src/testing/runtime-access'
      )
      startSystemPropertyWriteCapture('drag-hover-writes', {
        propertyName: 'hoveredElementId',
        whileMouseDragging: true
      })
    })

    let dragHoverWrites: (string | null)[] = []
    let hoveredElementIdDuringDrag: string | null = null
    await page.mouse.move(centers.dragOwner.x, centers.dragOwner.y)
    await page.mouse.down()
    try {
      await page.mouse.move(
        centers.crossedElement.x,
        centers.crossedElement.y,
        { steps: 20 }
      )
      await page.waitForTimeout(100)
      const dragHoverState = await page.evaluate(async () => {
        const { core, readTestCapture } = await import(
          '../src/testing/runtime-access'
        )
        return {
          writes: readTestCapture('drag-hover-writes').map(
            (entry) => (entry as readonly [string, string | null])[1]
          ),
          hoveredElementId: core.getSystemProperty('hoveredElementId') ?? null
        }
      })
      dragHoverWrites = dragHoverState.writes
      hoveredElementIdDuringDrag = dragHoverState.hoveredElementId
    } finally {
      await page.mouse.up()
      await page.evaluate(async () => {
        const { stopTestCapture } = await import(
          '../src/testing/runtime-access'
        )
        stopTestCapture('drag-hover-writes')
      })
    }

    expect(dragHoverWrites).toEqual([])
    expect(hoveredElementIdDuringDrag).toBe(dragOwner.id)
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

    const selectedIds = await page.evaluate(async () => {
      const core = (await import('../src/testing/runtime-access')).core
      return core?.deps?.selection?.getElementSelectionIds?.() ?? []
    })

    expect(selectedIds.length).toBe(2)
    await expect(firstRow).toHaveAttribute('data-selected', 'true')
    await expect(secondRow).toHaveAttribute('data-selected', 'true')
  })
})
