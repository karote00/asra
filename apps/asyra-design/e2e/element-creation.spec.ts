import { test, expect } from '@playwright/test'
import {
  waitForAppReady,
  resetCanvas,
  createRectangle,
  hasSelectedElement,
  getElementCount,
  getContentsPanel,
  getCanvasPosition,
  clickCanvas,
  dragOnCanvas,
  getPropertiesPanel
} from './test-utils'

interface CreateProjectionSnapshot {
  type: string
  modelWidth: number
  modelHeight: number
  renderExists: boolean
  renderWidth: number | null
  renderHeight: number | null
}

const getCreateProjectionSnapshot = async (
  page: Parameters<typeof getCanvasPosition>[0]
): Promise<CreateProjectionSnapshot | null> =>
  page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const core = (window as any).__Core__
    const elements = core?.deps?.sceneTree?.getAllElements?.()
    if (!(elements instanceof Map)) {
      return null
    }

    const entry = Array.from(elements.entries()).find(
      ([, element]) => element?.get?.('type') !== 'workspace'
    )
    if (!entry) {
      return null
    }

    const [elementId, element] = entry
    const computed = element.getAllComputedData?.() ?? {}
    const graphic = core?.deps?.render?.getElementById?.(elementId)
    const renderData = graphic?.__asyraLastRenderDataSnapshot

    return {
      type: String(element.get?.('type') ?? ''),
      modelWidth: Number(computed.width ?? 0),
      modelHeight: Number(computed.height ?? 0),
      renderExists: Boolean(graphic),
      renderWidth:
        typeof renderData?.width === 'number' ? renderData.width : null,
      renderHeight:
        typeof renderData?.height === 'number' ? renderData.height : null
    }
  })

/**
 * E2E Tests for Element Creation
 * Based on: .project/bdd-features/element-creation.feature
 *
 * Feature: Element Creation
 *   As a user
 *   I want to create new elements on the canvas
 *   So that I can build my designs
 */

test.describe('Element Creation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await resetCanvas(page)
  })

  for (const { key, type, label } of [
    { key: 'r', type: 'rect', label: 'rectangle' },
    { key: 'o', type: 'oval', label: 'oval' }
  ]) {
    test(`should project the new ${label} on pointer-down and throughout drag before pointer-up`, async ({
      page
    }, testInfo) => {
      const initialCount = await getElementCount(page)
      const start = await getCanvasPosition(page, 0.55, 0.5)
      const end = await getCanvasPosition(page, 0.3, 0.25)

      await page.keyboard.press(key)
      await page.mouse.move(start.x, start.y)
      await page.mouse.down()

      try {
        const createdRow = getContentsPanel(page).locator(
          '[data-layer-element="true"]'
        )
        await expect
          .poll(() => getElementCount(page), { timeout: 2_000 })
          .toBe(initialCount + 1)
        await expect(createdRow).toBeVisible()
        await expect
          .poll(() => hasSelectedElement(page), { timeout: 2_000 })
          .toBe(true)
        await expect
          .poll(
            async () =>
              (await getCreateProjectionSnapshot(page))?.renderExists ?? false,
            { timeout: 2_000 }
          )
          .toBe(true)

        const pointerDownSnapshot = await getCreateProjectionSnapshot(page)
        expect(pointerDownSnapshot).toMatchObject({ type })
        expect(pointerDownSnapshot?.modelWidth).toBe(0.1)
        expect(pointerDownSnapshot?.modelHeight).toBe(0.1)
        expect(pointerDownSnapshot?.renderWidth).toBeCloseTo(0.1)
        expect(pointerDownSnapshot?.renderHeight).toBeCloseTo(0.1)
        await page.screenshot({
          path: testInfo.outputPath(`${label}-pointer-down.png`)
        })

        await page.mouse.move(end.x, end.y, { steps: 2 })

        await expect
          .poll(
            async () =>
              (await getCreateProjectionSnapshot(page))?.renderWidth ?? 0,
            { timeout: 2_000 }
          )
          .toBeGreaterThan(50)
        await expect
          .poll(
            async () =>
              (await getCreateProjectionSnapshot(page))?.renderHeight ?? 0,
            { timeout: 2_000 }
          )
          .toBeGreaterThan(50)
        expect(await getElementCount(page)).toBe(initialCount + 1)
        await expect(createdRow).toBeVisible()
        expect(await hasSelectedElement(page)).toBe(true)
        await page.screenshot({
          path: testInfo.outputPath(`${label}-hold-drag.png`)
        })
      } finally {
        await page.mouse.up()
      }
    })
  }

  /**
   * Scenario: Create rectangle with default size on click
   *   Given I have the "Rectangle" tool selected
   *   When I click on the canvas at coordinates (100, 100)
   *   Then a new rectangle should be created at (100, 100)
   *   And the new rectangle should have default dimensions (e.g., 100x100)
   *   And the new rectangle should be selected
   */
  test('should create rectangle with default size on single click', async ({
    page
  }) => {
    // Get initial element count
    const initialCount = await getElementCount(page)

    // Switch to Rectangle tool
    await page.keyboard.press('r')
    await page.waitForTimeout(100)

    // Click on the canvas to create a rectangle (center of canvas area)
    await clickCanvas(page, 0.3, 0.3)
    await page.waitForTimeout(300)

    // Verify a new element was created
    const newCount = await getElementCount(page)
    expect(newCount).toBe(initialCount + 1)

    // Verify the new element is selected (Properties Panel shows properties)
    const isSelected = await hasSelectedElement(page)
    expect(isSelected).toBe(true)

    const completedSnapshot = await getCreateProjectionSnapshot(page)
    expect(completedSnapshot?.modelWidth).toBe(100)
    expect(completedSnapshot?.modelHeight).toBe(100)
    expect(completedSnapshot?.renderWidth).toBeCloseTo(100)
    expect(completedSnapshot?.renderHeight).toBeCloseTo(100)

    // Verify the Contents Panel shows the new rectangle
    const contentsPanel = page.locator('[style*="grid-area: left-sidebar"]')
    const rectangleElement = contentsPanel.locator('text=Rectangle').first()
    await expect(rectangleElement).toBeVisible()
  })

  /**
   * Scenario: Create rectangle by dragging (Dynamic Size)
   *   Given I have the "Rectangle" tool selected
   *   When I press the left mouse button at (100, 100)
   *   And I drag the mouse to (300, 200)
   *   And I release the left mouse button
   *   Then a new rectangle should be created at (100, 100)
   *   And the new rectangle should have a width of 200
   *   And the new rectangle should have a height of 100
   *   And the new rectangle should be selected
   */
  test('should create rectangle with dynamic size by dragging', async ({
    page
  }) => {
    // Get initial element count
    const initialCount = await getElementCount(page)

    // Switch to Rectangle tool
    await page.keyboard.press('r')
    await page.waitForTimeout(100)

    // Perform drag to create rectangle (from 0.2,0.2 to 0.5,0.4 of canvas)
    await dragOnCanvas(page, 0.2, 0.2, 0.5, 0.4)
    await page.waitForTimeout(300)

    // Verify a new element was created
    const newCount = await getElementCount(page)
    expect(newCount).toBe(initialCount + 1)

    // Verify the new element is selected
    const isSelected = await hasSelectedElement(page)
    expect(isSelected).toBe(true)

    // Check the dimensions in the Properties Panel
    const propertiesPanel = getPropertiesPanel(page)

    // Get width input value (3rd input after X, Y)
    const widthInput = propertiesPanel.locator('input').nth(2)
    const widthValue = await widthInput.inputValue()

    // Get height input value (4th input)
    const heightInput = propertiesPanel.locator('input').nth(3)
    const heightValue = await heightInput.inputValue()

    // Width and height should be greater than 0 (dynamically sized)
    expect(parseInt(widthValue)).toBeGreaterThan(50)
    expect(parseInt(heightValue)).toBeGreaterThan(50)
  })

  /**
   * Additional test: Create multiple rectangles in sequence
   */
  test('should allow creating multiple rectangles in sequence', async ({
    page
  }) => {
    // Create first rectangle
    await createRectangle(page, 0.2, 0.2)

    // Create second rectangle at different position
    await page.keyboard.press('r')
    await page.waitForTimeout(100)
    await clickCanvas(page, 0.6, 0.6)
    await page.waitForTimeout(300)

    // Verify two elements were created
    const count = await getElementCount(page)
    expect(count).toBeGreaterThanOrEqual(2)
  })

  /**
   * Additional test: Rectangle should appear in Contents Panel with correct name
   */
  test('should add created rectangle to Contents Panel', async ({ page }) => {
    // Create a rectangle
    await createRectangle(page, 0.4, 0.4)

    // Check Contents Panel for the rectangle entry
    const contentsPanel = page.locator('[style*="grid-area: left-sidebar"]')
    const rectangleEntry = contentsPanel.locator('text=Rectangle')
    await expect(rectangleEntry.first()).toBeVisible()
  })
})
