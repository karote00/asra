import { test, expect } from '@playwright/test'
import {
  waitForAppReady,
  resetCanvas,
  getElementCount,
  createRectangle,
  clickCanvas,
  getActiveTool,
  getCanvasPosition
} from './test-utils'

test.describe('Pen Tool - Editing Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await resetCanvas(page)
  })

  test('switches to pen tool with keyboard shortcut', async ({ page }) => {
    await page.keyboard.press('p')
    await expect.poll(() => getActiveTool(page)).toBe('pen')
  })

  test('creates a new vector on empty canvas click', async ({ page }) => {
    const initialCount = await getElementCount(page)

    await page.keyboard.press('p')
    await expect.poll(() => getActiveTool(page)).toBe('pen')
    await clickCanvas(page, 0.3, 0.3)

    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 1)
  })

  test('keeps editing the newly created vector until Escape', async ({
    page
  }) => {
    const initialCount = await getElementCount(page)

    await page.keyboard.press('p')
    await expect.poll(() => getActiveTool(page)).toBe('pen')
    await clickCanvas(page, 0.3, 0.3)
    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 1)

    await clickCanvas(page, 0.45, 0.4)
    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 1)
  })

  test('creates a new vector when selected element is not vector', async ({
    page
  }) => {
    const initialCount = await getElementCount(page)
    await createRectangle(page, 0.2, 0.2)
    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 1)

    await page.keyboard.press('p')
    await expect.poll(() => getActiveTool(page)).toBe('pen')
    await clickCanvas(page, 0.65, 0.35)
    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 2)
  })

  test('enter enables path editing mode for one selected vector', async ({
    page
  }) => {
    const initialCount = await getElementCount(page)

    await page.keyboard.press('p')
    await clickCanvas(page, 0.3, 0.3)
    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 1)

    await page.keyboard.press('Enter')
    await clickCanvas(page, 0.45, 0.4)
    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 1)
  })

  test('double click on vector enables path editing mode', async ({ page }) => {
    const initialCount = await getElementCount(page)

    await page.keyboard.press('p')
    await expect.poll(() => getActiveTool(page)).toBe('pen')
    await clickCanvas(page, 0.3, 0.3)
    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 1)

    await page.keyboard.press('v')
    await expect.poll(() => getActiveTool(page)).toBe('select')

    const pos = await getCanvasPosition(page, 0.3, 0.3)
    await page.mouse.dblclick(pos.x, pos.y, { delay: 100 })
    await page.waitForTimeout(150)

    await expect
      .poll(async () => {
        return page.evaluate(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const core = (window as any).__Core__
          return core?.getSystemProperty?.('pathEditingVectorId') ?? null
        })
      })
      .not.toBeNull()

    await page.keyboard.press('p')
    await expect.poll(() => getActiveTool(page)).toBe('pen')
    await clickCanvas(page, 0.45, 0.4)

    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 1)
  })

  test('escape cancels pen editing so next click starts a new vector', async ({
    page
  }) => {
    const initialCount = await getElementCount(page)

    await page.keyboard.press('p')
    await expect.poll(() => getActiveTool(page)).toBe('pen')

    await clickCanvas(page, 0.3, 0.3)
    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 1)

    await clickCanvas(page, 0.45, 0.4)
    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 1)

    await page.keyboard.press('Escape')
    await page.waitForTimeout(150)

    await clickCanvas(page, 0.55, 0.45)
    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 2)
  })
})
