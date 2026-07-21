import { test, expect } from '@playwright/test'
import {
  waitForAppReady,
  resetCanvas,
  clickCanvas,
  createRectangle,
  createVectorPath,
  getElementCount,
  dragOnCanvas,
  dragSelectedElementBy,
  getSelectedElementRect,
  getSelectedElementClientCenter,
  undo,
  redo
} from './test-utils'

/**
 * E2E Tests for Undo/Redo
 * Based on: .project/golden-paths/undoing-an-action.md
 */

test.describe('Undo/Redo Actions', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    const browserErrors: string[] = []
    ;(testInfo as typeof testInfo & { browserErrors: string[] }).browserErrors =
      browserErrors
    page.on('pageerror', (error) => {
      browserErrors.push(error.message)
    })
    page.on('console', (message) => {
      if (message.type() === 'error') {
        browserErrors.push(message.text())
      }
    })

    await page.goto('/')
    await waitForAppReady(page)
    await resetCanvas(page)
  })

  test.afterEach(async ({ page: _page }, testInfo) => {
    const browserErrors =
      (testInfo as typeof testInfo & { browserErrors?: string[] })
        .browserErrors ?? []
    expect(
      browserErrors.filter((message) =>
        message.includes('Not allow to get value which is not in entity data.')
      )
    ).toEqual([])
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

  test('pressing Escape during move commits the interruption position as one undoable action', async ({
    page
  }) => {
    await createRectangle(page, 0.35, 0.35)
    const before = await getSelectedElementRect(page)
    expect(before).not.toBeNull()
    if (!before) {
      return
    }

    const beforeUndoCount = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      return core?.deps?.factory?.transact?.undoStack?.length ?? 0
    })
    const start = await getSelectedElementClientCenter(page)
    expect(start).not.toBeNull()
    if (!start) {
      return
    }

    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const scope = window as any
      scope.__movePreviewDeliveries = []
      scope.__disposeMovePreviewObserver =
        scope.__Core__?.deps?.factory?.observeSharedDataChannel?.(
          'sceneTree',
          (change: unknown) => scope.__movePreviewDeliveries.push(change)
        )
    })
    await page.mouse.move(start.x, start.y)
    await page.mouse.down()
    await page.mouse.move(start.x + 120, start.y + 70, { steps: 10 })
    await expect
      .poll(async () => {
        const current = await getSelectedElementRect(page)
        return current
          ? current.x > before.x + 10 && current.y > before.y + 10
          : false
      })
      .toBe(true)
    const previewDeliveries = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (window as any).__movePreviewDeliveries ?? []
    })
    expect(previewDeliveries).toContainEqual(
      expect.objectContaining({
        action: 'updateElementComputedDataBatch',
        options: expect.objectContaining({ sharedDelivery: 'immediate' })
      })
    )
    const interrupted = await getSelectedElementRect(page)
    expect(interrupted).not.toBeNull()
    if (!interrupted) {
      return
    }

    const getPositionById = () =>
      page.evaluate((elementId) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const core = (window as any).__Core__
        const element = core?.deps?.sceneTree?.getElementById?.(elementId)
        const computed = element?.getAllComputedData?.()
        return computed
          ? { x: Number(computed.x), y: Number(computed.y) }
          : null
      }, before.id)

    await page.keyboard.press('Escape')
    await page.mouse.up()
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const scope = window as any
      scope.__disposeMovePreviewObserver?.()
      delete scope.__disposeMovePreviewObserver
      delete scope.__movePreviewDeliveries
    })

    await expect
      .poll(async () => {
        const committed = await getPositionById()
        return committed
          ? { x: Math.round(committed.x), y: Math.round(committed.y) }
          : null
      })
      .toEqual({
        x: Math.round(interrupted.x),
        y: Math.round(interrupted.y)
      })

    const afterUndoCount = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      return core?.deps?.factory?.transact?.undoStack?.length ?? 0
    })
    expect(afterUndoCount).toBe(beforeUndoCount + 1)

    await undo(page)
    await expect
      .poll(async () => {
        const restored = await getPositionById()
        return restored
          ? { x: Math.round(restored.x), y: Math.round(restored.y) }
          : null
      })
      .toEqual({ x: Math.round(before.x), y: Math.round(before.y) })
  })

  test('drag-create keeps immediate canonical updates in one undo commit', async ({
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
    expect(commitSummary.updateComputedDataCount).toBeGreaterThan(0)
    expect(commitSummary.changeCount).toBeGreaterThanOrEqual(
      commitSummary.updateComputedDataCount
    )
  })

  test('vector point final drag records undo without replaying the final render write', async ({
    page
  }) => {
    const summary = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const elementApis = (window as any).__AsyraE2E__?.elementApis
      if (!core || !elementApis) {
        throw new Error('Asyra E2E APIs are not available')
      }

      const points = {
        A: { id: 'A', kind: 'anchor', anchorType: 'smooth', x: 100, y: 100 },
        'A:in': {
          id: 'A:in',
          kind: 'control',
          controlForId: 'A',
          controlRole: 'in',
          x: 90,
          y: 100
        },
        'A:out': {
          id: 'A:out',
          kind: 'control',
          controlForId: 'A',
          controlRole: 'out',
          x: 110,
          y: 100
        },
        B: { id: 'B', kind: 'anchor', anchorType: 'smooth', x: 200, y: 110 },
        'B:in': {
          id: 'B:in',
          kind: 'control',
          controlForId: 'B',
          controlRole: 'in',
          x: 190,
          y: 110
        },
        C: { id: 'C', kind: 'anchor', anchorType: 'sharp', x: 240, y: 170 }
      }
      const elementId = elementApis.createElement(
        {
          type: 'vector',
          points,
          segments: {
            AB: {
              id: 'AB',
              startId: 'A',
              endId: 'B',
              outControlId: 'A:out',
              inControlId: 'B:in'
            },
            BC: {
              id: 'BC',
              startId: 'B',
              endId: 'C',
              outControlId: null,
              inControlId: null
            }
          },
          networks: {
            main: {
              id: 'main',
              pointIds: ['A', 'B', 'C'],
              segmentIds: ['AB', 'BC'],
              closed: false
            }
          },
          closed: false
        },
        { undoable: false }
      )
      if (!elementId) {
        throw new Error('Failed to create vector fixture')
      }

      const beforePointRaw = elementApis.getVectorAnchorPointById(
        elementId,
        'A'
      )?.point
      const beforePoint = beforePointRaw
        ? JSON.parse(JSON.stringify(beforePointRaw))
        : null
      const stackBefore = core.deps.factory.transact.undoStack.length
      elementApis.updateVectorAnchorPointPosition(
        elementId,
        'A',
        { x: 80, y: 110 },
        { undoable: false, skipResult: true }
      )
      elementApis.updateVectorAnchorPointPosition(elementId, 'A', beforePoint, {
        undoable: false,
        skipResult: true
      })
      elementApis.updateVectorAnchorPointPosition(
        elementId,
        'A',
        { x: 80, y: 110 },
        { undoable: true, skipResult: true }
      )
      const afterPointRaw = elementApis.getVectorAnchorPointById(
        elementId,
        'A'
      )?.point
      const afterPoint = afterPointRaw
        ? JSON.parse(JSON.stringify(afterPointRaw))
        : null

      const stack = core.deps.factory.transact.undoStack
      const last = stack[stack.length - 1] ?? []
      const point = elementApis.getVectorAnchorPointById(elementId, 'A')?.point

      return {
        elementId,
        stackBefore,
        stackAfter: stack.length,
        changeCount: last.length,
        changeTypes: last.map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (event: any) => event?.type
        ),
        patchValues:
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (last[0] as any)?.payload?.patch?.values ?? {},
        pointPatchIds: Object.keys(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (last[0] as any)?.payload?.patch?.records?.points?.set ?? {}
        ),
        beforePoint,
        afterPoint,
        point
      }
    })

    expect(summary.stackAfter).toBe(summary.stackBefore + 1)
    expect(
      summary.changeTypes.every((type) => type === 'updateComputedDataPatch')
    ).toBe(true)
    expect(summary.changeCount).toBe(1)
    expect(summary.patchValues).not.toHaveProperty('pointCoordinateSpace')
    expect(summary.pointPatchIds.sort()).toEqual(['A', 'A:in', 'A:out'])
    expect(summary.point).toMatchObject({ x: 80, y: 110 })

    await undo(page)
    await expect
      .poll(async () =>
        page.evaluate((elementId) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const elementApis = (window as any).__AsyraE2E__?.elementApis
          return elementApis?.getVectorAnchorPointById?.(elementId, 'A')?.point
        }, summary.elementId)
      )
      .toMatchObject(summary.beforePoint)

    await redo(page)
    await expect
      .poll(async () =>
        page.evaluate((elementId) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const elementApis = (window as any).__AsyraE2E__?.elementApis
          return elementApis?.getVectorAnchorPointById?.(elementId, 'A')?.point
        }, summary.elementId)
      )
      .toMatchObject(summary.afterPoint)
  })

  test('vector structural operations undo and redo through single computed patch commits', async ({
    page
  }) => {
    const setup = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const elementApis = (window as any).__AsyraE2E__?.elementApis
      if (!core || !elementApis) {
        throw new Error('Asyra E2E APIs are not available')
      }

      const elementId = elementApis.createElement(
        {
          type: 'vector',
          points: {
            A: {
              id: 'A',
              kind: 'anchor',
              anchorType: 'sharp',
              x: 180,
              y: 180
            },
            B: {
              id: 'B',
              kind: 'anchor',
              anchorType: 'sharp',
              x: 280,
              y: 170
            },
            C: {
              id: 'C',
              kind: 'anchor',
              anchorType: 'sharp',
              x: 360,
              y: 240
            }
          },
          segments: {
            AB: {
              id: 'AB',
              startId: 'A',
              endId: 'B',
              outControlId: null,
              inControlId: null
            },
            BC: {
              id: 'BC',
              startId: 'B',
              endId: 'C',
              outControlId: null,
              inControlId: null
            }
          },
          networks: {
            main: {
              id: 'main',
              pointIds: ['A', 'B', 'C'],
              segmentIds: ['AB', 'BC'],
              closed: false
            }
          },
          closed: false
        },
        { undoable: false }
      )
      if (!elementId) {
        throw new Error('Failed to create vector fixture')
      }
      core.selectElements?.([elementId], { undoable: false })
      return { elementId }
    })

    const readTopology = async () =>
      page.evaluate((elementId) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const core = (window as any).__Core__
        const computed =
          core?.deps?.sceneTree
            ?.getElementById?.(elementId)
            ?.getAllComputedData?.() ?? {}
        return {
          pointIds: Object.keys(computed.points ?? {}).sort(),
          segmentIds: Object.keys(computed.segments ?? {}).sort(),
          closed: computed.closed,
          bType: computed.points?.B?.anchorType,
          bHandleMode: computed.points?.B?.handleMode ?? 'none',
          bIn: computed.points?.['B:in']
            ? {
                x: computed.points['B:in'].x,
                y: computed.points['B:in'].y
              }
            : null,
          bOut: computed.points?.['B:out']
            ? {
                x: computed.points['B:out'].x,
                y: computed.points['B:out'].y
              }
            : null,
          hasBIn: !!computed.points?.['B:in'],
          hasBOut: !!computed.points?.['B:out']
        }
      }, setup.elementId)

    const readLastUndo = async () =>
      page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const core = (window as any).__Core__
        const stack = core?.deps?.factory?.transact?.undoStack ?? []
        const last = stack[stack.length - 1] ?? []
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const patch = ((last[0] as any)?.payload?.patch ?? {}) as Record<
          string,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          any
        >
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const removeIds = (value: any) =>
          Array.isArray(value) ? value : Object.keys(value ?? {})
        return {
          changeTypes: last.map(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (event: any) => event?.type
          ),
          pointSetIds: Object.keys(patch.records?.points?.set ?? {}).sort(),
          pointRemoveIds: removeIds(patch.records?.points?.remove).sort(),
          segmentRemoveIds: removeIds(patch.records?.segments?.remove).sort(),
          networkSetIds: Object.keys(patch.records?.networks?.set ?? {}).sort(),
          valueKeys: Object.keys(patch.values ?? {}).sort()
        }
      })

    const expectSinglePatchUndo = async () => {
      const summary = await readLastUndo()
      expect(summary.changeTypes).toEqual(['updateComputedDataPatch'])
      return summary
    }
    const undoStructuralOperation = async () => {
      await page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(window as any).__Core__?.deps?.factory?.transact?.undo?.()
      })
      await page.waitForTimeout(120)
    }
    const redoStructuralOperation = async () => {
      await page.evaluate(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(window as any).__Core__?.deps?.factory?.transact?.redo?.()
      })
      await page.waitForTimeout(120)
    }

    await page.evaluate((elementId) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const elementApis = (window as any).__AsyraE2E__?.elementApis
      elementApis.appendVectorAnchorPoint(elementId, {
        id: 'D',
        type: 'sharp',
        x: 390,
        y: 320,
        isMove: undefined,
        inHandle: null,
        outHandle: null
      })
    }, setup.elementId)
    const appendUndo = await expectSinglePatchUndo()
    expect(appendUndo.pointSetIds).toEqual(['D'])
    await undoStructuralOperation()
    await expect.poll(readTopology).not.toMatchObject({
      pointIds: expect.arrayContaining(['D'])
    })
    await redoStructuralOperation()
    await expect.poll(readTopology).toMatchObject({
      pointIds: expect.arrayContaining(['D'])
    })

    const splitPointId = await page.evaluate((elementId) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const elementApis = (window as any).__AsyraE2E__?.elementApis
      const computed =
        core?.deps?.sceneTree
          ?.getElementById?.(elementId)
          ?.getAllComputedData?.() ?? {}
      const segment = computed.segments?.AB
      const start = computed.points?.[segment?.startId]
      const end = computed.points?.[segment?.endId]
      const result = elementApis.splitVectorSegmentAtWorkspacePos(
        elementId,
        'AB',
        {
          x: (start.x + end.x) / 2,
          y: (start.y + end.y) / 2
        }
      )
      return result?.point?.id
    }, setup.elementId)
    expect(splitPointId).toBeTruthy()
    const splitUndo = await expectSinglePatchUndo()
    expect(splitUndo.pointSetIds).toEqual([splitPointId])
    expect(splitUndo.segmentRemoveIds).toContain('AB')
    await undoStructuralOperation()
    await expect.poll(readTopology).not.toMatchObject({
      pointIds: expect.arrayContaining([splitPointId])
    })
    await redoStructuralOperation()
    await expect.poll(readTopology).toMatchObject({
      pointIds: expect.arrayContaining([splitPointId])
    })

    await page.evaluate(
      ({ elementId, pointId }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const elementApis = (window as any).__AsyraE2E__?.elementApis
        elementApis.removeVectorAnchorPoint(elementId, pointId)
      },
      { elementId: setup.elementId, pointId: splitPointId }
    )
    const removeUndo = await expectSinglePatchUndo()
    expect(removeUndo.pointRemoveIds).toEqual([splitPointId])
    await undoStructuralOperation()
    await expect.poll(readTopology).toMatchObject({
      pointIds: expect.arrayContaining([splitPointId])
    })
    await redoStructuralOperation()
    await expect.poll(readTopology).not.toMatchObject({
      pointIds: expect.arrayContaining([splitPointId])
    })

    await page.evaluate((elementId) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const elementApis = (window as any).__AsyraE2E__?.elementApis
      elementApis.updateVectorAnchorPointType(elementId, 'B', 'smooth')
    }, setup.elementId)
    const typeUndo = await expectSinglePatchUndo()
    expect(typeUndo.pointSetIds).toEqual(['B'])
    await undoStructuralOperation()
    await expect.poll(readTopology).toMatchObject({ bType: 'sharp' })
    await redoStructuralOperation()
    await expect.poll(readTopology).toMatchObject({ bType: 'smooth' })

    await page.evaluate((elementId) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const elementApis = (window as any).__AsyraE2E__?.elementApis
      const point =
        core?.deps?.sceneTree
          ?.getElementById?.(elementId)
          ?.getAllComputedData?.()?.points?.B ?? {}
      elementApis.updateVectorAnchorPointHandles(elementId, [
        {
          pointId: 'B',
          target: 'inHandle',
          position: { x: point.x - 30, y: point.y + 12 },
          forceSmooth: true
        },
        {
          pointId: 'B',
          target: 'outHandle',
          position: { x: point.x + 36, y: point.y - 18 },
          forceSmooth: true
        }
      ])
    }, setup.elementId)
    const handlesUndo = await expectSinglePatchUndo()
    expect(handlesUndo.pointSetIds).toEqual(['B:in', 'B:out'])
    await undoStructuralOperation()
    await expect.poll(readTopology).toMatchObject({
      hasBIn: false,
      hasBOut: false
    })
    await redoStructuralOperation()
    await expect.poll(readTopology).toMatchObject({
      hasBIn: true,
      hasBOut: true
    })

    await page.evaluate((elementId) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const elementApis = (window as any).__AsyraE2E__?.elementApis
      elementApis.setVectorAnchorPointHandleMode(
        elementId,
        'B',
        'mirror-angle-length'
      )
    }, setup.elementId)
    const handleModeUndo = await expectSinglePatchUndo()
    expect(handleModeUndo.pointSetIds).toContain('B')
    expect(handleModeUndo.pointSetIds).toContain('B:in')
    expect(
      handleModeUndo.pointSetIds.every((pointId) =>
        ['B', 'B:in', 'B:out'].includes(pointId)
      )
    ).toBe(true)
    await expect.poll(readTopology).toMatchObject({
      bHandleMode: 'mirror-angle-length'
    })
    await undoStructuralOperation()
    await expect.poll(readTopology).toMatchObject({
      bHandleMode: 'none',
      hasBIn: true,
      hasBOut: true
    })
    await redoStructuralOperation()
    await expect.poll(readTopology).toMatchObject({
      bHandleMode: 'mirror-angle-length',
      hasBIn: true,
      hasBOut: true
    })

    await page.evaluate((elementId) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const elementApis = (window as any).__AsyraE2E__?.elementApis
      elementApis.connectVectorAnchorEndpoints(elementId, 'D', 'A')
    }, setup.elementId)
    const mergeUndo = await expectSinglePatchUndo()
    expect(mergeUndo.valueKeys).not.toContain('closed')
    expect(mergeUndo.networkSetIds).toHaveLength(1)
    await undoStructuralOperation()
    await expect.poll(readTopology).toMatchObject({ closed: false })
    await redoStructuralOperation()
    await expect.poll(readTopology).toMatchObject({ closed: false })

    await page.evaluate((elementId) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const elementApis = (window as any).__AsyraE2E__?.elementApis
      elementApis.setVectorClosed(elementId, true)
    }, setup.elementId)
    const closeUndo = await expectSinglePatchUndo()
    expect(closeUndo.valueKeys).toContain('closed')
    await expect.poll(readTopology).toMatchObject({ closed: true })
  })

  test('vector point mouse drag releases on mouseup without moving vector frame and Escape exits path editing', async ({
    page
  }) => {
    await createVectorPath(page, 0.32, 0.3, 0.18, 0.16)
    await page.keyboard.press('Enter')
    await expect
      .poll(() =>
        page.evaluate(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const core = (window as any).__Core__
          return core?.getSystemProperty?.('pathEditingMode') ?? false
        })
      )
      .toBe(true)

    const before = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      const vectorId = core?.getSystemProperty?.('pathEditingVectorId')
      const element = vectorId
        ? core?.deps?.sceneTree?.getElementById?.(vectorId)
        : null
      const computed = element?.getAllComputedData?.() ?? {}
      const anchor = Object.values(computed.points ?? {}).find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (point: any) => point?.kind === 'anchor'
      ) as { id: string; x: number; y: number } | undefined
      const anchors = Object.fromEntries(
        Object.values(computed.points ?? {})
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .filter((point: any) => point?.kind === 'anchor')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((point: any) => [
            point.id,
            {
              x: point.x,
              y: point.y
            }
          ])
      )
      if (!vectorId || !anchor) {
        throw new Error('Missing editable vector anchor')
      }

      const zoom = core?.getSystemProperty?.('zoom') ?? 1
      const viewport = core?.getSystemProperty?.('viewportPosition') ?? {
        x: 0,
        y: 0
      }
      const usesWorkspacePoints = computed.pointCoordinateSpace === 'workspace'
      const offsetX = usesWorkspacePoints ? 0 : (computed.x ?? 0)
      const offsetY = usesWorkspacePoints ? 0 : (computed.y ?? 0)

      return {
        vectorId,
        pointId: anchor.id,
        point: { x: anchor.x, y: anchor.y },
        anchors,
        rect: {
          x: computed.x,
          y: computed.y,
          width: computed.width,
          height: computed.height
        },
        client: {
          x: (offsetX + anchor.x) * zoom + viewport.x,
          y: (offsetY + anchor.y) * zoom + viewport.y
        }
      }
    })

    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const scope = window as any
      scope.__vectorPointPreviewDeliveries = []
      scope.__disposeVectorPointPreviewObserver =
        scope.__Core__?.deps?.factory?.observeSharedDataChannel?.(
          'sceneTree',
          (change: unknown) => scope.__vectorPointPreviewDeliveries.push(change)
        )
    })
    await page.mouse.move(before.client.x, before.client.y)
    await page.mouse.down()
    await page.mouse.move(before.client.x + 52, before.client.y + 24, {
      steps: 12
    })
    const previewDeliveries = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (window as any).__vectorPointPreviewDeliveries ?? []
    })
    expect(previewDeliveries).toContainEqual(
      expect.objectContaining({
        options: expect.objectContaining({ sharedDelivery: 'immediate' })
      })
    )
    await page.mouse.up()
    await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const scope = window as any
      scope.__disposeVectorPointPreviewObserver?.()
      delete scope.__disposeVectorPointPreviewObserver
      delete scope.__vectorPointPreviewDeliveries
    })
    await page.waitForTimeout(80)

    const afterMouseup = await page.evaluate(({ vectorId, pointId }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      const element = core?.deps?.sceneTree?.getElementById?.(vectorId)
      const computed = element?.getAllComputedData?.() ?? {}
      const point = computed.points?.[pointId]
      const anchors = Object.fromEntries(
        Object.values(computed.points ?? {})
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .filter((entry: any) => entry?.kind === 'anchor')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((entry: any) => [
            entry.id,
            {
              x: entry.x,
              y: entry.y
            }
          ])
      )
      return {
        point: point ? { x: point.x, y: point.y } : null,
        anchors,
        rect: {
          x: computed.x,
          y: computed.y,
          width: computed.width,
          height: computed.height
        }
      }
    }, before)

    expect(afterMouseup.point?.x).toBeGreaterThan(before.point.x + 20)
    Object.entries(before.anchors)
      .filter(([pointId]) => pointId !== before.pointId)
      .forEach(([pointId, point]) => {
        expect(afterMouseup.anchors[pointId]).toEqual(point)
      })

    await page.mouse.move(before.client.x + 160, before.client.y + 120, {
      steps: 8
    })
    await page.waitForTimeout(120)

    const afterReleasedMove = await page.evaluate(({ vectorId, pointId }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      const element = core?.deps?.sceneTree?.getElementById?.(vectorId)
      const computed = element?.getAllComputedData?.() ?? {}
      const point = computed.points?.[pointId]
      const anchors = Object.fromEntries(
        Object.values(computed.points ?? {})
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .filter((entry: any) => entry?.kind === 'anchor')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((entry: any) => [
            entry.id,
            {
              x: entry.x,
              y: entry.y
            }
          ])
      )
      return {
        point: point ? { x: point.x, y: point.y } : null,
        anchors,
        rect: {
          x: computed.x,
          y: computed.y,
          width: computed.width,
          height: computed.height
        }
      }
    }, before)

    expect(afterReleasedMove.point).toEqual(afterMouseup.point)
    expect(afterReleasedMove.anchors).toEqual(afterMouseup.anchors)
    expect(afterReleasedMove.rect).toEqual(afterMouseup.rect)

    await page.keyboard.press('Escape')
    await expect
      .poll(() =>
        page.evaluate(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const core = (window as any).__Core__
          return {
            pathEditingMode:
              core?.getSystemProperty?.('pathEditingMode') ?? false,
            pathEditingVectorId:
              core?.getSystemProperty?.('pathEditingVectorId') ?? null,
            primaryTool: core?.getSystemProperty?.('primaryTool') ?? null
          }
        })
      )
      .toEqual({
        pathEditingMode: false,
        pathEditingVectorId: null,
        primaryTool: 'select'
      })
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
