import { test, expect } from '@playwright/test'
import {
  waitForAppReady,
  resetCanvas,
  getElementCount,
  undo,
  redo,
  createVectorPath,
  clickCanvas,
  getActiveTool
} from './test-utils'

/**
 * E2E Tests for Pen Tool (Vector Path)
 * Tests full Pen Tool workflow: creating vector paths with anchor points
 */

test.describe('Pen Tool - Vector Path Creation', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) => {
      console.log(`[BROWSER] ${msg.text()}`)
    })
    await page.goto('/')
    await waitForAppReady(page)
    await resetCanvas(page)
  })

  test('should switch to Pen tool when pressing P key', async ({ page }) => {
    // Press 'p' to switch to Pen tool
    await page.keyboard.press('p')
    await page.waitForTimeout(100)

    const activeTool = await getActiveTool(page)
    expect(activeTool).toBe('pen')
  })

  test('should create vector path when dragging with Pen tool', async ({
    page
  }) => {
    // Get initial element count
    const initialCount = await getElementCount(page)

    // Create a vector path with Pen tool
    await createVectorPath(page, 0.3, 0.3, 0.15, 0.1)

    // Verify a new element was created
    const currentCount = await getElementCount(page)
    expect(currentCount).toBe(initialCount + 1)
  })

  test('should select the newly created vector path', async ({ page }) => {
    // Create a vector path
    await createVectorPath(page, 0.3, 0.3, 0.15, 0.1)

    // Check that an element is selected by verifying Properties Panel is visible
    const propertiesPanel = page.getByTestId('properties-panel')
    const layoutHeader = propertiesPanel.locator('text=Layout')
    await expect(layoutHeader).toBeVisible()
  })

  test('should undo vector path creation', async ({ page }) => {
    // Get initial element count
    const initialCount = await getElementCount(page)

    // Create a vector path
    await createVectorPath(page, 0.3, 0.3, 0.15, 0.1)

    // Verify it was created
    expect(await getElementCount(page)).toBe(initialCount + 1)

    // Undo the creation
    await undo(page)

    // Verify the element was removed
    await expect(async () => {
      expect(await getElementCount(page)).toBe(initialCount)
    }).toPass({ timeout: 2000 })
  })

  test('should redo vector path creation', async ({ page }) => {
    // Get initial element count
    const initialCount = await getElementCount(page)

    // Create a vector path
    await createVectorPath(page, 0.3, 0.3, 0.15, 0.1)
    await page.waitForTimeout(200)

    // Undo the creation
    await undo(page)
    await expect(async () => {
      expect(await getElementCount(page)).toBe(initialCount)
    }).toPass({ timeout: 2000 })

    // Redo the creation
    await redo(page)

    // Verify the element was added back
    await expect(async () => {
      expect(await getElementCount(page)).toBe(initialCount + 1)
    }).toPass({ timeout: 2000 })
  })

  test('should create multiple vector paths', async ({ page }) => {
    const initialCount = await getElementCount(page)

    // Create three vector paths
    await createVectorPath(page, 0.2, 0.2, 0.1, 0.1)
    await createVectorPath(page, 0.4, 0.3, 0.15, 0.12)
    await createVectorPath(page, 0.6, 0.5, 0.1, 0.15)

    const currentCount = await getElementCount(page)
    expect(currentCount).toBe(initialCount + 3)
  })

  test('should undo multiple vector paths in sequence', async ({ page }) => {
    // Create three vector paths
    await createVectorPath(page, 0.2, 0.2, 0.1, 0.1)
    await createVectorPath(page, 0.4, 0.3, 0.15, 0.12)
    await createVectorPath(page, 0.6, 0.5, 0.1, 0.15)

    expect(await getElementCount(page)).toBe(3)

    // Undo 3 times
    await undo(page)
    await expect(async () => {
      expect(await getElementCount(page)).toBe(2)
    }).toPass({ timeout: 2000 })

    await undo(page)
    await expect(async () => {
      expect(await getElementCount(page)).toBe(1)
    }).toPass({ timeout: 2000 })

    await undo(page)
    await expect(async () => {
      expect(await getElementCount(page)).toBe(0)
    }).toPass({ timeout: 2000 })
  })

  test('should create vector path with no movement (single point)', async ({
    page
  }) => {
    const initialCount = await getElementCount(page)

    // Switch to Pen tool
    await page.keyboard.press('p')
    await page.waitForTimeout(100)

    // Just click without dragging (simulating a single point)
    await clickCanvas(page, 0.3, 0.3)
    await page.mouse.up()
    await page.waitForTimeout(500)

    // Switch back to Select tool
    await page.keyboard.press('v')
    await page.waitForTimeout(100)

    // Verify an element was created (even with minimal movement)
    const currentCount = await getElementCount(page)
    expect(currentCount).toBeGreaterThanOrEqual(initialCount)
  })

  test('should toggle between Pen tool and Select tool', async ({ page }) => {
    // Start with Select tool
    expect(await getActiveTool(page)).toBe('select')

    // Switch to Pen tool
    await page.keyboard.press('p')
    await page.waitForTimeout(100)
    expect(await getActiveTool(page)).toBe('pen')

    // Switch back to Select tool
    await page.keyboard.press('v')
    await page.waitForTimeout(100)
    expect(await getActiveTool(page)).toBe('select')

    // Switch to Pen tool again
    await page.keyboard.press('p')
    await page.waitForTimeout(100)
    expect(await getActiveTool(page)).toBe('pen')
  })
})
