import { test, expect } from '@playwright/test'
import {
  waitForAppReady,
  resetCanvas,
  createRectangle,
  hasSelectedElement,
  clickCanvas,
  getPropertiesPanel,
  getContentsPanel
} from './test-utils'

/**
 * E2E Tests for Property Management
 * Based on: .project/bdd-features/properties.feature
 *
 * Feature: Property Management
 *   As a user
 *   I want to view and edit element properties
 *   So that I can customize my design
 */

test.describe('Property Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await resetCanvas(page)
  })

  /**
   * Scenario: Show properties for selected element
   *   Given a rectangle is selected
   *   When I look at the Properties Panel
   *   Then the panel should display the rectangle's properties (x, y, width, height)
   *   And the values should match the selected element
   */
  test('should show properties for selected element', async ({ page }) => {
    // Create a rectangle (it will be selected after creation)
    await createRectangle(page, 0.3, 0.3)

    // Get the Properties Panel
    const propertiesPanel = getPropertiesPanel(page)

    // Verify the Layout header is visible (indicates properties are shown)
    const layoutHeader = propertiesPanel.locator('text=Layout')
    await expect(layoutHeader).toBeVisible()

    // Verify position inputs are visible (X and Y)
    const xInput = propertiesPanel.locator('input').first()
    const yInput = propertiesPanel.locator('input').nth(1)

    await expect(xInput).toBeVisible()
    await expect(yInput).toBeVisible()

    // Verify dimension inputs are visible (W and H)
    const widthInput = propertiesPanel.locator('input').nth(2)
    const heightInput = propertiesPanel.locator('input').nth(3)

    await expect(widthInput).toBeVisible()
    await expect(heightInput).toBeVisible()

    // Verify inputs have numeric values
    const xValue = await xInput.inputValue()
    const yValue = await yInput.inputValue()
    const widthValue = await widthInput.inputValue()
    const heightValue = await heightInput.inputValue()

    expect(parseFloat(xValue)).not.toBeNaN()
    expect(parseFloat(yValue)).not.toBeNaN()
    expect(parseFloat(widthValue)).toBeGreaterThan(0)
    expect(parseFloat(heightValue)).toBeGreaterThan(0)
  })

  /**
   * Scenario: Show empty state when no selection
   *   Given no element is selected
   *   When I look at the Properties Panel
   *   Then the panel should show an empty or default state
   *   And no specific property fields should be active
   */
  test('should show empty state when no element is selected', async ({
    page
  }) => {
    // Create a rectangle and then deselect it
    await createRectangle(page, 0.3, 0.3)

    // Click on empty space to deselect
    await clickCanvas(page, 0.9, 0.9)
    await page.waitForTimeout(200)

    // Get the Properties Panel
    const propertiesPanel = getPropertiesPanel(page)

    // Verify the Layout header is NOT visible (empty state)
    const layoutHeader = propertiesPanel.locator('text=Layout')
    await expect(layoutHeader).not.toBeVisible()

    // Verify no property inputs are visible
    const inputs = propertiesPanel.locator('input')
    const inputCount = await inputs.count()
    expect(inputCount).toBe(0)
  })

  /**
   * Scenario: Update position via properties panel
   *   Given a rectangle is selected with position (100, 100)
   *   When I change the "x" input field to "200"
   *   And I press Enter or blur the field
   *   Then the rectangle's x position should update to 200 on the canvas
   */
  test('should update element position via properties panel', async ({
    page
  }) => {
    // Create a rectangle
    await createRectangle(page, 0.3, 0.3)

    // Get the Properties Panel
    const propertiesPanel = getPropertiesPanel(page)

    // Find and update the X input
    const xInput = propertiesPanel.locator('input').first()

    // Clear the current value and type new value
    await xInput.click()
    await xInput.fill('200')
    await xInput.press('Enter')
    await page.waitForTimeout(200)

    // Verify the value was updated
    const newXValue = await xInput.inputValue()
    expect(newXValue).toBe('200')

    // Update Y position as well
    const yInput = propertiesPanel.locator('input').nth(1)
    await yInput.click()
    await yInput.fill('300')
    await yInput.press('Enter')
    await page.waitForTimeout(200)

    // Verify Y value was updated
    const newYValue = await yInput.inputValue()
    expect(newYValue).toBe('300')
  })

  /**
   * Scenario: Update dimensions via properties panel
   *   Given a rectangle is selected with size (100x100)
   *   When I change the "width" input field to "300"
   *   And I press Enter or blur the field
   *   Then the rectangle's width should update to 300 on the canvas
   */
  test('should update element dimensions via properties panel', async ({
    page
  }) => {
    // Create a rectangle
    await createRectangle(page, 0.3, 0.3)

    // Get the Properties Panel
    const propertiesPanel = getPropertiesPanel(page)

    // Find and update the Width input (3rd input after X, Y)
    const widthInput = propertiesPanel.locator('input').nth(2)

    // Clear the current value and type new value
    await widthInput.click()
    await widthInput.fill('300')
    await widthInput.press('Enter')
    await page.waitForTimeout(200)

    // Verify the value was updated
    const newWidthValue = await widthInput.inputValue()
    expect(newWidthValue).toBe('300')

    // Update Height as well (4th input)
    const heightInput = propertiesPanel.locator('input').nth(3)
    await heightInput.click()
    await heightInput.fill('250')
    await heightInput.press('Enter')
    await page.waitForTimeout(200)

    // Verify Height value was updated
    const newHeightValue = await heightInput.inputValue()
    expect(newHeightValue).toBe('250')
  })

  /**
   * Additional test: Properties update when selecting different elements
   */
  test('should update properties when selecting different elements', async ({
    page
  }) => {
    // Create first rectangle
    await createRectangle(page, 0.2, 0.2)

    // Create second rectangle at different position
    await page.keyboard.press('r')
    await page.waitForTimeout(100)
    await clickCanvas(page, 0.6, 0.6)
    await page.waitForTimeout(300)

    // Get the Properties Panel
    const propertiesPanel = getPropertiesPanel(page)

    // Get current X value (should be from second rectangle)
    const xInput = propertiesPanel.locator('input').first()
    const secondRectX = await xInput.inputValue()

    // Select first rectangle via Contents Panel
    const contentsPanel = getContentsPanel(page)
    const firstElement = contentsPanel
      .locator('[class*="flex items-center justify-between"]')
      .first()
    await firstElement.click()
    await page.waitForTimeout(200)

    // Get new X value (should be from first rectangle)
    const firstRectX = await xInput.inputValue()

    // The X values should be different
    expect(firstRectX).not.toBe(secondRectX)
  })

  /**
   * Additional test: Tab between property fields
   */
  test('should allow tabbing between property fields', async ({ page }) => {
    // Create a rectangle
    await createRectangle(page, 0.3, 0.3)

    // Get the Properties Panel
    const propertiesPanel = getPropertiesPanel(page)

    // Focus on X input
    const xInput = propertiesPanel.locator('input').first()
    await xInput.focus()

    // Press Tab to move to Y input
    await page.keyboard.press('Tab')

    // Verify Y input is now focused
    const yInput = propertiesPanel.locator('input').nth(1)
    await expect(yInput).toBeFocused()
  })
})
