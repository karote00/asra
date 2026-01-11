import { test, expect } from '@playwright/test'
import {
  waitForAppReady,
  getToolbar,
  getContentsPanel,
  getPropertiesPanel
} from './test-utils'

/**
 * E2E Tests for basic application loading and layout
 */

test.describe('Asra Design Tool', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should load the application', async ({ page }) => {
    // Wait for load state
    await page.waitForLoadState('domcontentloaded')

    // Check that the page title is correct
    await expect(page).toHaveTitle(/Asra/)

    // Check that the root element is present
    const rootElement = page.locator('#root')
    await expect(rootElement).toBeAttached()
  })

  test('should render the main app layout', async ({ page }) => {
    await waitForAppReady(page)

    // Check that the canvas container is present (RenderApp component)
    const canvas = page.locator('canvas')
    await expect(canvas.first()).toBeVisible()
  })

  test('should render toolbar with controls', async ({ page }) => {
    await waitForAppReady(page)

    // Toolbar should be visible (header area)
    const toolbar = getToolbar(page)
    await expect(toolbar).toBeVisible()

    // Tool buttons should be present
    const toolButtons = toolbar.locator('.flex.align-middle')
    const buttonCount = await toolButtons.count()
    expect(buttonCount).toBeGreaterThan(0)
  })

  test('should have viewport anchor element', async ({ page }) => {
    await waitForAppReady(page)

    // Check for viewport anchor element
    const viewportAnchor = page.locator('#viewport-anchor')
    await expect(viewportAnchor).toBeAttached()
  })

  test('should render Contents Panel (left sidebar)', async ({ page }) => {
    await waitForAppReady(page)

    // Contents Panel should be visible
    const contentsPanel = getContentsPanel(page)
    await expect(contentsPanel).toBeVisible()
  })

  test('should render Properties Panel (right sidebar)', async ({ page }) => {
    await waitForAppReady(page)

    // Properties Panel should be visible
    const propertiesPanel = getPropertiesPanel(page)
    await expect(propertiesPanel).toBeVisible()
  })

  test('should have Reset button in toolbar', async ({ page }) => {
    await waitForAppReady(page)

    // Reset button should be visible
    const resetButton = page.locator('text=Reset')
    await expect(resetButton).toBeVisible()
  })

  test('should have Zoom display in toolbar', async ({ page }) => {
    await waitForAppReady(page)

    // Zoom label should be visible
    const toolbar = getToolbar(page)
    const zoomLabel = toolbar.locator('text=Zoom')
    await expect(zoomLabel).toBeVisible()
  })
})
