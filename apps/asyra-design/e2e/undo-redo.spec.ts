import { test, expect } from '@playwright/test'
import {
  waitForAppReady,
  resetCanvas,
  clickCanvas,
  createRectangle,
  getElementCount,
  dragOnCanvas,
  dragSelectedElementBy,
  getSelectedElementRect,
  undo,
  redo
} from './test-utils'

/**
 * E2E Tests for Undo/Redo
 * Based on: .project/golden-paths/undoing-an-action.md
 */

test.describe('Undo/Redo Actions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
    await resetCanvas(page)
  })

  test('should undo element creation', async ({ page }) => {
    // Get initial element count
    const initialCount = await getElementCount(page)

    // Create a rectangle
    await createRectangle(page, 0.3, 0.3)

    // Verify a new element was created
    const currentCount = await getElementCount(page)
    expect(currentCount).toBe(initialCount + 1)

    // Undo the creation
    await undo(page)

    // Verify the element was removed with retries
    await expect(async () => {
      const count = await getElementCount(page)
      expect(count).toBe(initialCount)
    }).toPass({ timeout: 2000 })
  })

  test('should redo element creation', async ({ page }) => {
    // Get initial element count
    const initialCount = await getElementCount(page)

    // Create a rectangle
    await createRectangle(page, 0.3, 0.3)
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

  test('should undo multiple actions in sequence', async ({ page }) => {
    // Create three rectangles
    await createRectangle(page, 0.2, 0.2)
    await createRectangle(page, 0.4, 0.4)
    await createRectangle(page, 0.6, 0.6)

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

    // Redo 2 times
    await redo(page)
    await expect(async () => {
      expect(await getElementCount(page)).toBe(1)
    }).toPass({ timeout: 2000 })

    await redo(page)
    await expect(async () => {
      expect(await getElementCount(page)).toBe(2)
    }).toPass({ timeout: 2000 })
  })

  test('should undo and redo a drag-move element position update', async ({
    page
  }) => {
    await createRectangle(page, 0.35, 0.35)

    const before = await getSelectedElementRect(page)
    expect(before).not.toBeNull()
    if (!before) {
      return
    }

    await dragSelectedElementBy(page, 120, 70, 20)

    const moved = await getSelectedElementRect(page)
    expect(moved).not.toBeNull()
    if (!moved) {
      return
    }

    expect(moved.id).toBe(before.id)
    expect(moved.x).toBeGreaterThan(before.x)
    expect(moved.y).toBeGreaterThan(before.y)

    await undo(page)

    await expect
      .poll(async () => {
        const rect = await getSelectedElementRect(page)
        if (!rect) {
          return null
        }

        return {
          x: Math.round(rect.x),
          y: Math.round(rect.y)
        }
      })
      .toEqual({
        x: Math.round(before.x),
        y: Math.round(before.y)
      })

    await redo(page)

    await expect
      .poll(async () => {
        const rect = await getSelectedElementRect(page)
        if (!rect) {
          return null
        }

        return {
          x: Math.round(rect.x),
          y: Math.round(rect.y)
        }
      })
      .toEqual({
        x: Math.round(moved.x),
        y: Math.round(moved.y)
      })
  })

  test('drag-create uses a compact undo commit without move spam', async ({
    page
  }) => {
    await page.keyboard.press('r')
    await page.waitForTimeout(100)

    const beforeSummary = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      const stack = core?.deps?.factory?.transact?.undoStack ?? []
      return { count: stack.length }
    })

    await dragOnCanvas(page, 0.2, 0.2, 0.55, 0.42, 40)
    await expect(async () => {
      expect(await getElementCount(page)).toBe(1)
    }).toPass({ timeout: 2000 })

    const commitSummary = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      const stack = core?.deps?.factory?.transact?.undoStack ?? []
      const last = stack[stack.length - 1] ?? []
      const updateComputedDataEvents = last.filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (event: any) => event?.type === 'updateComputedData'
      )
      const noOpSelectionEvents = last.filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (event: any) =>
          event?.type === 'selectElements' &&
          Array.isArray(event?.payload?.before) &&
          Array.isArray(event?.payload?.after) &&
          event.payload.before.length === 0 &&
          event.payload.after.length === 0
      )

      return {
        stackCount: stack.length,
        changeCount: last.length,
        updateComputedDataCount: updateComputedDataEvents.length,
        noOpSelectionCount: noOpSelectionEvents.length
      }
    })

    expect(commitSummary.stackCount).toBe(beforeSummary.count + 1)
    expect(commitSummary.noOpSelectionCount).toBe(0)
    expect(commitSummary.updateComputedDataCount).toBeLessThanOrEqual(8)
    expect(commitSummary.changeCount).toBeLessThanOrEqual(12)
  })

  test('undo drag on unselected target restores both moved position and previous selection', async ({
    page
  }) => {
    await createRectangle(page, 0.22, 0.28) // A (selected)
    const aBefore = await getSelectedElementRect(page)
    expect(aBefore).not.toBeNull()
    if (!aBefore) {
      return
    }

    await createRectangle(page, 0.52, 0.46) // B (selected)
    const bBefore = await getSelectedElementRect(page)
    expect(bBefore).not.toBeNull()
    if (!bBefore) {
      return
    }

    await createRectangle(page, 0.72, 0.62) // C (selected)
    const cBefore = await getSelectedElementRect(page)
    expect(cBefore).not.toBeNull()
    if (!cBefore) {
      return
    }

    // Start from "all not selected" state.
    await clickCanvas(page, 0.95, 0.95)
    await page.waitForTimeout(120)
    expect(await getSelectedElementRect(page)).toBeNull()

    // Drag A from unselected state -> should select A and move.
    const aCenter = await page.evaluate(({ x, y, width, height }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      const zoom = core?.getSystemProperty?.('zoom') ?? 1
      const viewport = core?.getSystemProperty?.('viewportPosition') ?? {
        x: 0,
        y: 0
      }
      return {
        x: (x + width / 2) * zoom + viewport.x,
        y: (y + height / 2) * zoom + viewport.y
      }
    }, aBefore)
    await page.mouse.move(aCenter.x, aCenter.y)
    await page.mouse.down()
    await page.mouse.move(aCenter.x + 80, aCenter.y + 50, { steps: 16 })
    await page.mouse.up()
    await page.waitForTimeout(150)

    const aMoved = await getSelectedElementRect(page)
    expect(aMoved).not.toBeNull()
    if (!aMoved) {
      return
    }
    expect(aMoved.id).toBe(aBefore.id)
    expect(aMoved.x).toBeGreaterThan(aBefore.x)
    expect(aMoved.y).toBeGreaterThan(aBefore.y)

    // Drag B while B is unselected -> should switch selection to B and move B.
    const bCenter = await page.evaluate(({ x, y, width, height }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      const zoom = core?.getSystemProperty?.('zoom') ?? 1
      const viewport = core?.getSystemProperty?.('viewportPosition') ?? {
        x: 0,
        y: 0
      }
      return {
        x: (x + width / 2) * zoom + viewport.x,
        y: (y + height / 2) * zoom + viewport.y
      }
    }, bBefore)
    await page.mouse.move(bCenter.x, bCenter.y)
    await page.mouse.down()
    await page.mouse.move(bCenter.x + 95, bCenter.y + 60, { steps: 20 })
    await page.mouse.up()
    await page.waitForTimeout(150)

    const bMoved = await getSelectedElementRect(page)
    expect(bMoved).not.toBeNull()
    if (!bMoved) {
      return
    }
    expect(bMoved.id).toBe(bBefore.id)
    expect(bMoved.x).toBeGreaterThan(bBefore.x)
    expect(bMoved.y).toBeGreaterThan(bBefore.y)

    await undo(page)

    // Selection should roll back to A.
    await expect
      .poll(async () => {
        const selected = await getSelectedElementRect(page)
        return selected?.id ?? null
      })
      .toBe(aBefore.id)

    const selectedAfterUndo = await getSelectedElementRect(page)
    expect(selectedAfterUndo).not.toBeNull()
    if (!selectedAfterUndo) {
      return
    }
    expect(Math.round(selectedAfterUndo.x)).toBe(Math.round(aMoved.x))
    expect(Math.round(selectedAfterUndo.y)).toBe(Math.round(aMoved.y))

    // B position should also roll back.
    const bPositionAfterUndo = await page.evaluate((elementId) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      const element = core?.deps?.sceneTree?.getElementById?.(elementId)
      const computed = element?.getAllComputedData?.() ?? {}
      const x = typeof computed.x === 'number' ? computed.x : null
      const y = typeof computed.y === 'number' ? computed.y : null
      if (x === null || y === null) {
        return null
      }
      return { x: Math.round(x), y: Math.round(y) }
    }, bBefore.id)

    expect(bPositionAfterUndo).toEqual({
      x: Math.round(bBefore.x),
      y: Math.round(bBefore.y)
    })

    // Keep C referenced to ensure scenario setup is not optimized away.
    const cCheck = await page.evaluate((elementId) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      return core?.deps?.sceneTree?.getElementById?.(elementId) ? true : false
    }, cBefore.id)
    expect(cCheck).toBe(true)
  })

  test('undo after drag A->B->C restores C position and selects B', async ({
    page
  }) => {
    await createRectangle(page, 0.2, 0.25) // A
    const aBefore = await getSelectedElementRect(page)
    expect(aBefore).not.toBeNull()
    if (!aBefore) {
      return
    }

    await createRectangle(page, 0.5, 0.45) // B
    const bBefore = await getSelectedElementRect(page)
    expect(bBefore).not.toBeNull()
    if (!bBefore) {
      return
    }

    await createRectangle(page, 0.72, 0.62) // C
    const cBefore = await getSelectedElementRect(page)
    expect(cBefore).not.toBeNull()
    if (!cBefore) {
      return
    }

    await clickCanvas(page, 0.95, 0.95)
    await page.waitForTimeout(120)

    const toClientCenter = async (rect: {
      x: number
      y: number
      width: number
      height: number
    }) =>
      page.evaluate(({ x, y, width, height }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const core = (window as any).__Core__
        const zoom = core?.getSystemProperty?.('zoom') ?? 1
        const viewport = core?.getSystemProperty?.('viewportPosition') ?? {
          x: 0,
          y: 0
        }
        return {
          x: (x + width / 2) * zoom + viewport.x,
          y: (y + height / 2) * zoom + viewport.y
        }
      }, rect)

    const dragRectBy = async (
      rect: { x: number; y: number; width: number; height: number },
      dx: number,
      dy: number
    ) => {
      const center = await toClientCenter(rect)
      await page.mouse.move(center.x, center.y)
      await page.mouse.down()
      await page.mouse.move(center.x + dx, center.y + dy, { steps: 20 })
      await page.mouse.up()
      await page.waitForTimeout(120)
    }

    await dragRectBy(aBefore, 80, 45)
    const aMoved = await getSelectedElementRect(page)
    expect(aMoved?.id).toBe(aBefore.id)

    await dragRectBy(bBefore, 95, 60)
    const bMoved = await getSelectedElementRect(page)
    expect(bMoved?.id).toBe(bBefore.id)
    if (!bMoved) {
      return
    }

    await dragRectBy(cBefore, 110, 70)
    const cMoved = await getSelectedElementRect(page)
    expect(cMoved?.id).toBe(cBefore.id)
    if (!cMoved) {
      return
    }

    await undo(page)

    await expect
      .poll(async () => {
        const selected = await getSelectedElementRect(page)
        return selected?.id ?? null
      })
      .toBe(bBefore.id)

    const cAfterUndo = await page.evaluate((elementId) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      const element = core?.deps?.sceneTree?.getElementById?.(elementId)
      const computed = element?.getAllComputedData?.() ?? {}
      const x = typeof computed.x === 'number' ? computed.x : null
      const y = typeof computed.y === 'number' ? computed.y : null
      if (x === null || y === null) {
        return null
      }
      return { x: Math.round(x), y: Math.round(y) }
    }, cBefore.id)

    expect(cAfterUndo).toEqual({
      x: Math.round(cBefore.x),
      y: Math.round(cBefore.y)
    })

    const bStillMovedAfterUndo = await page.evaluate((elementId) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      const element = core?.deps?.sceneTree?.getElementById?.(elementId)
      const computed = element?.getAllComputedData?.() ?? {}
      const x = typeof computed.x === 'number' ? computed.x : null
      const y = typeof computed.y === 'number' ? computed.y : null
      if (x === null || y === null) {
        return null
      }
      return { x: Math.round(x), y: Math.round(y) }
    }, bBefore.id)

    expect(bStillMovedAfterUndo).toEqual({
      x: Math.round(bMoved.x),
      y: Math.round(bMoved.y)
    })
  })
})
