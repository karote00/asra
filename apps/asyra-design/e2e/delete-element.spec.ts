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

  test('Backspace key removes the single selected element', async ({
    page
  }) => {
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
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') {
        pageErrors.push(message.text())
      }
    })
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
    expect(pageErrors).toEqual([])
  })

  test('validation failure restores deleted element and props exactly', async ({
    page
  }) => {
    await createRectangle(page, 0.48, 0.42)
    const before = await page.evaluate(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(window as any).__deleteRollbackStatuses = []
      core.deps.factory.subscribeToTransactionStatus(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (status: any) =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (window as any).__deleteRollbackStatuses.push(status.status)
      )
      core.deps.factory.registerTransactionValidator(
        'delete-rollback-e2e',
        () => ({
          valid: false,
          code: 'forced-delete-failure',
          message: 'Force delete rollback'
        })
      )
      return core.save()
    })

    await page.keyboard.press('Delete')
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (window as any).__deleteRollbackStatuses as string[]
        )
      )
      .toContain('rolled-back')

    const after = await page.evaluate(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      return core.save()
    })
    expect(after).toEqual(before)
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
        error.includes(
          "Cannot read properties of undefined (reading 'getBounds')"
        )
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
        core.setSystemProperty('mousePosition', { x, y })
        core.setSystemProperty('mouseDelta', { x: 0, y: 0 })
        core.setSystemProperty('mouseButton', 'none')
        core.setSystemProperty('mouseDown', false)
        core.setSystemProperty('mouseDragging', false)
        core.setSystemProperty('hoveredElementId', deletedId)
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
          const hoveredId =
            core?.getSystemProperty?.('hoveredElementId') ?? null
          return hoveredId !== deletedId
        }, runtime.selectedId)
      })
      .toBe(true)
  })

  test('Delete removes selected anchor in path-editing mode and splits interior path', async ({
    page
  }) => {
    const initialCount = await getElementCount(page)

    const anchorPositions = [
      { x: 0.24, y: 0.28 },
      { x: 0.33, y: 0.33 },
      { x: 0.42, y: 0.38 },
      { x: 0.51, y: 0.43 },
      { x: 0.6, y: 0.48 }
    ]

    await page.keyboard.press('p')
    for (const position of anchorPositions) {
      await clickCanvas(page, position.x, position.y)
    }
    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 1)

    const beforeDelete = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      const pathEditingVectorId =
        core?.getSystemProperty?.('pathEditingVectorId') ?? null
      if (!pathEditingVectorId) {
        return null
      }

      const element =
        core?.deps?.sceneTree?.getElementById?.(pathEditingVectorId)
      const computed = element?.getAllComputedData?.() ?? {}
      const networks = Object.values(computed.networks ?? {})
      const primaryNetwork = networks[0] as
        | { pointIds?: string[]; segmentIds?: string[] }
        | undefined

      return {
        vectorId: pathEditingVectorId,
        pointIds: primaryNetwork?.pointIds ?? [],
        segmentIds: primaryNetwork?.segmentIds ?? [],
        middlePointId: primaryNetwork?.pointIds?.[2] ?? null
      }
    })

    expect(beforeDelete).not.toBeNull()
    if (!beforeDelete || !beforeDelete.middlePointId) {
      return
    }

    await page.keyboard.press('v')
    const middlePointPos = await getCanvasPosition(
      page,
      anchorPositions[2].x,
      anchorPositions[2].y
    )
    await page.mouse.move(middlePointPos.x, middlePointPos.y)
    await page.mouse.click(middlePointPos.x, middlePointPos.y)

    await expect
      .poll(async () => {
        return page.evaluate(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const core = (window as any).__Core__
          const selected = core?.getSystemProperty?.('selectedVectorPoint')
          return {
            pointId: selected?.pointId ?? null,
            target: selected?.target ?? null
          }
        })
      })
      .toMatchObject({
        pointId: beforeDelete.middlePointId,
        target: 'anchor'
      })

    await page.keyboard.press('Delete')
    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 1)

    await expect
      .poll(async () => {
        return page.evaluate((before) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const core = (window as any).__Core__
          const pathEditingVectorId =
            core?.getSystemProperty?.('pathEditingVectorId') ?? null
          const selectedPoint = core?.getSystemProperty?.('selectedVectorPoint')
          const element = core?.deps?.sceneTree?.getElementById?.(
            before.vectorId
          )
          const computed = element?.getAllComputedData?.() ?? {}
          const networks = Object.values(computed.networks ?? {}) as {
            pointIds?: string[]
            segmentIds?: string[]
          }[]
          const anchorPointIds = networks.flatMap(
            (network) => network.pointIds ?? []
          )
          const segmentIds = Object.keys(computed.segments ?? {})
          const oldSegmentIds = new Set(before.segmentIds)
          const hasReusedSegmentId = segmentIds.some((id) =>
            oldSegmentIds.has(id)
          )
          const networkPointCounts = networks.map(
            (network) => (network.pointIds ?? []).length
          )
          const networkSegmentCounts = networks.map(
            (network) => (network.segmentIds ?? []).length
          )

          return (
            pathEditingVectorId === before.vectorId &&
            selectedPoint == null &&
            !anchorPointIds.includes(before.middlePointId) &&
            anchorPointIds.length === before.pointIds.length - 1 &&
            networkPointCounts.length === 2 &&
            networkPointCounts.every((count) => count === 2) &&
            networkSegmentCounts.length === 2 &&
            networkSegmentCounts.every((count) => count === 1) &&
            segmentIds.length === 2 &&
            !hasReusedSegmentId
          )
        }, beforeDelete)
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

  test('Delete is blocked when path-editing mode is true even without editing vector id', async ({
    page
  }) => {
    const initialCount = await getElementCount(page)
    await createRectangle(page, 0.5, 0.5)
    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 1)

    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      core.setSystemProperty('pathEditingVectorId', null)
      core.setSystemProperty('pathEditingMode', true)
    })

    await page.keyboard.press('Delete')

    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 1)
  })

  test('Delete is allowed when path-editing mode is false even if editing vector id exists', async ({
    page
  }) => {
    const initialCount = await getElementCount(page)
    await createRectangle(page, 0.55, 0.55)
    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 1)

    const selectedId = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      const id = core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
      core.setSystemProperty('pathEditingVectorId', id)
      core.setSystemProperty('pathEditingMode', false)
      return id
    })

    expect(selectedId).not.toBeNull()
    if (!selectedId) {
      return
    }

    await page.keyboard.press('Delete')

    await expect.poll(async () => getElementCount(page)).toBe(initialCount)
  })
})
