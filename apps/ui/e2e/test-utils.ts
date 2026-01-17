import { Page } from '@playwright/test'

/**
 * Shared test utilities for E2E tests
 */

// Layout constants (matching the UI constants)
export const SIDEBAR_WIDTH = 240 // COLUMN_WIDTH * 4 = 60 * 4
export const HEADER_HEIGHT = 48 // h-12 = 12 * 4 = 48px

/**
 * Get a safe canvas position that won't be intercepted by overlays
 * @param page - The Playwright page
 * @param relativeX - Relative X position within the canvas area (0-1)
 * @param relativeY - Relative Y position within the canvas area (0-1)
 */
export async function getCanvasPosition(
  page: Page,
  relativeX = 0.5,
  relativeY = 0.5
): Promise<{ x: number; y: number }> {
  const viewportSize = page.viewportSize()
  if (!viewportSize) {
    throw new Error('Viewport size not available')
  }

  // Calculate safe canvas area (excluding sidebars and header)
  const canvasLeft = SIDEBAR_WIDTH
  const canvasTop = HEADER_HEIGHT
  const canvasWidth = viewportSize.width - SIDEBAR_WIDTH * 2
  const canvasHeight = viewportSize.height - HEADER_HEIGHT - 100 // footer buffer

  return {
    x: canvasLeft + canvasWidth * relativeX,
    y: canvasTop + canvasHeight * relativeY
  }
}

/**
 * Click on the canvas at a safe position
 */
export async function clickCanvas(
  page: Page,
  relativeX = 0.5,
  relativeY = 0.5
) {
  const pos = await getCanvasPosition(page, relativeX, relativeY)
  await page.mouse.click(pos.x, pos.y)
}

/**
 * Perform a drag operation on the canvas
 */
export async function dragOnCanvas(
  page: Page,
  startRelX: number,
  startRelY: number,
  endRelX: number,
  endRelY: number,
  steps = 10
) {
  const startPos = await getCanvasPosition(page, startRelX, startRelY)
  const endPos = await getCanvasPosition(page, endRelX, endRelY)

  await page.mouse.move(startPos.x, startPos.y)
  await page.mouse.down()
  await page.mouse.move(endPos.x, endPos.y, { steps })
  await page.mouse.up()
}

/**
 * Wait for the app to be fully initialized
 */
export async function waitForAppReady(page: Page) {
  await page.waitForLoadState('networkidle')
  await page.waitForSelector('#viewport-anchor')
  await page.waitForSelector('[data-testid="toolbar"]')
  // Extra wait for canvas to be ready
  await page.waitForSelector('canvas')
  await page.waitForTimeout(500) // Allow rendering to complete
}

/**
 * Reset the canvas by clicking the Reset button
 */
export async function resetCanvas(page: Page) {
  const resetButton = page.getByTestId('reset-button')
  await resetButton.click()
  await page.waitForTimeout(500)
}

/**
 * Create a rectangle at the given relative canvas position
 */
export async function createRectangle(
  page: Page,
  relativeX = 0.3,
  relativeY = 0.3
) {
  // Switch to Rectangle tool
  await page.keyboard.press('r')
  await page.waitForTimeout(100)

  // Click to create rectangle
  await clickCanvas(page, relativeX, relativeY)
  await page.waitForTimeout(300)

  // Switch back to Select tool
  await page.keyboard.press('v')
  await page.waitForTimeout(100)
}

/**
 * Perform an Undo operation
 */
export async function undo(page: Page) {
  // Click on the toolbar area (neutral zone) to gain focus without triggering tools
  const toolbar = getToolbar(page)
  await toolbar.click({ position: { x: 5, y: 5 } })

  // Press the shortcut
  await page.keyboard.down('Meta')
  await page.keyboard.press('Z')
  await page.keyboard.up('Meta')
  await page.waitForTimeout(300)
}

/**
 * Perform a Redo operation
 */
export async function redo(page: Page) {
  // Click on the toolbar area (neutral zone) to gain focus without triggering tools
  const toolbar = getToolbar(page)
  await toolbar.click({ position: { x: 5, y: 5 } })

  // Press the shortcut
  await page.keyboard.down('Meta')
  await page.keyboard.press('Shift')
  await page.keyboard.press('Z')
  await page.keyboard.up('Meta')
  await page.waitForTimeout(300)
}

/**
 * Check if an element is selected by checking the Properties Panel
 */
export async function hasSelectedElement(page: Page): Promise<boolean> {
  const propertiesPanel = getPropertiesPanel(page)
  const layoutHeader = propertiesPanel.locator('text=Layout')
  return await layoutHeader.isVisible()
}

/**
 * Get the number of elements in the Contents Panel
 */
export async function getElementCount(page: Page): Promise<number> {
  const contentsPanel = getContentsPanel(page)
  const elements = contentsPanel.locator('[data-layer-element="true"]')
  return await elements.count()
}

/**
 * Get the Contents Panel locator
 */
export function getContentsPanel(page: Page) {
  return page.getByTestId('contents-panel')
}

/**
 * Get the Properties Panel locator
 */
export function getPropertiesPanel(page: Page) {
  return page.getByTestId('properties-panel')
}

/**
 * Get the Toolbar locator
 */
export function getToolbar(page: Page) {
  return page.getByTestId('toolbar')
}

/**
 * Get the current zoom level from the toolbar
 */
export async function getZoomLevel(page: Page): Promise<number> {
  const zoomDisplay = page.getByTestId('zoom-level')
  const valueStr = (await zoomDisplay.getAttribute('data-value')) ?? '1'
  return parseFloat(valueStr) * 100
}

/**
 * Get the active tool based on button styling
 */
export async function getActiveTool(
  page: Page
): Promise<'select' | 'rectangle' | 'unknown'> {
  const selectTool = page.getByTestId('tool-select')
  const rectangleTool = page.getByTestId('tool-rectangle')

  if ((await selectTool.getAttribute('data-active')) === 'true') {
    return 'select'
  }
  if ((await rectangleTool.getAttribute('data-active')) === 'true') {
    return 'rectangle'
  }

  return 'unknown'
}
