import { test, expect } from '@playwright/test'
import {
  createTestDocumentURL,
  waitForAppReady,
  getToolbar,
  getContentsPanel,
  getPropertiesPanel
} from './test-utils'
import { CRDT_7076_DEMO_RESET_STORAGE_KEY } from '../src/config/demo-document'

/**
 * E2E Tests for basic application loading and layout
 */

test.describe('Asyra Design Tool', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(createTestDocumentURL())
  })

  test('should load the application', async ({ page }) => {
    // Wait for load state
    await page.waitForLoadState('domcontentloaded')

    // Check that the page title is correct
    await expect(page).toHaveTitle(/Asyra/)

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
    const toolButtons = toolbar.locator('[data-testid^="tool-"]')
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

  test('should omit the demo-only Reset button for ordinary documents', async ({
    page
  }) => {
    await waitForAppReady(page)

    const toolbar = getToolbar(page)
    const resetButton = toolbar.getByTestId('reset-button')
    await expect(resetButton).toHaveCount(0)
  })

  test('should save an empty 7076 demo document before forcing reload', async ({
    page
  }) => {
    const emptyDocument = {
      version: '1.0.0',
      sceneTree: {
        workspace: '',
        workspaceList: [],
        elements: {}
      },
      props: {}
    }
    let sampleRequestCount = 0
    await page.route('**/samples/crdt-7076/document.json.gz', async (route) => {
      sampleRequestCount += 1
      await route.fulfill({
        body: JSON.stringify(emptyDocument),
        contentType: 'application/json',
        status: 200
      })
    })
    await page.goto('/?fileId=crdt-7076-sample')
    await waitForAppReady(page)
    expect(sampleRequestCount).toBe(1)

    await Promise.all([
      page.waitForEvent(
        'framenavigated',
        (frame) => frame === page.mainFrame()
      ),
      page.getByTestId('reset-button').click()
    ])
    await waitForAppReady(page)

    expect(sampleRequestCount).toBe(1)
    await expect
      .poll(() =>
        page.evaluate(
          (storageKey) => localStorage.getItem(storageKey),
          CRDT_7076_DEMO_RESET_STORAGE_KEY
        )
      )
      .toBe(JSON.stringify(emptyDocument))
  })

  test('should have Zoom display in toolbar', async ({ page }) => {
    await waitForAppReady(page)

    // Zoom label should be visible
    const toolbar = getToolbar(page)
    const zoomDisplay = toolbar.getByTestId('zoom-level')
    await expect(zoomDisplay).toBeVisible()
  })
})
