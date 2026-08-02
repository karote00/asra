import { test, expect } from '@playwright/test'
import {
  createTestDocumentURL,
  waitForAppReady,
  resetCanvas,
  createOval,
  hasSelectedElement,
  getElementCount,
  clickCanvas,
  dragOnCanvas,
  getPropertiesPanel,
  getActiveTool
} from './test-utils'

/**
 * E2E Tests for Oval Tool
 *
 * Feature: Oval Tool
 *   As a user
 *   I want to create oval elements on the canvas
 *   So that I can build my designs with oval shapes
 */

test.describe('Oval Tool', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(createTestDocumentURL())
    await waitForAppReady(page)
    await resetCanvas(page)
  })

  /**
   * Scenario: Switch to Oval Tool via Shortcut
   *   Given I have the "Select" tool selected
   *   When I press the "O" key
   *   Then the "Oval" tool should be selected
   *   And the cursor should change to indicate creation mode
   */
  test('should switch to Oval tool when pressing O key', async ({ page }) => {
    // First, ensure Select tool is active by pressing V
    await page.keyboard.press('V')
    await page.waitForTimeout(100)

    // Verify Select tool is active
    const initialTool = await getActiveTool(page)
    expect(initialTool).toBe('select')

    // Press O to switch to Oval tool
    await page.keyboard.press('O')
    await page.waitForTimeout(100)

    // Verify Oval tool is now active
    const newTool = await getActiveTool(page)
    expect(newTool).toBe('oval')
  })

  /**
   * Scenario: Create oval with default size on click
   *   Given I have the "Oval" tool selected
   *   When I click on the canvas at coordinates (100, 100)
   *   Then a new oval should be created at (100, 100)
   *   And the new oval should have default dimensions
   *   And the new oval should be selected
   */
  test('should create oval with default size on single click', async ({
    page
  }) => {
    // Get initial element count
    const initialCount = await getElementCount(page)

    // Switch to Oval tool
    await page.keyboard.press('o')
    await page.waitForTimeout(100)

    // Click on the canvas to create an oval (center of canvas area)
    await clickCanvas(page, 0.3, 0.3)
    await page.waitForTimeout(300)

    // Verify a new element was created
    const newCount = await getElementCount(page)
    expect(newCount).toBe(initialCount + 1)

    // Verify the new element is selected (Properties Panel shows properties)
    const isSelected = await hasSelectedElement(page)
    expect(isSelected).toBe(true)

    // Verify the Contents Panel shows the new oval
    const contentsPanel = page.locator('[style*="grid-area: left-sidebar"]')
    const ovalElement = contentsPanel.locator('text=Oval').first()
    await expect(ovalElement).toBeVisible()
  })

  /**
   * Scenario: Create oval by dragging (Dynamic Size)
   *   Given I have the "Oval" tool selected
   *   When I press the left mouse button at (100, 100)
   *   And I drag the mouse to (300, 200)
   *   And I release the left mouse button
   *   Then a new oval should be created at (100, 100)
   *   And the new oval should have dynamic dimensions
   *   And the new oval should be selected
   */
  test('should create oval with dynamic size by dragging', async ({ page }) => {
    // Get initial element count
    const initialCount = await getElementCount(page)

    // Switch to Oval tool
    await page.keyboard.press('o')
    await page.waitForTimeout(100)

    // Perform drag to create oval (from 0.2,0.2 to 0.5,0.4 of canvas)
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
   * Scenario: Switch to Oval tool via toolbar button
   *   Given I have the "Select" tool selected
   *   When I click the Oval tool button in the toolbar
   *   Then the "Oval" tool should be selected
   */
  test('should switch to Oval tool when clicking toolbar button', async ({
    page
  }) => {
    // Ensure we start with Select tool
    await page.keyboard.press('V')
    await page.waitForTimeout(100)

    // Click the Oval tool button in toolbar using test-id
    await page.getByTestId('tool-oval').click()
    await page.waitForTimeout(100)

    // Verify Oval tool is now active
    const newTool = await getActiveTool(page)
    expect(newTool).toBe('oval')
  })

  /**
   * Additional test: Create multiple ovals in sequence
   */
  test('should allow creating multiple ovals in sequence', async ({ page }) => {
    // Create first oval
    await createOval(page, 0.2, 0.2)

    // Create second oval at different position
    await page.keyboard.press('o')
    await page.waitForTimeout(100)
    await clickCanvas(page, 0.6, 0.6)
    await page.waitForTimeout(300)

    // Verify two elements were created
    const count = await getElementCount(page)
    expect(count).toBeGreaterThanOrEqual(2)
  })

  /**
   * Additional test: Oval should appear in Contents Panel with correct name
   */
  test('should add created oval to Contents Panel', async ({ page }) => {
    // Create an oval
    await createOval(page, 0.4, 0.4)

    // Check Contents Panel for the oval entry
    const contentsPanel = page.locator('[style*="grid-area: left-sidebar"]')
    const ovalEntry = contentsPanel.locator('text=Oval')
    await expect(ovalEntry.first()).toBeVisible()
  })

  /**
   * Additional test: Switch between Rectangle and Oval tools
   */
  test('should allow switching between Rectangle and Oval tools', async ({
    page
  }) => {
    // Switch to Rectangle tool
    await page.keyboard.press('r')
    await page.waitForTimeout(100)
    let activeTool = await getActiveTool(page)
    expect(activeTool).toBe('rectangle')

    // Switch to Oval tool
    await page.keyboard.press('o')
    await page.waitForTimeout(100)
    activeTool = await getActiveTool(page)
    expect(activeTool).toBe('oval')

    // Switch back to Rectangle tool
    await page.keyboard.press('r')
    await page.waitForTimeout(100)
    activeTool = await getActiveTool(page)
    expect(activeTool).toBe('rectangle')
  })
})
