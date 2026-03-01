import { test, expect } from '@playwright/test'
import {
  waitForAppReady,
  resetCanvas,
  getElementCount,
  createRectangle,
  clickCanvas,
  dragOnCanvas,
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

  test('dragging while adding a connected point keeps new anchor selected', async ({
    page
  }) => {
    const initialCount = await getElementCount(page)

    await page.keyboard.press('p')
    await expect.poll(() => getActiveTool(page)).toBe('pen')
    await clickCanvas(page, 0.3, 0.3)
    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 1)

    await dragOnCanvas(page, 0.45, 0.4, 0.55, 0.32, 8)

    await expect
      .poll(async () => {
        return page.evaluate(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const core = (window as any).__Core__
          const selected = core?.getSystemProperty?.('selectedVectorPoint')
          if (!selected) {
            return null
          }

          return {
            selectedTarget: selected?.target ?? null,
            x: selected?.x ?? null,
            y: selected?.y ?? null
          }
        })
      })
      .toMatchObject({
        selectedTarget: 'anchor'
      })
  })

  test('second-point drag computes figma-style P1/P2 handles', async ({
    page
  }) => {
    const initialCount = await getElementCount(page)

    const firstClientPos = await getCanvasPosition(page, 0.3, 0.3)
    const secondClientPos = await getCanvasPosition(page, 0.45, 0.4)
    const dragClientPos = await getCanvasPosition(page, 0.55, 0.32)

    await page.keyboard.press('p')
    await expect.poll(() => getActiveTool(page)).toBe('pen')
    await page.mouse.click(firstClientPos.x, firstClientPos.y)
    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 1)

    const firstPointId = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      const selected = core?.getSystemProperty?.('selectedVectorPoint')
      return selected?.pointId ?? null
    })
    expect(firstPointId).not.toBeNull()
    if (!firstPointId) {
      return
    }

    await page.mouse.move(secondClientPos.x, secondClientPos.y)
    await page.mouse.down()
    await page.mouse.move(dragClientPos.x, dragClientPos.y, { steps: 12 })
    await page.mouse.up()

    const runtime = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      const selected = core?.getSystemProperty?.('selectedVectorPoint')
      const zoom = core?.getSystemProperty?.('zoom') ?? 1
      const viewport = core?.getSystemProperty?.('viewportPosition') ?? {
        x: 0,
        y: 0
      }

      return {
        zoom,
        viewport,
        secondPointId: selected?.pointId ?? null
      }
    })
    expect(runtime.secondPointId).not.toBeNull()
    if (!runtime.secondPointId) {
      return
    }

    const toWorkspace = (point: { x: number; y: number }) => ({
      x: (point.x - runtime.viewport.x) / runtime.zoom,
      y: (point.y - runtime.viewport.y) / runtime.zoom
    })

    const toClient = (point: { x: number; y: number }) => ({
      x: point.x * runtime.zoom + runtime.viewport.x,
      y: point.y * runtime.zoom + runtime.viewport.y
    })

    const A = toWorkspace(firstClientPos)
    const B = toWorkspace(secondClientPos)
    const M = toWorkspace(dragClientPos)
    const vx = M.x - B.x
    const vy = M.y - B.y

    const expectedP2 = {
      x: B.x - vx * 0.8,
      y: B.y - vy * 0.8
    }
    const expectedP1 = {
      x: A.x - vx * 0.334,
      y: A.y + (B.y - A.y) * 0.327
    }

    const expectedP1Client = toClient(expectedP1)
    const expectedP2Client = toClient(expectedP2)

    await page.mouse.move(expectedP1Client.x, expectedP1Client.y)
    await expect
      .poll(async () => {
        return page.evaluate(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const core = (window as any).__Core__
          const hovered = core?.getSystemProperty?.('hoveredVectorPoint')
          if (!hovered) {
            return null
          }
          return {
            pointId: hovered.pointId,
            target: hovered.target
          }
        })
      })
      .toMatchObject({
        pointId: firstPointId,
        target: 'outHandle'
      })

    await page.mouse.move(expectedP2Client.x, expectedP2Client.y)
    await expect
      .poll(async () => {
        return page.evaluate(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const core = (window as any).__Core__
          const hovered = core?.getSystemProperty?.('hoveredVectorPoint')
          if (!hovered) {
            return null
          }
          return {
            pointId: hovered.pointId,
            target: hovered.target
          }
        })
      })
      .toMatchObject({
        pointId: runtime.secondPointId,
        target: 'inHandle'
      })
  })

  test('dragging first point of a subpath does not create bezier handles', async ({
    page
  }) => {
    const initialCount = await getElementCount(page)

    await page.keyboard.press('p')
    await expect.poll(() => getActiveTool(page)).toBe('pen')
    await dragOnCanvas(page, 0.3, 0.3, 0.42, 0.38, 8)
    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 1)

    await expect
      .poll(async () => {
        return page.evaluate(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const core = (window as any).__Core__
          const selected = core?.getSystemProperty?.('selectedVectorPoint')
          return selected?.target ?? null
        })
      })
      .toBe('anchor')
  })

  test('curve control handle can be selected and shown in properties panel', async ({
    page
  }) => {
    const initialCount = await getElementCount(page)

    await page.keyboard.press('p')
    await expect.poll(() => getActiveTool(page)).toBe('pen')
    await clickCanvas(page, 0.3, 0.3)
    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 1)
    await dragOnCanvas(page, 0.45, 0.4, 0.55, 0.32, 8)

    await page.keyboard.press('v')
    await expect.poll(() => getActiveTool(page)).toBe('select')

    const handleClientPos = await getCanvasPosition(page, 0.55, 0.32)

    expect(handleClientPos).not.toBeNull()
    if (!handleClientPos) {
      return
    }

    await page.mouse.move(handleClientPos.x, handleClientPos.y)
    await page.mouse.click(handleClientPos.x, handleClientPos.y)

    await expect
      .poll(async () => {
        return page.evaluate(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const core = (window as any).__Core__
          const selected = core?.getSystemProperty?.('selectedVectorPoint')
          return selected?.target ?? null
        })
      })
      .toBe('outHandle')

    await expect(page.getByTestId('prop-point-target')).toContainText(
      'Out Handle'
    )
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

  test('escape uses split-then-exit semantics before creating a new vector', async ({
    page
  }) => {
    const initialCount = await getElementCount(page)

    await page.keyboard.press('p')
    await expect.poll(() => getActiveTool(page)).toBe('pen')

    await clickCanvas(page, 0.3, 0.3)
    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 1)

    await clickCanvas(page, 0.45, 0.4)
    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 1)

    // First escape: keep pen editing mode but start a new subpath in same vector.
    await page.keyboard.press('Escape')
    await page.waitForTimeout(150)

    // Second consecutive escape: exit path editing mode and switch to Select tool.
    await page.keyboard.press('Escape')
    await expect.poll(() => getActiveTool(page)).toBe('select')

    // Switch back to pen and create a new vector.
    await page.keyboard.press('p')
    await expect.poll(() => getActiveTool(page)).toBe('pen')
    await clickCanvas(page, 0.65, 0.5)
    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 2)
  })
})
