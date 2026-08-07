import { test, expect } from '@playwright/test'
import {
  createRectangle,
  createTestDocumentURL,
  getCurrentDocumentFileId,
  getElementCount,
  waitForAppReady,
  getToolbar,
  getContentsPanel,
  getPropertiesPanel
} from './test-utils'

/**
 * E2E Tests for basic application loading and layout
 */

const runsStorageFreeReset = process.env.E2E_STORAGE_FREE_RESET === 'true'

test.describe('Asyra Design Tool', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(createTestDocumentURL())
  })

  test('should load the application', async ({ page }) => {
    // Wait for load state
    await page.waitForLoadState('domcontentloaded')

    // Check that the page title is correct
    await expect(page).toHaveTitle(/Asyra Design/)

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

  test('should permanently expose Reset for ordinary documents', async ({
    page
  }, testInfo) => {
    await waitForAppReady(page)

    const toolbar = getToolbar(page)
    const resetButton = toolbar.getByTestId('reset-button')
    const selectButton = toolbar.getByTestId('tool-select')
    await expect(resetButton).toBeVisible()
    await expect(resetButton).toHaveAttribute('aria-label', 'Reset document')
    await expect(selectButton).toBeVisible()
    expect(
      await toolbar.evaluate((toolbarElement) => {
        const controlIds = Array.from(
          toolbarElement.querySelectorAll('[data-testid]')
        ).map((element) => element.getAttribute('data-testid'))
        const resetIndex = controlIds.indexOf('reset-button')
        const selectIndex = controlIds.indexOf('tool-select')
        return resetIndex >= 0 && selectIndex > resetIndex
      })
    ).toBe(true)

    await createRectangle(page)
    await expect.poll(() => getElementCount(page)).toBe(1)

    const fileId = getCurrentDocumentFileId(page)
    await expect
      .poll(
        () =>
          page.evaluate(async (requestedFileId) => {
            const response = await fetch(
              `/api/documents/${encodeURIComponent(
                requestedFileId
              )}/bootstrap-checkpoint`,
              { headers: { accept: 'application/json' } }
            )
            if (!response.ok) return null
            const payload = (await response.json()) as {
              checkpoint?: {
                sceneTree?: { elements?: Record<string, unknown> }
              }
              durableSequence?: number
            }
            return (
              typeof payload.durableSequence === 'number' &&
              payload.durableSequence > 0 &&
              Object.keys(payload.checkpoint?.sceneTree?.elements ?? {})
                .length === 2
            )
          }, fileId),
        { timeout: 15_000 }
      )
      .toBe(true)

    const resetResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'DELETE' &&
        new URL(response.url()).pathname ===
          `/api/documents/${encodeURIComponent(fileId)}`
    )
    const reload = page.waitForNavigation({ waitUntil: 'domcontentloaded' })
    await resetButton.click()
    expect((await resetResponse).status()).toBe(200)
    await reload
    await waitForAppReady(page)

    await expect.poll(() => getElementCount(page)).toBe(0)
    await expect
      .poll(() =>
        page.evaluate(async (requestedFileId) => {
          const response = await fetch(
            `/api/documents/${encodeURIComponent(
              requestedFileId
            )}/bootstrap-checkpoint`,
            { headers: { accept: 'application/json' } }
          )
          const payload = (await response.json()) as {
            checkpoint?: {
              sceneTree?: { elements?: Record<string, unknown> }
            }
            durableSequence?: number
          }
          return {
            durableSequence: payload.durableSequence,
            elementCount: Object.keys(
              payload.checkpoint?.sceneTree?.elements ?? {}
            ).length
          }
        }, fileId)
      )
      .toEqual({ durableSequence: 0, elementCount: 1 })

    await page.screenshot({
      fullPage: true,
      path: testInfo.outputPath('reset-empty-app.png')
    })
  })

  test('should refresh a storage-free demo to the empty App', async ({
    page
  }, testInfo) => {
    test.skip(
      !runsStorageFreeReset,
      'requires the storage-free demo App configuration'
    )
    await waitForAppReady(page)
    await createRectangle(page)
    await expect.poll(() => getElementCount(page)).toBe(1)

    const fileId = getCurrentDocumentFileId(page)
    const resetResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'DELETE' &&
        new URL(response.url()).pathname ===
          `/api/documents/${encodeURIComponent(fileId)}`
    )
    const reload = page.waitForNavigation({ waitUntil: 'domcontentloaded' })
    await page.getByTestId('reset-button').click()
    expect((await resetResponse).status()).toBe(404)
    await reload
    await waitForAppReady(page)

    await expect.poll(() => getElementCount(page)).toBe(0)
    await page.screenshot({
      fullPage: true,
      path: testInfo.outputPath('reset-storage-free-empty-app.png')
    })
  })

  test('should have Zoom display in toolbar', async ({ page }) => {
    await waitForAppReady(page)

    // Zoom label should be visible
    const toolbar = getToolbar(page)
    const zoomDisplay = toolbar.getByTestId('zoom-level')
    await expect(zoomDisplay).toBeVisible()
  })
})
