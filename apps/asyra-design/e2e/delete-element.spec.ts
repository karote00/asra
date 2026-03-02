import { expect, test } from '@playwright/test'
import {
  clickCanvas,
  createRectangle,
  createVectorPath,
  getCanvasPosition,
  getElementCount,
  hasSelectedElement,
  redo,
  resetCanvas,
  undo,
  waitForAppReady
} from './test-utils'

test.describe('Delete Selected Element', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await resetCanvas(page)
  })

  test('Delete key removes the single selected element', async ({ page }) => {
    const initialCount = await getElementCount(page)
    await createRectangle(page, 0.3, 0.3)
    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 1)
    expect(await hasSelectedElement(page)).toBe(true)

    await page.keyboard.press('Delete')

    await expect.poll(async () => getElementCount(page)).toBe(initialCount)
    await expect
      .poll(async () => {
        return page.evaluate(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const core = (window as any).__Core__
          const ids = core?.deps?.selection?.getElementSelectionIds?.() ?? []
          return ids.length
        })
      })
      .toBe(0)
  })

  test('Backspace key removes the single selected element', async ({ page }) => {
    const initialCount = await getElementCount(page)
    await createRectangle(page, 0.4, 0.4)
    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 1)

    await page.keyboard.press('Backspace')

    await expect.poll(async () => getElementCount(page)).toBe(initialCount)
  })

  test('Delete key is a no-op when nothing is selected', async ({ page }) => {
    await createRectangle(page, 0.35, 0.35)
    const countAfterCreate = await getElementCount(page)

    await clickCanvas(page, 0.85, 0.85)
    expect(await hasSelectedElement(page)).toBe(false)

    await page.keyboard.press('Delete')
    await expect.poll(async () => getElementCount(page)).toBe(countAfterCreate)
  })

  test('delete action supports undo and redo', async ({ page }) => {
    const initialCount = await getElementCount(page)
    await createRectangle(page, 0.5, 0.45)
    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 1)

    await page.keyboard.press('Delete')
    await expect.poll(async () => getElementCount(page)).toBe(initialCount)
    expect(await hasSelectedElement(page)).toBe(false)

    await undo(page)
    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 1)
    expect(await hasSelectedElement(page)).toBe(true)

    await redo(page)
    await expect.poll(async () => getElementCount(page)).toBe(initialCount)
    expect(await hasSelectedElement(page)).toBe(false)
  })

  test('redo delete after sequential deletions does not throw selection-layer error', async ({
    page
  }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (error) => {
      pageErrors.push(String(error))
    })

    const initialCount = await getElementCount(page)

    await page.keyboard.press('r')
    await clickCanvas(page, 0.3, 0.3)
    await page.keyboard.press('o')
    await clickCanvas(page, 0.55, 0.5)
    await page.keyboard.press('v')

    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 2)

    await clickCanvas(page, 0.3, 0.3)
    await page.keyboard.press('Delete')
    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 1)

    await clickCanvas(page, 0.55, 0.5)
    await page.keyboard.press('Delete')
    await expect.poll(async () => getElementCount(page)).toBe(initialCount)

    await undo(page)
    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 1)

    await redo(page)
    await expect.poll(async () => getElementCount(page)).toBe(initialCount)
    expect(
      pageErrors.find((error) =>
        error.includes("Cannot read properties of undefined (reading 'getBounds')")
      )
    ).toBeUndefined()
  })

  test('delete re-evaluates hovered target instead of blindly clearing it', async ({
    page
  }) => {
    const initialCount = await getElementCount(page)

    await page.keyboard.press('r')
    await clickCanvas(page, 0.42, 0.42)
    await page.keyboard.press('r')
    await clickCanvas(page, 0.42, 0.42)
    await page.keyboard.press('v')
    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 2)

    const overlappingPos = await getCanvasPosition(page, 0.42, 0.42)
    const runtime = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      const selectedId =
        core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null

      return {
        selectedId
      }
    })

    expect(runtime.selectedId).not.toBeNull()
    if (!runtime.selectedId) {
      return
    }

    await page.evaluate(
      ({ deletedId, x, y }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const core = (window as any).__Core__
        core?.deps?.systemContext?.updateMouseState?.({
          position: { x, y },
          delta: { x: 0, y: 0 },
          button: 'none',
          down: false,
          dragging: false
        })
        core?.setSystemProperty?.('hoveredElementId', deletedId)
      },
      {
        deletedId: runtime.selectedId,
        x: overlappingPos.x + 10,
        y: overlappingPos.y + 10
      }
    )

    await page.keyboard.press('Delete')
    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 1)

    await expect
      .poll(async () => {
        return page.evaluate((deletedId) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const core = (window as any).__Core__
          const hoveredId = core?.getSystemProperty?.('hoveredElementId') ?? null
          return hoveredId !== deletedId
        }, runtime.selectedId)
      })
      .toBe(true)
  })

  test('Delete is blocked in path-editing mode', async ({ page }) => {
    const initialCount = await getElementCount(page)
    await createVectorPath(page, 0.3, 0.3, 0.2, 0.15)
    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 1)

    await clickCanvas(page, 0.35, 0.35)
    await page.keyboard.press('Enter')

    await expect
      .poll(async () => {
        return page.evaluate(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const core = (window as any).__Core__
          return core?.getSystemProperty?.('pathEditingVectorId') ?? null
        })
      })
      .not.toBeNull()

    const pathEditingVectorId = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      return core?.getSystemProperty?.('pathEditingVectorId') ?? null
    })

    await page.keyboard.press('Delete')

    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 1)
    await expect
      .poll(async () => {
        return page.evaluate(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const core = (window as any).__Core__
          return core?.getSystemProperty?.('pathEditingVectorId') ?? null
        })
      })
      .toBe(pathEditingVectorId)
  })
})
