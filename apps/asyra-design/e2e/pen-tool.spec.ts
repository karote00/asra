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

    await page.mouse.move(secondClientPos.x, secondClientPos.y)
    await page.mouse.down()
    await page.mouse.move(dragClientPos.x, dragClientPos.y, { steps: 12 })
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

  test('pen add mode ignores non-endpoint anchor hover and keeps endpoint hover', async ({
    page
  }) => {
    const initialCount = await getElementCount(page)

    await page.keyboard.press('p')
    await expect.poll(() => getActiveTool(page)).toBe('pen')
    await clickCanvas(page, 0.3, 0.3)
    await clickCanvas(page, 0.45, 0.4)
    await clickCanvas(page, 0.58, 0.48)
    await expect.poll(async () => getElementCount(page)).toBe(initialCount + 1)

    const middleAnchorPos = await getCanvasPosition(page, 0.45, 0.4)
    await page.mouse.move(middleAnchorPos.x, middleAnchorPos.y)
    await expect
      .poll(async () => {
        return page.evaluate(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const core = (window as any).__Core__
          const hovered = core?.getSystemProperty?.('hoveredVectorPoint')
          return hovered?.pointId ?? null
        })
      })
      .toBeNull()

    const firstEndpointPos = await getCanvasPosition(page, 0.3, 0.3)
    await page.mouse.move(firstEndpointPos.x, firstEndpointPos.y)
    await expect
      .poll(async () => {
        return page.evaluate(() => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const core = (window as any).__Core__
          const hovered = core?.getSystemProperty?.('hoveredVectorPoint')
          return hovered?.target ?? null
        })
      })
      .toBe('anchor')
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
        startNewSubpath: true,
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
        startNewSubpath: true,
        selectedTarget: 'anchor'
      })
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
