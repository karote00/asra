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

  test('second-point drag creates curve handles in the edited path', async ({
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

    const firstPointRuntime = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      const selected = core?.getSystemProperty?.('selectedVectorPoint')
      const vectorId = core?.getSystemProperty?.('pathEditingVectorId') ?? null
      return {
        vectorId,
        firstPointId: selected?.pointId ?? null
      }
    })
    expect(firstPointRuntime.vectorId).not.toBeNull()
    expect(firstPointRuntime.firstPointId).not.toBeNull()
    if (!firstPointRuntime.vectorId || !firstPointRuntime.firstPointId) {
      return
    }

    const readFirstSegmentState = async (secondPointId?: string) =>
      page.evaluate(
        ({ vectorId, firstPointId, secondPointId }) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const core = (window as any).__Core__
          const element = core?.deps?.sceneTree?.getElementById?.(vectorId)
          const computed = element?.getAllComputedData?.() ?? {}
          const points = computed.points ?? {}
          const segments = computed.segments ?? {}
          const networks = Object.values(computed.networks ?? {}) as {
            pointIds?: string[]
            segmentIds?: string[]
          }[]
          const network = networks.find((item) =>
            item.pointIds?.includes(firstPointId)
          )
          const segment = (network?.segmentIds ?? [])
            .map((segmentId) => segments[segmentId])
            .find((candidate) => candidate?.startId === firstPointId)
          const firstAnchor = points[firstPointId]
          const firstOut =
            segment?.outControlId && points[segment.outControlId]
              ? points[segment.outControlId]
              : null
          const selected = core?.getSystemProperty?.('selectedVectorPoint')
          const selectedPoint = selected?.pointId
            ? points[selected.pointId]
            : null
          const selectedOut =
            selectedPoint?.kind === 'anchor'
              ? points[`${selected.pointId}:out`]
              : null
          const secondOut = secondPointId
            ? points[`${secondPointId}:out`]
            : null

          return {
            selectedPointId: selected?.pointId ?? null,
            selectedTarget: selected?.target ?? null,
            bounds: {
              x: computed.x,
              y: computed.y,
              width: computed.width,
              height: computed.height
            },
            networkPointCount: network?.pointIds?.length ?? 0,
            segmentStartId: segment?.startId ?? null,
            segmentEndId: segment?.endId ?? null,
            outControlId: segment?.outControlId ?? null,
            firstAnchor:
              firstAnchor?.kind === 'anchor'
                ? { x: firstAnchor.x, y: firstAnchor.y }
                : null,
            firstOut:
              firstOut?.kind === 'control'
                ? {
                    id: firstOut.id,
                    controlForId: firstOut.controlForId,
                    controlRole: firstOut.controlRole,
                    x: firstOut.x,
                    y: firstOut.y
                  }
                : null,
            selectedOut:
              selectedOut?.kind === 'control'
                ? { x: selectedOut.x, y: selectedOut.y }
                : null,
            secondOut:
              secondOut?.kind === 'control'
                ? { x: secondOut.x, y: secondOut.y }
                : null
          }
        },
        { ...firstPointRuntime, secondPointId: secondPointId ?? null }
      )

    await page.mouse.move(secondClientPos.x, secondClientPos.y)
    await page.mouse.down()
    await page.mouse.move(
      secondClientPos.x + (dragClientPos.x - secondClientPos.x) * 0.5,
      secondClientPos.y + (dragClientPos.y - secondClientPos.y) * 0.5,
      { steps: 6 }
    )
    const midDragState = await readFirstSegmentState()
    expect(midDragState).toMatchObject({
      networkPointCount: 2,
      segmentStartId: firstPointRuntime.firstPointId,
      outControlId: `${firstPointRuntime.firstPointId}:out`
    })
    expect(midDragState.firstOut).toMatchObject({
      controlForId: firstPointRuntime.firstPointId,
      controlRole: 'out'
    })
    expect(midDragState.firstAnchor).not.toBeNull()
    expect(midDragState.firstOut).not.toBeNull()
    if (!midDragState.firstAnchor || !midDragState.firstOut) {
      return
    }
    expect(
      Math.abs(midDragState.firstOut.x - midDragState.firstAnchor.x)
    ).toBeGreaterThan(1)

    await page.mouse.move(dragClientPos.x, dragClientPos.y, { steps: 6 })
    const lateDragState = await readFirstSegmentState()
    expect(lateDragState.firstOut).not.toBeNull()
    if (!lateDragState.firstOut) {
      return
    }
    expect(
      Math.abs(lateDragState.firstOut.x - midDragState.firstOut.x)
    ).toBeGreaterThan(1)

    await page.mouse.up()

    const runtime = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      const selected = core?.getSystemProperty?.('selectedVectorPoint')

      return {
        secondPointId: selected?.pointId ?? null
      }
    })
    expect(runtime.secondPointId).not.toBeNull()
    if (!runtime.secondPointId) {
      return
    }

    const finalState = await readFirstSegmentState(runtime.secondPointId)
    expect(finalState).toMatchObject({
      selectedTarget: 'anchor',
      segmentStartId: firstPointRuntime.firstPointId,
      segmentEndId: runtime.secondPointId,
      outControlId: `${firstPointRuntime.firstPointId}:out`
    })
    expect(finalState.firstOut).toMatchObject({
      controlForId: firstPointRuntime.firstPointId,
      controlRole: 'out'
    })
    expect(finalState.secondOut).not.toBeNull()
    expect(finalState.bounds.width).toBeGreaterThan(1)
    expect(finalState.bounds.height).toBeGreaterThan(1)

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

    await page.keyboard.press('Escape')
    await expect
      .poll(async () =>
        page.evaluate(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const core = (window as any).__Core__
          return core?.getSystemProperty?.('pathEditingVectorId') ?? null
        })
      )
      .toBeNull()

    const exitedEditingState = await readFirstSegmentState(
      runtime.secondPointId
    )
    expect(exitedEditingState).toMatchObject({
      segmentStartId: firstPointRuntime.firstPointId,
      segmentEndId: runtime.secondPointId,
      outControlId: `${firstPointRuntime.firstPointId}:out`
    })
    expect(exitedEditingState.secondOut).not.toBeNull()
    expect(exitedEditingState.bounds).toEqual(finalState.bounds)
  })

  test('second-point micro drag below threshold keeps first segment straight', async ({
    page
  }) => {
    const initialCount = await getElementCount(page)

    const firstClientPos = await getCanvasPosition(page, 0.3, 0.3)
    const secondClientPos = await getCanvasPosition(page, 0.45, 0.4)
    const microDragClientPos = {
      x: secondClientPos.x + 1,
      y: secondClientPos.y + 1
    }

    await page.keyboard.press('p')
    await expect.poll(() => getActiveTool(page)).toBe('pen')
    await page.mouse.click(firstClientPos.x, firstClientPos.y)
    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 1)

    await page.mouse.move(secondClientPos.x, secondClientPos.y)
    await page.mouse.down()
    await page.mouse.move(microDragClientPos.x, microDragClientPos.y, {
      steps: 2
    })
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
        selectedTarget: selected?.target ?? null
      }
    })

    expect(runtime.selectedTarget).toBe('anchor')

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
    const M = toWorkspace(microDragClientPos)
    const vx = M.x - B.x

    const expectedP1 = {
      x: A.x - vx * 0.334,
      y: A.y + (B.y - A.y) * 0.327
    }
    const expectedP1Client = toClient(expectedP1)

    await page.mouse.move(expectedP1Client.x, expectedP1Client.y)
    await expect
      .poll(async () => {
        return page.evaluate(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const core = (window as any).__Core__
          const hovered = core?.getSystemProperty?.('hoveredVectorPoint')
          return hovered?.target ?? null
        })
      })
      .not.toBe('outHandle')
  })

  test('prepend-point drag in path editing keeps the new anchor selected', async ({
    page
  }) => {
    const initialCount = await getElementCount(page)

    await page.keyboard.press('p')
    await expect.poll(() => getActiveTool(page)).toBe('pen')
    await clickCanvas(page, 0.3, 0.3)
    await clickCanvas(page, 0.45, 0.4)
    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 1)

    // Enter split mode, then click endpoint to continue from start side.
    await page.keyboard.press('Escape')
    await page.waitForTimeout(80)
    const firstPointPos = await getCanvasPosition(page, 0.3, 0.3)
    await page.mouse.click(firstPointPos.x, firstPointPos.y)

    const dragEndPos = await getCanvasPosition(page, 0.1, 0.25)
    await dragOnCanvas(page, 0.18, 0.32, 0.1, 0.25, 8)

    const selectedPointId = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      const selected = core?.getSystemProperty?.('selectedVectorPoint')
      return selected?.pointId ?? null
    })
    expect(selectedPointId).not.toBeNull()
    if (!selectedPointId) {
      return
    }

    await page.mouse.move(dragEndPos.x, dragEndPos.y)
    await expect
      .poll(async () => {
        const value = await page.evaluate(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const core = (window as any).__Core__
          const selected = core?.getSystemProperty?.('selectedVectorPoint')
          return {
            selectedPointId: selected?.pointId ?? null,
            selectedTarget: selected?.target ?? null
          }
        })

        if (!value || value.selectedPointId !== selectedPointId) {
          return false
        }
        return value.selectedTarget === 'anchor'
      })
      .toBe(true)
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

  test('moving selected anchor point also translates its curve handles', async ({
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

    const beforeMove = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      const pathEditingVectorId =
        core?.getSystemProperty?.('pathEditingVectorId') ?? null
      const selected = core?.getSystemProperty?.('selectedVectorPoint')
      const zoom = core?.getSystemProperty?.('zoom') ?? 1
      const viewport = core?.getSystemProperty?.('viewportPosition') ?? {
        x: 0,
        y: 0
      }
      if (!pathEditingVectorId || !selected?.pointId) {
        return null
      }

      const element =
        core?.deps?.sceneTree?.getElementById?.(pathEditingVectorId)
      const computed = element?.getAllComputedData?.() ?? {}
      const offsetX = typeof computed.x === 'number' ? computed.x : 0
      const offsetY = typeof computed.y === 'number' ? computed.y : 0
      const pointId = selected.pointId as string
      const anchor = computed.points?.[pointId]
      const inHandle = computed.points?.[`${pointId}:in`]
      const outHandle = computed.points?.[`${pointId}:out`]

      if (!anchor || anchor.kind !== 'anchor') {
        return null
      }

      return {
        pointId,
        anchorX: anchor.x + offsetX,
        anchorY: anchor.y + offsetY,
        inHandle:
          inHandle && inHandle.kind === 'control'
            ? { x: inHandle.x + offsetX, y: inHandle.y + offsetY }
            : null,
        outHandle:
          outHandle && outHandle.kind === 'control'
            ? { x: outHandle.x + offsetX, y: outHandle.y + offsetY }
            : null,
        zoom,
        viewport
      }
    })

    expect(beforeMove).not.toBeNull()
    if (!beforeMove) {
      return
    }

    const deltaX = 40
    const anchorClient = {
      x: beforeMove.anchorX * beforeMove.zoom + beforeMove.viewport.x,
      y: beforeMove.anchorY * beforeMove.zoom + beforeMove.viewport.y
    }

    await page.mouse.move(anchorClient.x, anchorClient.y)
    await page.mouse.down()
    await page.mouse.move(anchorClient.x + deltaX, anchorClient.y, {
      steps: 12
    })
    await page.mouse.up()

    await expect
      .poll(async () => {
        return page.evaluate(
          ({ pointId, anchorX, inHandle, outHandle, expectedDeltaX }) => {
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
            const offsetX = typeof computed.x === 'number' ? computed.x : 0
            const offsetY = typeof computed.y === 'number' ? computed.y : 0
            const anchorAfter = computed.points?.[pointId]
            const inHandleAfter = computed.points?.[`${pointId}:in`]
            const outHandleAfter = computed.points?.[`${pointId}:out`]
            if (!anchorAfter || anchorAfter.kind !== 'anchor') {
              return null
            }

            const actualAnchorX = anchorAfter.x + offsetX
            const actualDeltaX = actualAnchorX - anchorX
            const epsilon = 0.001
            const inHandleFollowed =
              !inHandle ||
              (inHandleAfter?.kind === 'control' &&
                Math.abs(
                  inHandleAfter.x + offsetX - inHandle.x - actualDeltaX
                ) < epsilon &&
                Math.abs(inHandleAfter.y + offsetY - inHandle.y) < epsilon)
            const outHandleFollowed =
              !outHandle ||
              (outHandleAfter?.kind === 'control' &&
                Math.abs(
                  outHandleAfter.x + offsetX - outHandle.x - actualDeltaX
                ) < epsilon &&
                Math.abs(outHandleAfter.y + offsetY - outHandle.y) < epsilon)

            return {
              anchorMovedAsExpected:
                Math.abs(actualDeltaX - expectedDeltaX) < epsilon,
              inHandleFollowed,
              outHandleFollowed
            }
          },
          {
            pointId: beforeMove.pointId,
            anchorX: beforeMove.anchorX,
            inHandle: beforeMove.inHandle,
            outHandle: beforeMove.outHandle,
            expectedDeltaX: deltaX
          }
        )
      })
      .toMatchObject({
        anchorMovedAsExpected: true,
        inHandleFollowed: true,
        outHandleFollowed: true
      })
  })

  test('dragging selected out-handle updates handle position and keeps target selected', async ({
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

    const beforeMove = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      const pathEditingVectorId =
        core?.getSystemProperty?.('pathEditingVectorId') ?? null
      const selected = core?.getSystemProperty?.('selectedVectorPoint')
      const zoom = core?.getSystemProperty?.('zoom') ?? 1
      const viewport = core?.getSystemProperty?.('viewportPosition') ?? {
        x: 0,
        y: 0
      }
      if (!pathEditingVectorId || !selected?.pointId) {
        return null
      }

      const element =
        core?.deps?.sceneTree?.getElementById?.(pathEditingVectorId)
      const computed = element?.getAllComputedData?.() ?? {}
      const offsetX = typeof computed.x === 'number' ? computed.x : 0
      const offsetY = typeof computed.y === 'number' ? computed.y : 0
      const pointId = selected.pointId as string
      const anchor = computed.points?.[pointId]
      const outHandle = computed.points?.[`${pointId}:out`]
      if (!anchor || anchor.kind !== 'anchor') {
        return null
      }

      if (!outHandle || outHandle.kind !== 'control') {
        return null
      }

      return {
        pointId,
        anchorX: anchor.x + offsetX,
        anchorY: anchor.y + offsetY,
        outHandleX: outHandle.x + offsetX,
        outHandleY: outHandle.y + offsetY,
        zoom,
        viewport
      }
    })

    expect(beforeMove).not.toBeNull()
    if (!beforeMove) {
      return
    }

    const handleClient = {
      x: beforeMove.outHandleX * beforeMove.zoom + beforeMove.viewport.x,
      y: beforeMove.outHandleY * beforeMove.zoom + beforeMove.viewport.y
    }

    await page.mouse.move(handleClient.x, handleClient.y)
    await page.mouse.click(handleClient.x, handleClient.y)

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

    const delta = { x: 30, y: -20 }
    await page.mouse.move(handleClient.x, handleClient.y)
    await page.mouse.down()
    await page.mouse.move(handleClient.x + delta.x, handleClient.y + delta.y, {
      steps: 12
    })
    await page.mouse.up()

    await expect
      .poll(async () => {
        return page.evaluate(
          ({ pointId, anchorX, anchorY, outHandleX, outHandleY, delta }) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const core = (window as any).__Core__
            const pathEditingVectorId =
              core?.getSystemProperty?.('pathEditingVectorId') ?? null
            const selected = core?.getSystemProperty?.('selectedVectorPoint')
            if (!pathEditingVectorId) {
              return null
            }

            const element =
              core?.deps?.sceneTree?.getElementById?.(pathEditingVectorId)
            const computed = element?.getAllComputedData?.() ?? {}
            const offsetX = typeof computed.x === 'number' ? computed.x : 0
            const offsetY = typeof computed.y === 'number' ? computed.y : 0
            const anchorAfter = computed.points?.[pointId]
            const outHandleAfter = computed.points?.[`${pointId}:out`]
            if (!anchorAfter || anchorAfter.kind !== 'anchor') {
              return null
            }

            if (!outHandleAfter || outHandleAfter.kind !== 'control') {
              return null
            }

            const epsilon = 0.001
            const anchorStable =
              Math.abs(anchorAfter.x + offsetX - anchorX) < epsilon &&
              Math.abs(anchorAfter.y + offsetY - anchorY) < epsilon
            const outHandleMoved =
              Math.abs(outHandleAfter.x + offsetX - outHandleX - delta.x) <
                epsilon &&
              Math.abs(outHandleAfter.y + offsetY - outHandleY - delta.y) <
                epsilon

            return {
              selectedTarget: selected?.target ?? null,
              selectedMatchesOutHandle:
                typeof selected?.x === 'number' &&
                typeof selected?.y === 'number' &&
                Math.abs(selected.x - (outHandleAfter.x + offsetX)) < epsilon &&
                Math.abs(selected.y - (outHandleAfter.y + offsetY)) < epsilon,
              anchorStable,
              outHandleMoved
            }
          },
          {
            pointId: beforeMove.pointId,
            anchorX: beforeMove.anchorX,
            anchorY: beforeMove.anchorY,
            outHandleX: beforeMove.outHandleX,
            outHandleY: beforeMove.outHandleY,
            delta
          }
        )
      })
      .toMatchObject({
        selectedTarget: 'outHandle',
        selectedMatchesOutHandle: true,
        anchorStable: true,
        outHandleMoved: true
      })
  })

  test('split mode segment click splits in-place and inserted point is shared by two segments', async ({
    page
  }) => {
    const initialCount = await getElementCount(page)

    await page.keyboard.press('p')
    await expect.poll(() => getActiveTool(page)).toBe('pen')
    await clickCanvas(page, 0.3, 0.3)
    await clickCanvas(page, 0.45, 0.4)
    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 1)

    const anchorClientPos = await getCanvasPosition(page, 0.3, 0.3)
    await page.mouse.move(anchorClientPos.x, anchorClientPos.y)
    await expect
      .poll(async () => {
        return page.evaluate(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const core = (window as any).__Core__
          const hoveredPoint = core?.getSystemProperty?.('hoveredVectorPoint')
          const hoveredSegment = core?.getSystemProperty?.(
            'hoveredVectorSegment'
          )
          return {
            hoveredPointTarget: hoveredPoint?.target ?? null,
            hoveredSegmentId: hoveredSegment?.segmentId ?? null
          }
        })
      })
      .toMatchObject({
        hoveredPointTarget: 'anchor',
        hoveredSegmentId: null
      })

    const segmentClientPos = await getCanvasPosition(page, 0.375, 0.35)
    await page.mouse.move(segmentClientPos.x, segmentClientPos.y)
    await expect
      .poll(async () => {
        return page.evaluate(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const core = (window as any).__Core__
          const hoveredPoint = core?.getSystemProperty?.('hoveredVectorPoint')
          const hoveredSegment = core?.getSystemProperty?.(
            'hoveredVectorSegment'
          )
          const hoveredInsertPoint = core?.getSystemProperty?.(
            'hoveredVectorSegmentInsertPoint'
          )
          const pathEditingVectorId =
            core?.getSystemProperty?.('pathEditingVectorId') ?? null

          return {
            hoveredPointTarget: hoveredPoint?.target ?? null,
            hoveredSegmentId: hoveredSegment?.segmentId ?? null,
            hoveredInsertPointX: hoveredInsertPoint?.x ?? null,
            hoveredInsertPointY: hoveredInsertPoint?.y ?? null,
            hoveredInsertPointSegmentId: hoveredInsertPoint?.segmentId ?? null,
            pathEditingVectorId,
            isHoveredSegmentOnEditingVector:
              !!hoveredSegment?.segmentId &&
              !!pathEditingVectorId &&
              hoveredSegment?.elementId === pathEditingVectorId
          }
        })
      })
      .toMatchObject({
        hoveredPointTarget: null,
        hoveredSegmentId: null,
        isHoveredSegmentOnEditingVector: false,
        hoveredInsertPointSegmentId: null
      })

    await page.keyboard.press('Escape')
    await page.waitForTimeout(80)
    await page.mouse.move(segmentClientPos.x, segmentClientPos.y)
    await expect
      .poll(async () => {
        return page.evaluate(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const core = (window as any).__Core__
          const hoveredPoint = core?.getSystemProperty?.('hoveredVectorPoint')
          const hoveredSegment = core?.getSystemProperty?.(
            'hoveredVectorSegment'
          )
          const hoveredInsertPoint = core?.getSystemProperty?.(
            'hoveredVectorSegmentInsertPoint'
          )
          const pathEditingVectorId =
            core?.getSystemProperty?.('pathEditingVectorId') ?? null
          return {
            hoveredPointTarget: hoveredPoint?.target ?? null,
            hoveredSegmentId: hoveredSegment?.segmentId ?? null,
            hoveredInsertPointSegmentId: hoveredInsertPoint?.segmentId ?? null,
            isHoveredSegmentOnEditingVector:
              !!hoveredSegment?.segmentId &&
              !!pathEditingVectorId &&
              hoveredSegment?.elementId === pathEditingVectorId
          }
        })
      })
      .toMatchObject({
        hoveredPointTarget: null,
        isHoveredSegmentOnEditingVector: true,
        hoveredInsertPointSegmentId: expect.any(String)
      })

    const beforeSplit = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      const pathEditingVectorId =
        core?.getSystemProperty?.('pathEditingVectorId') ?? null
      const element =
        pathEditingVectorId &&
        core?.deps?.sceneTree?.getElementById?.(pathEditingVectorId)
      const computed = element?.getAllComputedData?.() ?? {}
      const networks = Object.values(computed.networks ?? {}) as {
        pointIds?: string[]
        segmentIds?: string[]
      }[]
      const primaryNetwork = networks[0]
      return {
        pathEditingVectorId,
        networkCount: networks.length,
        pointCount: (primaryNetwork?.pointIds ?? []).length,
        segmentCount: (primaryNetwork?.segmentIds ?? []).length
      }
    })

    expect(beforeSplit).toMatchObject({
      networkCount: 1,
      pointCount: 2,
      segmentCount: 1
    })

    await page.mouse.click(segmentClientPos.x, segmentClientPos.y)
    await expect
      .poll(async () => {
        return page.evaluate(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const core = (window as any).__Core__
          const selectedPoint = core?.getSystemProperty?.('selectedVectorPoint')
          const selectedSegment = core?.getSystemProperty?.(
            'selectedVectorSegment'
          )
          const pathEditingVectorId =
            core?.getSystemProperty?.('pathEditingVectorId') ?? null
          const element =
            pathEditingVectorId &&
            core?.deps?.sceneTree?.getElementById?.(pathEditingVectorId)
          const computed = element?.getAllComputedData?.() ?? {}
          const networks = Object.values(computed.networks ?? {}) as {
            pointIds?: string[]
            segmentIds?: string[]
          }[]
          const primaryNetwork = networks[0]
          const selectedPointId = selectedPoint?.pointId ?? null
          const segmentIds = primaryNetwork?.segmentIds ?? []
          const segments = computed.segments ?? {}
          const selectedPointSegmentDegree = segmentIds.filter((segmentId) => {
            const segment = segments[segmentId] as
              | { startId?: string; endId?: string }
              | undefined
            return (
              !!selectedPointId &&
              (segment?.startId === selectedPointId ||
                segment?.endId === selectedPointId)
            )
          }).length

          return {
            selectedPointTarget: selectedPoint?.target ?? null,
            selectedSegmentId: selectedSegment?.segmentId ?? null,
            pathEditingVectorId,
            startNewSubpath:
              core?.getSystemProperty?.('pathEditingStartNewSubpath') ?? null,
            networkCount: networks.length,
            pointCount: (primaryNetwork?.pointIds ?? []).length,
            segmentCount: segmentIds.length,
            selectedPointSegmentDegree,
            isSelectedSegmentOnEditingVector:
              !!selectedSegment?.segmentId &&
              !!pathEditingVectorId &&
              selectedSegment?.elementId === pathEditingVectorId
          }
        })
      })
      .toMatchObject({
        selectedPointTarget: 'anchor',
        selectedSegmentId: null,
        isSelectedSegmentOnEditingVector: false,
        startNewSubpath: true,
        networkCount: 1,
        pointCount: 3,
        segmentCount: 2,
        selectedPointSegmentDegree: 2
      })
  })

  test('pen source-select can continue from an arbitrary anchor and connect to another anchor', async ({
    page
  }, testInfo) => {
    const initialCount = await getElementCount(page)

    await page.keyboard.press('p')
    await expect.poll(() => getActiveTool(page)).toBe('pen')
    await clickCanvas(page, 0.3, 0.3)
    await clickCanvas(page, 0.45, 0.4)
    await clickCanvas(page, 0.58, 0.48)
    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 1)

    await page.keyboard.press('v')
    await expect.poll(() => getActiveTool(page)).toBe('select')
    await page.keyboard.press('p')
    await expect.poll(() => getActiveTool(page)).toBe('pen')

    const before = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      const vectorId = core?.getSystemProperty?.('pathEditingVectorId') ?? null
      const element =
        vectorId && core?.deps?.sceneTree?.getElementById?.(vectorId)
      const computed = element?.getAllComputedData?.() ?? {}
      const networks = Object.values(computed.networks ?? {}) as {
        pointIds?: string[]
        segmentIds?: string[]
      }[]
      const primaryNetwork = networks[0]
      return {
        vectorId,
        pointIds: primaryNetwork?.pointIds ?? [],
        networkCount: networks.length,
        segmentCount: networks.reduce(
          (sum, network) => sum + (network.segmentIds?.length ?? 0),
          0
        ),
        startNewSubpath:
          core?.getSystemProperty?.('pathEditingStartNewSubpath') ?? null
      }
    })
    expect(before.vectorId).not.toBeNull()
    expect(before.pointIds.length).toBe(3)
    expect(before).toMatchObject({
      networkCount: 1,
      segmentCount: 2,
      startNewSubpath: true
    })

    const middleAnchorPos = await getCanvasPosition(page, 0.45, 0.4)
    await page.mouse.move(middleAnchorPos.x, middleAnchorPos.y)
    await expect
      .poll(async () => {
        return page.evaluate(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const core = (window as any).__Core__
          const hovered = core?.getSystemProperty?.('hoveredVectorPoint')
          return {
            pointId: hovered?.pointId ?? null,
            target: hovered?.target ?? null
          }
        })
      })
      .toMatchObject({
        pointId: before.pointIds[1],
        target: 'anchor'
      })

    await page.mouse.click(middleAnchorPos.x, middleAnchorPos.y)
    await expect
      .poll(async () => {
        return page.evaluate(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const core = (window as any).__Core__
          const selected = core?.getSystemProperty?.('selectedVectorPoint')
          const vectorId = core?.getSystemProperty?.('pathEditingVectorId')
          const element =
            vectorId && core?.deps?.sceneTree?.getElementById?.(vectorId)
          const computed = element?.getAllComputedData?.() ?? {}
          const networks = Object.values(computed.networks ?? {}) as {
            pointIds?: string[]
            segmentIds?: string[]
          }[]
          return {
            selectedPointId: selected?.pointId ?? null,
            selectedTarget: selected?.target ?? null,
            startNewSubpath:
              core?.getSystemProperty?.('pathEditingStartNewSubpath') ?? null,
            networkCount: networks.length,
            segmentCount: networks.reduce(
              (sum, network) => sum + (network.segmentIds?.length ?? 0),
              0
            )
          }
        })
      })
      .toMatchObject({
        selectedPointId: before.pointIds[1],
        selectedTarget: 'anchor',
        startNewSubpath: false,
        networkCount: 1,
        segmentCount: 2
      })

    await clickCanvas(page, 0.66, 0.34)

    const afterAppend = await page.evaluate(
      ({ sourcePointId }) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const core = (window as any).__Core__
        const vectorId =
          core?.getSystemProperty?.('pathEditingVectorId') ?? null
        const selected = core?.getSystemProperty?.('selectedVectorPoint')
        const element =
          vectorId && core?.deps?.sceneTree?.getElementById?.(vectorId)
        const computed = element?.getAllComputedData?.() ?? {}
        const networks = Object.values(computed.networks ?? {}) as {
          id?: string
          pointIds?: string[]
          segmentIds?: string[]
        }[]
        const segments = computed.segments ?? {}
        const branchNetwork = networks.find(
          (network) =>
            network.pointIds?.length === 2 &&
            network.pointIds?.[0] === sourcePointId &&
            network.pointIds?.[1] === selected?.pointId
        )
        const branchSegment =
          branchNetwork?.segmentIds?.[0] &&
          segments[branchNetwork.segmentIds[0]]

        return {
          selectedPointId: selected?.pointId ?? null,
          selectedTarget: selected?.target ?? null,
          networkCount: networks.length,
          segmentCount: networks.reduce(
            (sum, network) => sum + (network.segmentIds?.length ?? 0),
            0
          ),
          branchStartId: branchSegment?.startId ?? null,
          branchEndId: branchSegment?.endId ?? null
        }
      },
      { sourcePointId: before.pointIds[1] }
    )

    expect(afterAppend.selectedPointId).not.toBeNull()
    expect(afterAppend).toMatchObject({
      selectedTarget: 'anchor',
      networkCount: 2,
      segmentCount: 3,
      branchStartId: before.pointIds[1],
      branchEndId: afterAppend.selectedPointId
    })

    const firstEndpointPos = await getCanvasPosition(page, 0.3, 0.3)
    await page.mouse.click(firstEndpointPos.x, firstEndpointPos.y)

    await expect
      .poll(async () => {
        return page.evaluate(
          ({ sourcePointId, targetPointId }) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const core = (window as any).__Core__
            const vectorId = core?.getSystemProperty?.('pathEditingVectorId')
            const element =
              vectorId && core?.deps?.sceneTree?.getElementById?.(vectorId)
            const computed = element?.getAllComputedData?.() ?? {}
            const networks = Object.values(computed.networks ?? {}) as {
              pointIds?: string[]
              segmentIds?: string[]
            }[]
            const segments = Object.values(computed.segments ?? {}) as {
              startId?: string
              endId?: string
            }[]
            const selected = core?.getSystemProperty?.('selectedVectorPoint')

            return {
              selectedPointId: selected?.pointId ?? null,
              hasTargetConnection: segments.some(
                (segment) =>
                  segment.startId === sourcePointId &&
                  segment.endId === targetPointId
              ),
              networkCount: networks.length,
              segmentCount: networks.reduce(
                (sum, network) => sum + (network.segmentIds?.length ?? 0),
                0
              )
            }
          },
          {
            sourcePointId: afterAppend.selectedPointId,
            targetPointId: before.pointIds[0]
          }
        )
      })
      .toMatchObject({
        selectedPointId: before.pointIds[0],
        hasTargetConnection: true,
        networkCount: 3,
        segmentCount: 4
      })

    await page.screenshot({
      path: testInfo.outputPath('arbitrary-anchor-connect.png'),
      fullPage: true
    })
  })

  test('split mode enables ghost insert point while connected preview mode keeps it hidden', async ({
    page
  }) => {
    const initialCount = await getElementCount(page)

    await page.keyboard.press('p')
    await expect.poll(() => getActiveTool(page)).toBe('pen')
    await clickCanvas(page, 0.3, 0.3)
    await clickCanvas(page, 0.45, 0.4)
    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 1)

    const segmentClientPos = await getCanvasPosition(page, 0.375, 0.35)
    await page.mouse.move(segmentClientPos.x, segmentClientPos.y)

    await expect
      .poll(async () => {
        return page.evaluate(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const core = (window as any).__Core__
          const hoveredInsertPoint = core?.getSystemProperty?.(
            'hoveredVectorSegmentInsertPoint'
          )
          return hoveredInsertPoint?.segmentId ?? null
        })
      })
      .toBeNull()

    await page.keyboard.press('Escape')
    await page.waitForTimeout(80)
    await page.mouse.move(segmentClientPos.x, segmentClientPos.y)

    await expect
      .poll(async () => {
        return page.evaluate(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const core = (window as any).__Core__
          const hoveredInsertPoint = core?.getSystemProperty?.(
            'hoveredVectorSegmentInsertPoint'
          )
          return hoveredInsertPoint?.segmentId ?? null
        })
      })
      .toEqual(expect.any(String))
  })

  test('select mode hovers and selects segment in path-editing mode', async ({
    page
  }) => {
    const initialCount = await getElementCount(page)

    await page.keyboard.press('p')
    await expect.poll(() => getActiveTool(page)).toBe('pen')
    await clickCanvas(page, 0.3, 0.3)
    await clickCanvas(page, 0.45, 0.4)
    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 1)

    await page.keyboard.press('v')
    await expect.poll(() => getActiveTool(page)).toBe('select')

    const segmentClientPos = await getCanvasPosition(page, 0.375, 0.35)
    await page.mouse.move(segmentClientPos.x, segmentClientPos.y)

    await expect
      .poll(async () => {
        return page.evaluate(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const core = (window as any).__Core__
          const hoveredPoint = core?.getSystemProperty?.('hoveredVectorPoint')
          const hoveredSegment = core?.getSystemProperty?.(
            'hoveredVectorSegment'
          )
          const hoveredInsertPoint = core?.getSystemProperty?.(
            'hoveredVectorSegmentInsertPoint'
          )
          const pathEditingVectorId =
            core?.getSystemProperty?.('pathEditingVectorId') ?? null

          return {
            hoveredPointTarget: hoveredPoint?.target ?? null,
            hoveredSegmentId: hoveredSegment?.segmentId ?? null,
            hoveredInsertPointSegmentId: hoveredInsertPoint?.segmentId ?? null,
            isHoveredSegmentOnEditingVector:
              !!hoveredSegment?.segmentId &&
              !!pathEditingVectorId &&
              hoveredSegment?.elementId === pathEditingVectorId
          }
        })
      })
      .toMatchObject({
        hoveredPointTarget: null,
        hoveredSegmentId: expect.any(String),
        hoveredInsertPointSegmentId: null,
        isHoveredSegmentOnEditingVector: true
      })

    const hoveredSegmentId = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      const hoveredSegment = core?.getSystemProperty?.('hoveredVectorSegment')
      return hoveredSegment?.segmentId ?? null
    })

    expect(hoveredSegmentId).not.toBeNull()
    if (!hoveredSegmentId) {
      return
    }

    await page.mouse.click(segmentClientPos.x, segmentClientPos.y)

    await expect
      .poll(async () => {
        return page.evaluate(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const core = (window as any).__Core__
          const selectedPoint = core?.getSystemProperty?.('selectedVectorPoint')
          const selectedSegment = core?.getSystemProperty?.(
            'selectedVectorSegment'
          )
          const pathEditingVectorId =
            core?.getSystemProperty?.('pathEditingVectorId') ?? null

          return {
            selectedPointTarget: selectedPoint?.target ?? null,
            selectedSegmentId: selectedSegment?.segmentId ?? null,
            isSelectedSegmentOnEditingVector:
              !!selectedSegment?.segmentId &&
              !!pathEditingVectorId &&
              selectedSegment?.elementId === pathEditingVectorId
          }
        })
      })
      .toMatchObject({
        selectedPointTarget: null,
        selectedSegmentId: hoveredSegmentId,
        isSelectedSegmentOnEditingVector: true
      })
  })

  test('path editing blocks hover/selection on non-editing elements', async ({
    page
  }) => {
    await createRectangle(page, 0.72, 0.28)
    const initialCount = await getElementCount(page)

    await page.keyboard.press('p')
    await expect.poll(() => getActiveTool(page)).toBe('pen')
    await clickCanvas(page, 0.3, 0.3)
    await clickCanvas(page, 0.45, 0.4)
    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 1)

    await page.keyboard.press('v')
    await expect.poll(() => getActiveTool(page)).toBe('select')

    const rectanglePos = await getCanvasPosition(page, 0.72, 0.28)
    await page.mouse.move(rectanglePos.x, rectanglePos.y)
    await page.mouse.click(rectanglePos.x, rectanglePos.y)

    await expect
      .poll(async () => {
        return page.evaluate(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const core = (window as any).__Core__
          const hoveredElementId =
            core?.getSystemProperty?.('hoveredElementId') ?? null
          const pathEditingVectorId =
            core?.getSystemProperty?.('pathEditingVectorId') ?? null
          const selectedIds = Array.from(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ((core?.getUIProperty?.('elementSelection') as any) ??
              new Set<string>()) as Set<string>
          )

          return (
            !!pathEditingVectorId &&
            hoveredElementId === null &&
            selectedIds.length === 1 &&
            selectedIds[0] === pathEditingVectorId
          )
        })
      })
      .toBe(true)
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

  test('split mode click on endpoint selects it before continuing subpath append', async ({
    page
  }) => {
    const initialCount = await getElementCount(page)

    await page.keyboard.press('p')
    await expect.poll(() => getActiveTool(page)).toBe('pen')
    await clickCanvas(page, 0.3, 0.3)
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

    await clickCanvas(page, 0.45, 0.4)
    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 1)

    // Enter split/new-subpath mode.
    await page.keyboard.press('Escape')
    await page.waitForTimeout(80)

    const firstPointPos = await getCanvasPosition(page, 0.3, 0.3)
    await page.mouse.click(firstPointPos.x, firstPointPos.y)

    // Click-on-anchor should only select anchor, not create a new point.
    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 1)
    await expect
      .poll(async () => {
        return page.evaluate(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const core = (window as any).__Core__
          const selected = core?.getSystemProperty?.('selectedVectorPoint')
          const split = core?.getSystemProperty?.('pathEditingStartNewSubpath')
          return {
            pointId: selected?.pointId ?? null,
            target: selected?.target ?? null,
            split
          }
        })
      })
      .toMatchObject({
        pointId: firstPointId,
        target: 'anchor',
        split: false
      })

    await clickCanvas(page, 0.22, 0.22)
    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 1)
  })

  test('connected endpoint click merges two subpaths into one subpath', async ({
    page
  }) => {
    const initialCount = await getElementCount(page)

    await page.keyboard.press('p')
    await expect.poll(() => getActiveTool(page)).toBe('pen')
    await clickCanvas(page, 0.3, 0.3)
    await clickCanvas(page, 0.42, 0.35)
    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 1)

    await page.keyboard.press('Escape')
    await page.waitForTimeout(80)
    await clickCanvas(page, 0.66, 0.5)
    await clickCanvas(page, 0.78, 0.56)

    await expect
      .poll(async () => {
        return page.evaluate(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const core = (window as any).__Core__
          const pathEditingVectorId =
            core?.getSystemProperty?.('pathEditingVectorId') ?? null
          const element =
            pathEditingVectorId &&
            core?.deps?.sceneTree?.getElementById?.(pathEditingVectorId)
          const computed = element?.getAllComputedData?.() ?? {}
          const networks = Object.values(computed.networks ?? {}) as {
            pointIds?: string[]
            segmentIds?: string[]
          }[]

          return {
            networkCount: networks.length,
            totalPointCount: networks.reduce(
              (sum, network) => sum + (network.pointIds?.length ?? 0),
              0
            ),
            totalSegmentCount: networks.reduce(
              (sum, network) => sum + (network.segmentIds?.length ?? 0),
              0
            ),
            startNewSubpath:
              core?.getSystemProperty?.('pathEditingStartNewSubpath') ?? null
          }
        })
      })
      .toMatchObject({
        networkCount: 2,
        totalPointCount: 4,
        totalSegmentCount: 2,
        startNewSubpath: false
      })

    const firstEndpointPos = await getCanvasPosition(page, 0.3, 0.3)
    await page.mouse.move(firstEndpointPos.x, firstEndpointPos.y)
    await expect
      .poll(async () => {
        return page.evaluate(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const core = (window as any).__Core__
          const hoveredPoint = core?.getSystemProperty?.('hoveredVectorPoint')
          const hoveredInsertPoint = core?.getSystemProperty?.(
            'hoveredVectorSegmentInsertPoint'
          )

          return {
            hoveredTarget: hoveredPoint?.target ?? null,
            hoveredInsertPointSegmentId: hoveredInsertPoint?.segmentId ?? null
          }
        })
      })
      .toMatchObject({
        hoveredTarget: 'anchor',
        hoveredInsertPointSegmentId: null
      })

    await page.mouse.click(firstEndpointPos.x, firstEndpointPos.y)

    await expect
      .poll(async () => {
        return page.evaluate(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const core = (window as any).__Core__
          const pathEditingVectorId =
            core?.getSystemProperty?.('pathEditingVectorId') ?? null
          const element =
            pathEditingVectorId &&
            core?.deps?.sceneTree?.getElementById?.(pathEditingVectorId)
          const computed = element?.getAllComputedData?.() ?? {}
          const networks = Object.values(computed.networks ?? {}) as {
            pointIds?: string[]
            segmentIds?: string[]
            closed?: boolean
          }[]
          const selectedPoint = core?.getSystemProperty?.('selectedVectorPoint')

          return {
            networkCount: networks.length,
            totalPointCount: networks.reduce(
              (sum, network) => sum + (network.pointIds?.length ?? 0),
              0
            ),
            totalSegmentCount: networks.reduce(
              (sum, network) => sum + (network.segmentIds?.length ?? 0),
              0
            ),
            closedCount: networks.filter((network) => network.closed).length,
            startNewSubpath:
              core?.getSystemProperty?.('pathEditingStartNewSubpath') ?? null,
            selectedTarget: selectedPoint?.target ?? null
          }
        })
      })
      .toMatchObject({
        networkCount: 1,
        totalPointCount: 4,
        totalSegmentCount: 3,
        closedCount: 0,
        startNewSubpath: false,
        selectedTarget: 'anchor'
      })
  })

  test('connected endpoint click on opposite side closes current subpath', async ({
    page
  }) => {
    const initialCount = await getElementCount(page)

    await page.keyboard.press('p')
    await expect.poll(() => getActiveTool(page)).toBe('pen')
    await clickCanvas(page, 0.3, 0.3)
    await clickCanvas(page, 0.45, 0.4)
    await clickCanvas(page, 0.58, 0.48)
    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 1)

    const firstEndpointPos = await getCanvasPosition(page, 0.3, 0.3)
    await page.mouse.move(firstEndpointPos.x, firstEndpointPos.y)
    await expect
      .poll(async () => {
        return page.evaluate(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const core = (window as any).__Core__
          const hoveredPoint = core?.getSystemProperty?.('hoveredVectorPoint')
          const hoveredInsertPoint = core?.getSystemProperty?.(
            'hoveredVectorSegmentInsertPoint'
          )

          return {
            hoveredTarget: hoveredPoint?.target ?? null,
            hoveredInsertPointSegmentId: hoveredInsertPoint?.segmentId ?? null
          }
        })
      })
      .toMatchObject({
        hoveredTarget: 'anchor',
        hoveredInsertPointSegmentId: null
      })

    await page.mouse.click(firstEndpointPos.x, firstEndpointPos.y)

    await expect
      .poll(async () => {
        return page.evaluate(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const core = (window as any).__Core__
          const pathEditingVectorId =
            core?.getSystemProperty?.('pathEditingVectorId') ?? null
          const element =
            pathEditingVectorId &&
            core?.deps?.sceneTree?.getElementById?.(pathEditingVectorId)
          const computed = element?.getAllComputedData?.() ?? {}
          const networks = Object.values(computed.networks ?? {}) as {
            pointIds?: string[]
            segmentIds?: string[]
            closed?: boolean
          }[]
          const selectedPoint = core?.getSystemProperty?.('selectedVectorPoint')

          return {
            networkCount: networks.length,
            totalPointCount: networks.reduce(
              (sum, network) => sum + (network.pointIds?.length ?? 0),
              0
            ),
            totalSegmentCount: networks.reduce(
              (sum, network) => sum + (network.segmentIds?.length ?? 0),
              0
            ),
            closedCount: networks.filter((network) => network.closed).length,
            computedClosed: computed.closed ?? null,
            startNewSubpath:
              core?.getSystemProperty?.('pathEditingStartNewSubpath') ?? null,
            selectedTarget: selectedPoint?.target ?? null
          }
        })
      })
      .toMatchObject({
        networkCount: 1,
        totalPointCount: 3,
        totalSegmentCount: 3,
        closedCount: 1,
        computedClosed: true,
        startNewSubpath: false,
        selectedTarget: 'anchor'
      })
  })

  test('escape uses split-then-exit semantics before creating a new vector', async ({
    page
  }, testInfo) => {
    const initialCount = await getElementCount(page)

    await page.keyboard.press('p')
    await expect.poll(() => getActiveTool(page)).toBe('pen')

    await clickCanvas(page, 0.3, 0.3)
    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 1)

    await clickCanvas(page, 0.45, 0.4)
    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 1)

    // First escape: keep pen editing mode but start a new subpath in same vector.
    await page.keyboard.press('Escape')
    await expect
      .poll(async () => {
        return page.evaluate(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const core = (window as any).__Core__
          return {
            activeTool: core?.getSystemProperty?.('primaryTool') ?? null,
            pathEditingVectorId:
              core?.getSystemProperty?.('pathEditingVectorId') ?? null,
            startNewSubpath:
              core?.getSystemProperty?.('pathEditingStartNewSubpath') ?? null,
            continuation:
              core?.getSystemProperty?.('pathEditingContinuation') ?? null
          }
        })
      })
      .toMatchObject({
        activeTool: 'pen',
        pathEditingVectorId: expect.any(String),
        startNewSubpath: true,
        continuation: null
      })
    await page.screenshot({
      path: testInfo.outputPath('pen-escape-disconnect.png')
    })

    // Second consecutive escape: exit path editing mode while staying in pen tool.
    await page.keyboard.press('Escape')
    await expect.poll(() => getActiveTool(page)).toBe('pen')
    await expect
      .poll(async () => {
        return page.evaluate(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const core = (window as any).__Core__
          return core?.getSystemProperty?.('pathEditingVectorId') ?? null
        })
      })
      .toBeNull()

    // Create a new vector while pen tool stays active.
    await clickCanvas(page, 0.65, 0.5)
    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 2)
  })

  test('escape removes a single-point subpath created after disconnecting pen continuation', async ({
    page
  }, testInfo) => {
    const initialCount = await getElementCount(page)

    await page.keyboard.press('p')
    await expect.poll(() => getActiveTool(page)).toBe('pen')

    await clickCanvas(page, 0.3, 0.72)
    await clickCanvas(page, 0.47, 0.35)
    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 1)

    await page.keyboard.press('Escape')
    await expect
      .poll(async () => {
        return page.evaluate(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const core = (window as any).__Core__
          return {
            pathEditingVectorId:
              core?.getSystemProperty?.('pathEditingVectorId') ?? null,
            startNewSubpath:
              core?.getSystemProperty?.('pathEditingStartNewSubpath') ?? null
          }
        })
      })
      .toMatchObject({
        pathEditingVectorId: expect.any(String),
        startNewSubpath: true
      })

    await clickCanvas(page, 0.73, 0.28)
    await expect
      .poll(async () => {
        return page.evaluate(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const core = (window as any).__Core__
          const pathEditingVectorId =
            core?.getSystemProperty?.('pathEditingVectorId') ?? null
          const element =
            pathEditingVectorId &&
            core?.deps?.sceneTree?.getElementById?.(pathEditingVectorId)
          const computed = element?.getAllComputedData?.() ?? {}
          const networks = Object.values(computed.networks ?? {}) as {
            pointIds?: string[]
          }[]

          return {
            networkCount: networks.length,
            totalPointCount: networks.reduce(
              (sum, network) => sum + (network.pointIds?.length ?? 0),
              0
            ),
            singlePointSubpathCount: networks.filter(
              (network) => (network.pointIds?.length ?? 0) === 1
            ).length,
            startNewSubpath:
              core?.getSystemProperty?.('pathEditingStartNewSubpath') ?? null
          }
        })
      })
      .toMatchObject({
        networkCount: 2,
        totalPointCount: 3,
        singlePointSubpathCount: 1,
        startNewSubpath: false
      })

    await page.keyboard.press('Escape')
    await expect
      .poll(async () => {
        return page.evaluate(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const core = (window as any).__Core__
          const pathEditingVectorId =
            core?.getSystemProperty?.('pathEditingVectorId') ?? null
          const element =
            pathEditingVectorId &&
            core?.deps?.sceneTree?.getElementById?.(pathEditingVectorId)
          const computed = element?.getAllComputedData?.() ?? {}
          const networks = Object.values(computed.networks ?? {}) as {
            pointIds?: string[]
          }[]
          const selectedVectorPoint =
            core?.getSystemProperty?.('selectedVectorPoint') ?? null

          return {
            pathEditingVectorId,
            networkCount: networks.length,
            totalPointCount: networks.reduce(
              (sum, network) => sum + (network.pointIds?.length ?? 0),
              0
            ),
            singlePointSubpathCount: networks.filter(
              (network) => (network.pointIds?.length ?? 0) === 1
            ).length,
            startNewSubpath:
              core?.getSystemProperty?.('pathEditingStartNewSubpath') ?? null,
            selectedVectorPoint
          }
        })
      })
      .toMatchObject({
        pathEditingVectorId: expect.any(String),
        networkCount: 1,
        totalPointCount: 2,
        singlePointSubpathCount: 0,
        startNewSubpath: true,
        selectedVectorPoint: null
      })

    await page.screenshot({
      path: testInfo.outputPath('pen-escape-removes-single-point-subpath.png')
    })
  })

  test('refresh keeps one render object per vector element id', async ({
    page
  }) => {
    const initialCount = await getElementCount(page)

    await page.keyboard.press('p')
    await expect.poll(() => getActiveTool(page)).toBe('pen')
    await clickCanvas(page, 0.3, 0.3)
    await clickCanvas(page, 0.45, 0.4)
    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 1)

    const beforeReload = await page.evaluate(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const core = (window as any).__Core__
      const elements = core?.deps?.sceneTree?.getAllElements?.()
      let vectorId: string | null = null
      elements?.forEach?.(
        (
          element: { get?: (key: string) => unknown } | undefined,
          id: string
        ) => {
          if (element?.get?.('type') === 'vector') {
            vectorId = id
          }
        }
      )

      const root = core?.deps?.render?.viewport?.view as
        | { label?: string; children?: unknown[] }
        | undefined
      if (!vectorId || !root) {
        return null
      }

      let renderItemCount = 0
      const stack: { label?: string; children?: unknown[] }[] = [root]
      while (stack.length > 0) {
        const current = stack.pop()
        if (!current) {
          continue
        }
        if (current.label === vectorId) {
          renderItemCount += 1
        }
        const children = current.children ?? []
        children.forEach((child: unknown) =>
          stack.push(child as { label?: string; children?: unknown[] })
        )
      }

      return {
        vectorId,
        renderItemCount
      }
    })

    expect(beforeReload).toMatchObject({
      renderItemCount: 1
    })

    await page.reload()
    await waitForAppReady(page)

    await expect
      .poll(async () => {
        return page.evaluate(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const core = (window as any).__Core__
          const elements = core?.deps?.sceneTree?.getAllElements?.()
          let vectorId: string | null = null
          elements?.forEach?.(
            (
              element: { get?: (key: string) => unknown } | undefined,
              id: string
            ) => {
              if (element?.get?.('type') === 'vector') {
                vectorId = id
              }
            }
          )

          const root = core?.deps?.render?.viewport?.view as
            | { label?: string; children?: unknown[] }
            | undefined
          if (!vectorId || !root) {
            return null
          }

          let renderItemCount = 0
          const stack: { label?: string; children?: unknown[] }[] = [root]
          while (stack.length > 0) {
            const current = stack.pop()
            if (!current) {
              continue
            }
            if (current.label === vectorId) {
              renderItemCount += 1
            }
            const children = current.children ?? []
            children.forEach((child: unknown) =>
              stack.push(child as { label?: string; children?: unknown[] })
            )
          }

          return {
            renderItemCount
          }
        })
      })
      .toMatchObject({
        renderItemCount: 1
      })
  })
})
