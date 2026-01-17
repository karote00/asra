import { test, expect } from '@playwright/test'
import {
  waitForAppReady,
  // getToolbar,
  getActiveTool
} from './test-utils'

/**
 * E2E Tests for Tool Switching
 * Based on: .project/bdd-features/tool-switching.feature
 *
 * Feature: Tool Switching
 *   As a user
 *   I want to switch between different tools (Select, Rectangle)
 *   So that I can perform different actions on the canvas
 */

test.describe('Tool Switching', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
  })

  /**
   * Scenario: Switch to Rectangle Tool via Shortcut
   *   Given I have the "Select" tool selected
   *   When I press the "R" key
   *   Then the "Rectangle" tool should be selected
   *   And the cursor should change to indicate creation mode
   */
  test('should switch to Rectangle tool when pressing R key', async ({
    page
  }) => {
    // First, ensure Select tool is active by pressing V
    await page.keyboard.press('V')
    await page.waitForTimeout(100)

    // Verify Select tool is active
    const initialTool = await getActiveTool(page)
    expect(initialTool).toBe('select')

    // Press R to switch to Rectangle tool
    await page.keyboard.press('R')
    await page.waitForTimeout(100)

    // Verify Rectangle tool is now active
    const newTool = await getActiveTool(page)
    expect(newTool).toBe('rectangle')
  })

  /**
   * Scenario: Switch to Select Tool via Shortcut
   *   Given I have the "Rectangle" tool selected
   *   When I press the "V" key
   *   Then the "Select" tool should be selected
   *   And the cursor should change to standard pointer
   */
  test('should switch to Select tool when pressing V key', async ({ page }) => {
    // First, switch to Rectangle tool
    await page.keyboard.press('r')
    await page.waitForTimeout(100)

    // Verify Rectangle tool is active
    const initialTool = await getActiveTool(page)
    expect(initialTool).toBe('rectangle')

    // Press V to switch to Select tool
    await page.keyboard.press('v')
    await page.waitForTimeout(100)

    // Verify Select tool is now active
    const newTool = await getActiveTool(page)
    expect(newTool).toBe('select')
  })

  /**
   * Additional test: Switch tools via toolbar button click
   */
  test('should switch to Rectangle tool when clicking toolbar button', async ({
    page
  }) => {
    // Ensure we start with Select tool
    await page.keyboard.press('V')
    await page.waitForTimeout(100)

    // Click the Rectangle tool button in toolbar using test-id
    await page.getByTestId('tool-rectangle').click()
    await page.waitForTimeout(100)

    // Verify Rectangle tool is now active
    const newTool = await getActiveTool(page)
    expect(newTool).toBe('rectangle')
  })

  test('should switch to Select tool when clicking toolbar button', async ({
    page
  }) => {
    // First switch to Rectangle tool
    await page.keyboard.press('R')
    await page.waitForTimeout(100)

    // Click the Select tool button in toolbar using test-id
    await page.getByTestId('tool-select').click()
    await page.waitForTimeout(100)

    // Verify Select tool is now active
    const newTool = await getActiveTool(page)
    expect(newTool).toBe('select')
  })
})
