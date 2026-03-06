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

  test('prepend-point drag in path editing places new in-handle at drag direction', async ({
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
        pointId: selectedPointId,
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
            : null
      }
    })

    expect(beforeMove).not.toBeNull()
    if (!beforeMove) {
      return
    }

    const deltaX = 40
    const nextX = Math.round(beforeMove.anchorX + deltaX)
    const xInput = page.getByTestId('prop-point-x')
    await xInput.click()
    await xInput.fill(String(nextX))
    await xInput.press('Enter')

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
                Math.abs(inHandleAfter.x + offsetX - inHandle.x - actualDeltaX) <
                  epsilon &&
                Math.abs(inHandleAfter.y + offsetY - inHandle.y) < epsilon)
            const outHandleFollowed =
              !outHandle ||
              (outHandleAfter?.kind === 'control' &&
                Math.abs(outHandleAfter.x + offsetX - outHandle.x - actualDeltaX) <
                  epsilon &&
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
            expectedDeltaX: nextX - beforeMove.anchorX
          }
        )
      })
      .toMatchObject({
        anchorMovedAsExpected: true,
        inHandleFollowed: true,
        outHandleFollowed: true
      })
  })

  test('pen mode segment click splits in-place and inserted point is shared by two segments', async ({
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
          const hoveredSegment =
            core?.getSystemProperty?.('hoveredVectorSegment')
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
          const hoveredSegment =
            core?.getSystemProperty?.('hoveredVectorSegment')
          const hoveredInsertPoint =
            core?.getSystemProperty?.('hoveredVectorSegmentInsertPoint')
          const pathEditingVectorId =
            core?.getSystemProperty?.('pathEditingVectorId') ?? null

          return {
            hoveredPointTarget: hoveredPoint?.target ?? null,
            hoveredSegmentId: hoveredSegment?.segmentId ?? null,
            hoveredInsertPointX: hoveredInsertPoint?.x ?? null,
            hoveredInsertPointY: hoveredInsertPoint?.y ?? null,
            hoveredInsertPointSegmentId:
              hoveredInsertPoint?.segmentId ?? null,
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
          const selectedSegment =
            core?.getSystemProperty?.('selectedVectorSegment')
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
        networkCount: 1,
        pointCount: 3,
        segmentCount: 2,
        selectedPointSegmentDegree: 2
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
      elements?.forEach?.((element: any, id: string) => {
        if (element?.get?.('type') === 'vector') {
          vectorId = id
        }
      })

      const root = core?.deps?.render?.viewport?.view
      if (!vectorId || !root) {
        return null
      }

      let renderItemCount = 0
      const stack = [root]
      while (stack.length > 0) {
        const current = stack.pop() as any
        if (!current) {
          continue
        }
        if (current.label === vectorId) {
          renderItemCount += 1
        }
        const children = current.children ?? []
        children.forEach((child: any) => stack.push(child))
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
          elements?.forEach?.((element: any, id: string) => {
            if (element?.get?.('type') === 'vector') {
              vectorId = id
            }
          })

          const root = core?.deps?.render?.viewport?.view
          if (!vectorId || !root) {
            return null
          }

          let renderItemCount = 0
          const stack = [root]
          while (stack.length > 0) {
            const current = stack.pop() as any
            if (!current) {
              continue
            }
            if (current.label === vectorId) {
              renderItemCount += 1
            }
            const children = current.children ?? []
            children.forEach((child: any) => stack.push(child))
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
