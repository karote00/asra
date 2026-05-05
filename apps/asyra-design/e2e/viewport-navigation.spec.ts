import { test, expect } from '@playwright/test'
import {
  waitForAppReady,
  getCanvasPosition,
  getZoomLevel,
  getToolbar
} from './test-utils'

/**
 * E2E Tests for Viewport Navigation
 * Based on: .project/bdd-features/viewport-navigation.feature
 */

test.describe('Viewport Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
  })

  test('should zoom in when scrolling mouse wheel up', async ({ page }) => {
    const pos = await getCanvasPosition(page, 0.5, 0.5)
    const initialZoom = await getZoomLevel(page)

    await page.mouse.move(pos.x, pos.y)

    // HOLD Meta (Command) key for zoom
    await page.keyboard.down('Meta')
    await page.mouse.wheel(0, -100)
    await page.keyboard.up('Meta')

    await expect(async () => {
      const newZoom = await getZoomLevel(page)
      expect(newZoom).toBeGreaterThan(initialZoom)
    }).toPass({ timeout: 2000 })
  })

  test('should zoom out when scrolling mouse wheel down', async ({ page }) => {
    const pos = await getCanvasPosition(page, 0.5, 0.5)
    const initialZoom = await getZoomLevel(page)

    await page.mouse.move(pos.x, pos.y)

    // HOLD Meta (Command) key for zoom
    await page.keyboard.down('Meta')
    await page.mouse.wheel(0, 100)
    await page.keyboard.up('Meta')

    await expect(async () => {
      const newZoom = await getZoomLevel(page)
      expect(newZoom).toBeLessThan(initialZoom)
    }).toPass({ timeout: 2000 })
  })

  test('should accumulate zoom level with multiple wheel events', async ({
    page
  }) => {
    const pos = await getCanvasPosition(page, 0.5, 0.5)
    const initialZoom = await getZoomLevel(page)

    await page.mouse.move(pos.x, pos.y)
    await page.keyboard.down('Meta')

    for (let i = 0; i < 3; i++) {
      await page.mouse.wheel(0, -50)
      await page.waitForTimeout(50)
    }

    await expect(async () => {
      const afterZoomIn = await getZoomLevel(page)
      expect(afterZoomIn).toBeGreaterThan(initialZoom)
    }).toPass({ timeout: 2000 })

    const afterZoomIn = await getZoomLevel(page)

    for (let i = 0; i < 6; i++) {
      await page.mouse.wheel(0, 50)
      await page.waitForTimeout(50)
    }
    await page.keyboard.up('Meta')

    await expect(async () => {
      const afterZoomOut = await getZoomLevel(page)
      expect(afterZoomOut).toBeLessThan(afterZoomIn)
    }).toPass({ timeout: 2000 })
  })

  test('should display zoom percentage in toolbar', async ({ page }) => {
    const toolbar = getToolbar(page)
    const zoomDisplay = toolbar.getByTestId('zoom-level')
    await expect(zoomDisplay).toBeVisible()
    await expect(zoomDisplay).toContainText(/%/)
  })

  test('should toggle raw stroke overlap debug mode from toolbar', async ({
    page
  }) => {
    const toolbar = getToolbar(page)
    const toggle = toolbar.getByTestId('stroke-debug-overlap-toggle')

    await expect(toggle).toBeVisible()
    await expect(toggle).toHaveAttribute('data-active', 'false')

    await toggle.click()
    await expect(toggle).toHaveAttribute('data-active', 'true')
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (window as any).__Core__?.getSystemProperty?.(
              'strokeDebugDisableVisualOverlapCollapse'
            ) ?? false
        )
      )
      .toBe(true)

    await toggle.click()
    await expect(toggle).toHaveAttribute('data-active', 'false')
  })

  test('should respect zoom limits', async ({ page }) => {
    const pos = await getCanvasPosition(page, 0.5, 0.5)
    await page.mouse.move(pos.x, pos.y)

    await page.keyboard.down('Meta')
    // Zoom out many times
    for (let i = 0; i < 15; i++) {
      await page.mouse.wheel(0, 500)
      await page.waitForTimeout(20)
    }

    const minZoom = await getZoomLevel(page)
    expect(minZoom).toBeGreaterThan(0)

    // Zoom in many times
    for (let i = 0; i < 30; i++) {
      await page.mouse.wheel(0, -500)
      await page.waitForTimeout(20)
    }
    await page.keyboard.up('Meta')

    const maxZoom = await getZoomLevel(page)
    expect(maxZoom).toBeGreaterThan(minZoom)
  })
})
