import { expect, test, type Page } from '@playwright/test'

import {
  captureBrowserErrors,
  createTestDocumentURL,
  getCapturedBrowserErrors,
  resetCanvas,
  waitForAppReady
} from './test-utils'

const createStarTopology = () => {
  const center = { x: 420, y: 300 }
  const outerRadius = 110
  const innerRadius = 44
  const orderedPointIds = Array.from({ length: 10 }, (_, index) => `p${index}`)
  const points = Object.fromEntries(
    orderedPointIds.map((id, index) => {
      const angle =
        -Math.PI / 2 + (Math.PI * 2 * index) / orderedPointIds.length
      const radius = index % 2 === 0 ? outerRadius : innerRadius
      return [
        id,
        {
          id,
          kind: 'anchor',
          anchorType: 'sharp',
          x: center.x + Math.cos(angle) * radius,
          y: center.y + Math.sin(angle) * radius
        }
      ]
    })
  )
  const segments = Object.fromEntries(
    orderedPointIds.map((pointId, index) => {
      const nextPointId = orderedPointIds[(index + 1) % orderedPointIds.length]
      return [
        `s${index}`,
        {
          id: `s${index}`,
          startId: pointId,
          endId: nextPointId,
          outControlId: null,
          inControlId: null
        }
      ]
    })
  )
  const networks = {
    n0: {
      id: 'n0',
      pointIds: orderedPointIds,
      segmentIds: orderedPointIds.map((_, index) => `s${index}`),
      closed: true
    }
  }

  return { points, segments, networks }
}

const getStarWorkspacePoints = () =>
  Object.values(createStarTopology().points) as { x: number; y: number }[]

const workspaceToClient = async (page: Page, point: { x: number; y: number }) =>
  page.evaluate(async (workspacePoint) => {
    const core = (await import('../src/testing/runtime-access')).core
    const zoom = core?.getSystemProperty?.('zoom') ?? 1
    const viewport = core?.getSystemProperty?.('viewportPosition') ?? {
      x: 0,
      y: 0
    }

    return {
      x: workspacePoint.x * zoom + viewport.x,
      y: workspacePoint.y * zoom + viewport.y
    }
  }, point)

const setSelectedVectorStrokeData = async (page: Page) => {
  await page.evaluate(async () => {
    const core = (await import('../src/testing/runtime-access')).core

    const elementApis = (await import('../src/testing/runtime-access'))
      .elementApis
    const selectedId =
      core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
    if (!selectedId || !elementApis) {
      throw new Error('Missing selected vector for stroke styling')
    }

    elementApis.patchElementProperties(
      [
        {
          elementId: selectedId,
          records: [
            {
              key: 'strokes',
              set: {
                'vector-invariant-stroke': {
                  style: 'solid',
                  position: 'center',
                  width: 12,
                  dash: 20,
                  gap: 20,
                  fill: {
                    kind: 'solid',
                    defaultColorFormat: 'hex',
                    colorFormat: 'hex',
                    color: '#df0606',
                    opacity: 0.75,
                    visible: true,
                    gradient: null
                  },
                  joinType: 'miter',
                  capType: 'butt',
                  miterAngle: 28.96
                }
              }
            }
          ]
        }
      ],
      { undoable: false }
    )
  })
}

const vectorInvariantProbe = async (page: Page) => {
  return page.evaluate(async () => {
    const core = (await import('../src/testing/runtime-access')).core
    const selectedId =
      core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
    if (!selectedId) {
      throw new Error('No selected vector available')
    }

    const element = core?.deps?.sceneTree?.getElementById?.(selectedId)
    const computed = element?.getAllComputedData?.() ?? {}
    const render = core?.deps?.render
    const renderElement = core?.deps?.render?.getElementById?.(selectedId)
    const points = computed.points ?? {}
    const anchorPoints = Object.values(points).filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (point: any) => point?.kind === 'anchor'
    ) as { id: string; x: number; y: number }[]
    const anchorBounds = anchorPoints.reduce(
      (bounds, point) => ({
        minX: Math.min(bounds.minX, point.x),
        minY: Math.min(bounds.minY, point.y),
        maxX: Math.max(bounds.maxX, point.x),
        maxY: Math.max(bounds.maxY, point.y)
      }),
      {
        minX: Number.POSITIVE_INFINITY,
        minY: Number.POSITIVE_INFINITY,
        maxX: Number.NEGATIVE_INFINITY,
        maxY: Number.NEGATIVE_INFINITY
      }
    )
    const includeGeometryPoint = (
      bounds: {
        minX: number
        minY: number
        maxX: number
        maxY: number
      },
      point: { x: number; y: number }
    ) => {
      bounds.minX = Math.min(bounds.minX, point.x)
      bounds.minY = Math.min(bounds.minY, point.y)
      bounds.maxX = Math.max(bounds.maxX, point.x)
      bounds.maxY = Math.max(bounds.maxY, point.y)
    }
    const cubicAt = (
      p0: number,
      p1: number,
      p2: number,
      p3: number,
      t: number
    ) => {
      const mt = 1 - t
      return (
        mt * mt * mt * p0 +
        3 * mt * mt * t * p1 +
        3 * mt * t * t * p2 +
        t * t * t * p3
      )
    }
    const cubicExtrema = (p0: number, p1: number, p2: number, p3: number) => {
      const a = -p0 + 3 * p1 - 3 * p2 + p3
      const b = 2 * (p0 - 2 * p1 + p2)
      const c = -p0 + p1
      const values: number[] = []
      if (Math.abs(a) < 1e-9) {
        if (Math.abs(b) > 1e-9) {
          values.push(-c / b)
        }
      } else {
        const discriminant = b * b - 4 * a * c
        if (discriminant >= 0) {
          const root = Math.sqrt(discriminant)
          values.push((-b + root) / (2 * a), (-b - root) / (2 * a))
        }
      }
      return values.filter((t) => t > 0 && t < 1)
    }
    const geometryBounds = anchorPoints.reduce(
      (bounds, point) => {
        includeGeometryPoint(bounds, point)
        return bounds
      },
      {
        minX: Number.POSITIVE_INFINITY,
        minY: Number.POSITIVE_INFINITY,
        maxX: Number.NEGATIVE_INFINITY,
        maxY: Number.NEGATIVE_INFINITY
      }
    )
    Object.values(computed.segments ?? {}).forEach(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (segment: any) => {
        const start = points[segment?.startId]
        const end = points[segment?.endId]
        if (
          start?.kind !== 'anchor' ||
          end?.kind !== 'anchor' ||
          (!segment?.outControlId && !segment?.inControlId)
        ) {
          return
        }

        const outControl = points[segment.outControlId]
        const inControl = points[segment.inControlId]
        const p1 =
          outControl?.kind === 'control'
            ? outControl
            : { x: start.x, y: start.y }
        const p2 =
          inControl?.kind === 'control' ? inControl : { x: end.x, y: end.y }
        cubicExtrema(start.x, p1.x, p2.x, end.x).forEach((t) => {
          includeGeometryPoint(geometryBounds, {
            x: cubicAt(start.x, p1.x, p2.x, end.x, t),
            y: cubicAt(start.y, p1.y, p2.y, end.y, t)
          })
        })
        cubicExtrema(start.y, p1.y, p2.y, end.y).forEach((t) => {
          includeGeometryPoint(geometryBounds, {
            x: cubicAt(start.x, p1.x, p2.x, end.x, t),
            y: cubicAt(start.y, p1.y, p2.y, end.y, t)
          })
        })
      }
    )
    const workspaceAnchorBounds = anchorPoints.reduce(
      (bounds, point) => {
        const workspacePoint = render?.elementLocalToWorkspace?.(
          selectedId,
          point
        )
        if (!workspacePoint) {
          throw new Error('Missing local-to-workspace Render projection')
        }
        return {
          minX: Math.min(bounds.minX, workspacePoint.x),
          minY: Math.min(bounds.minY, workspacePoint.y),
          maxX: Math.max(bounds.maxX, workspacePoint.x),
          maxY: Math.max(bounds.maxY, workspacePoint.y)
        }
      },
      {
        minX: Number.POSITIVE_INFINITY,
        minY: Number.POSITIVE_INFINITY,
        maxX: Number.NEGATIVE_INFINITY,
        maxY: Number.NEGATIVE_INFINITY
      }
    )
    const renderBounds = renderElement?.getBounds?.()
    const localBounds = renderElement?.getLocalBounds?.()

    return {
      selectedId,
      computed: {
        x: computed.x,
        y: computed.y,
        width: computed.width,
        height: computed.height,
        pointCoordinateSpace: computed.pointCoordinateSpace,
        pointCount: Object.keys(points).length,
        segmentCount: Object.keys(computed.segments ?? {}).length,
        networkCount: Object.keys(computed.networks ?? {}).length
      },
      anchorBounds: {
        x: anchorBounds.minX,
        y: anchorBounds.minY,
        width: anchorBounds.maxX - anchorBounds.minX,
        height: anchorBounds.maxY - anchorBounds.minY
      },
      geometryBounds: {
        x: geometryBounds.minX,
        y: geometryBounds.minY,
        width: geometryBounds.maxX - geometryBounds.minX,
        height: geometryBounds.maxY - geometryBounds.minY
      },
      workspaceAnchorBounds: {
        x: workspaceAnchorBounds.minX,
        y: workspaceAnchorBounds.minY,
        width: workspaceAnchorBounds.maxX - workspaceAnchorBounds.minX,
        height: workspaceAnchorBounds.maxY - workspaceAnchorBounds.minY
      },
      render: {
        exists: Boolean(renderElement),
        visible: renderElement?.visible ?? null,
        x: renderElement?.x ?? null,
        y: renderElement?.y ?? null,
        renderBounds: renderBounds
          ? {
              x: renderBounds.x,
              y: renderBounds.y,
              width: renderBounds.width,
              height: renderBounds.height
            }
          : null,
        localBounds: localBounds
          ? {
              x: localBounds.x,
              y: localBounds.y,
              width: localBounds.width,
              height: localBounds.height
            }
          : null
      }
    }
  })
}

const expectLocalVectorInvariants = async (
  page: Page,
  _label = 'selected vector'
) => {
  const summary = await vectorInvariantProbe(page)
  expect(summary.computed.pointCoordinateSpace).toBe('local')
  expect(summary.computed.width).toBeCloseTo(summary.geometryBounds.width, 4)
  expect(summary.computed.height).toBeCloseTo(summary.geometryBounds.height, 4)
  expect(summary.workspaceAnchorBounds.width).toBeCloseTo(
    summary.anchorBounds.width,
    4
  )
  expect(summary.workspaceAnchorBounds.height).toBeCloseTo(
    summary.anchorBounds.height,
    4
  )
  expect(summary.render.exists).toBe(true)
  expect(summary.render.visible).toBe(true)
  expect(summary.render.x).toBeCloseTo(summary.computed.x, 4)
  expect(summary.render.y).toBeCloseTo(summary.computed.y, 4)

  return summary
}

const getLastUndoPatchSummary = async (page: Page) =>
  page.evaluate(async () => {
    const core = (await import('../src/testing/runtime-access')).core
    const stack = core?.deps?.factory?.transact?.undoStack ?? []
    const last = stack[stack.length - 1]
    const events = (last?.entries ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (entry: any) => entry.event
    )
    const selectedElementId =
      core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
    const selectedElement =
      selectedElementId &&
      core?.deps?.sceneTree?.getElementById?.(selectedElementId)
    const closedPropertyId = selectedElement?.props?.getPropId?.('closed')
    const valueKeys = new Set<string>()
    const pointSetIds = new Set<string>()
    const pointRemoveIds = new Set<string>()
    const segmentSetIds = new Set<string>()
    const segmentRemoveIds = new Set<string>()
    const networkSetIds = new Set<string>()
    const networkRemoveIds = new Set<string>()
    const collectRecord = (
      record: { id?: unknown; type?: unknown },
      mode: 'set' | 'remove'
    ) => {
      if (typeof record.id !== 'string') {
        return
      }
      let target: Set<string> | null = null
      if (record.type === 'vectorPoint') {
        target = mode === 'set' ? pointSetIds : pointRemoveIds
      } else if (record.type === 'vectorSegment') {
        target = mode === 'set' ? segmentSetIds : segmentRemoveIds
      } else if (record.type === 'vectorNetwork') {
        target = mode === 'set' ? networkSetIds : networkRemoveIds
      }
      target?.add(record.id)
    }

    events.forEach(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (event: any) => {
        const payload = event?.payload ?? {}
        if (event?.type === 'addProperty' || event?.type === 'removeProperty') {
          const mode = event.type === 'addProperty' ? 'set' : 'remove'
          ;(Array.isArray(payload.data) ? payload.data : []).forEach(
            (record: { id?: unknown; type?: unknown }) =>
              collectRecord(record, mode)
          )
          return
        }
        if (event?.type !== 'updateProperty') {
          return
        }
        if (payload.id === closedPropertyId) {
          valueKeys.add('closed')
        }
        const property = core?.deps?.props?.getPropertyById?.(payload.id)
        collectRecord(
          {
            id: payload.id,
            type: property?.get?.('type')
          },
          'set'
        )
      }
    )

    return {
      changeTypes: events.map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (event: any) => event?.type
      ),
      valueKeys: [...valueKeys],
      pointSetIds: [...pointSetIds],
      pointRemoveIds: [...pointRemoveIds],
      segmentSetIds: [...segmentSetIds],
      segmentRemoveIds: [...segmentRemoveIds],
      networkSetIds: [...networkSetIds],
      networkRemoveIds: [...networkRemoveIds]
    }
  })

const expectOnlyComputedPatchUndo = (summary: { changeTypes: string[] }) => {
  expect(summary.changeTypes.length).toBeGreaterThan(0)
  expect(
    summary.changeTypes.every((type) =>
      ['addProperty', 'removeProperty', 'updateProperty'].includes(type)
    )
  ).toBe(true)
}

test.describe('Vector app-flow invariants', () => {
  test.beforeEach(async ({ page }) => {
    captureBrowserErrors(page)

    await page.goto(createTestDocumentURL())
    await waitForAppReady(page)
    await resetCanvas(page)
  })

  test.afterEach(async ({ page }) => {
    expect(getCapturedBrowserErrors(page)).toEqual([])
  })

  test('keeps scene-tree, render graphic, and path-editing overlay aligned after star create and point update', async ({
    page
  }) => {
    await page.evaluate(async (topology) => {
      const core = (await import('../src/testing/runtime-access')).core

      const elementApis = (await import('../src/testing/runtime-access'))
        .elementApis
      if (!core || !elementApis) {
        throw new Error('Missing E2E core or element APIs')
      }

      const createdId = elementApis.createElement(
        {
          type: 'vector',
          points: topology.points,
          segments: topology.segments,
          networks: topology.networks,
          closed: true
        },
        { undoable: false }
      )
      if (!createdId) {
        throw new Error('Failed to create vector star')
      }

      elementApis.patchElementProperties(
        [
          {
            elementId: createdId,
            records: [
              {
                key: 'fills',
                set: {
                  'vector-invariant-fill': {
                    kind: 'solid',
                    defaultColorFormat: 'hex',
                    colorFormat: 'hex',
                    color: '#d5d5d5',
                    opacity: 1,
                    visible: true,
                    gradient: null
                  }
                }
              },
              {
                key: 'strokes',
                set: {
                  'vector-invariant-stroke': {
                    style: 'solid',
                    position: 'center',
                    width: 12,
                    dash: 20,
                    gap: 20,
                    fill: {
                      kind: 'solid',
                      defaultColorFormat: 'hex',
                      colorFormat: 'hex',
                      color: '#df0606',
                      opacity: 0.75,
                      visible: true,
                      gradient: null
                    },
                    joinType: 'miter',
                    capType: 'butt',
                    miterAngle: 28.96
                  }
                }
              }
            ]
          }
        ],
        { undoable: false }
      )
      core.selectElements?.([createdId], { undoable: false })
      core.setSystemProperty?.('pathEditingVectorId', createdId)
      core.setSystemProperty?.('pathEditingMode', true)
    }, createStarTopology())

    await page.waitForTimeout(250)

    const created = await expectLocalVectorInvariants(page, 'star:create')
    expect(created.computed.pointCount).toBe(10)
    expect(created.computed.segmentCount).toBe(10)
    expect(created.computed.networkCount).toBe(1)

    await page.evaluate(async () => {
      const core = (await import('../src/testing/runtime-access')).core

      const elementApis = (await import('../src/testing/runtime-access'))
        .elementApis
      const selectedId =
        core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
      const point = core?.deps?.sceneTree
        ?.getElementById?.(selectedId)
        ?.getAllComputedData?.()?.points?.p0
      if (!selectedId || !point) {
        throw new Error('Missing selected vector point for update')
      }
      const workspacePoint = core?.deps?.render?.elementLocalToWorkspace?.(
        selectedId,
        point
      )
      if (!workspacePoint) {
        throw new Error('Missing local-to-workspace point projection')
      }

      elementApis.updateVectorAnchorPointPosition(
        selectedId,
        'p0',
        { x: workspacePoint.x + 36, y: workspacePoint.y + 24 },
        { undoable: false, skipResult: true }
      )
    })

    await page.waitForTimeout(250)

    await expectLocalVectorInvariants(page, 'star:update-point')
  })

  test('keeps scene-tree, render graphic, and path-editing overlay aligned after pen-created star', async ({
    page
  }) => {
    const starPoints = getStarWorkspacePoints()

    await page.keyboard.press('p')
    await page.waitForTimeout(100)

    for (const point of starPoints) {
      const clientPoint = await workspaceToClient(page, point)
      await page.mouse.click(clientPoint.x, clientPoint.y)
      await page.waitForTimeout(80)
    }

    const firstPoint = await workspaceToClient(page, starPoints[0])
    await page.mouse.click(firstPoint.x, firstPoint.y)
    await setSelectedVectorStrokeData(page)
    await page.waitForTimeout(350)

    const created = await expectLocalVectorInvariants(page, 'pen-star:create')
    expect(created.computed.pointCount).toBe(10)
    expect(created.computed.segmentCount).toBe(10)
    expect(created.computed.networkCount).toBe(1)

    await page.keyboard.press('v')
    await page.waitForTimeout(100)

    const dragStart = await workspaceToClient(page, starPoints[0])
    const dragEnd = await workspaceToClient(page, {
      x: starPoints[0].x + 36,
      y: starPoints[0].y + 24
    })
    await page.mouse.move(dragStart.x, dragStart.y)
    await page.mouse.down()
    await page.mouse.move(dragEnd.x, dragEnd.y, { steps: 12 })
    await page.mouse.up()
    await page.waitForTimeout(350)

    await expectLocalVectorInvariants(page, 'pen-star:drag-point')
  })

  test('keeps full topology operations aligned through append, split, remove, and close', async ({
    page
  }) => {
    await page.evaluate(async () => {
      const core = (await import('../src/testing/runtime-access')).core

      const elementApis = (await import('../src/testing/runtime-access'))
        .elementApis
      if (!core || !elementApis) {
        throw new Error('Missing E2E core or element APIs')
      }

      const elementId = elementApis.createElement(
        {
          type: 'vector',
          points: {
            A: {
              id: 'A',
              kind: 'anchor',
              anchorType: 'sharp',
              x: 260,
              y: 260
            },
            B: {
              id: 'B',
              kind: 'anchor',
              anchorType: 'sharp',
              x: 370,
              y: 210
            },
            C: {
              id: 'C',
              kind: 'anchor',
              anchorType: 'sharp',
              x: 480,
              y: 275
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
        throw new Error('Failed to create full topology fixture')
      }
      core.selectElements?.([elementId], { undoable: false })
      core.setSystemProperty?.('pathEditingVectorId', elementId)
      core.setSystemProperty?.('pathEditingMode', true)
    })
    await setSelectedVectorStrokeData(page)
    await page.waitForTimeout(250)
    await expectLocalVectorInvariants(page, 'full-topology:create')

    await page.evaluate(async () => {
      const core = (await import('../src/testing/runtime-access')).core

      const elementApis = (await import('../src/testing/runtime-access'))
        .elementApis
      const elementId =
        core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
      if (!elementId) {
        throw new Error('Missing selected vector for append')
      }
      elementApis.appendVectorAnchorPoint(elementId, {
        id: 'D',
        type: 'sharp',
        x: 430,
        y: 380,
        isMove: undefined,
        inHandle: null,
        outHandle: null
      })
    })
    await page.waitForTimeout(250)
    await expectLocalVectorInvariants(page, 'full-topology:append')
    const appendUndo = await getLastUndoPatchSummary(page)
    expectOnlyComputedPatchUndo(appendUndo)
    expect(appendUndo.pointSetIds).toEqual(['D'])
    expect(appendUndo.pointRemoveIds).toEqual([])
    expect(appendUndo.networkSetIds).toEqual(['main'])

    const splitPointId = await page.evaluate(async () => {
      const core = (await import('../src/testing/runtime-access')).core

      const elementApis = (await import('../src/testing/runtime-access'))
        .elementApis
      const elementId =
        core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
      const computed = elementId
        ? core?.deps?.sceneTree
            ?.getElementById?.(elementId)
            ?.getAllComputedData?.()
        : null
      if (!elementId || !computed) {
        throw new Error('Missing selected vector for split')
      }
      const segment = computed.segments?.AB
      const start = computed.points?.[segment?.startId]
      const end = computed.points?.[segment?.endId]
      if (!segment || !start || !end) {
        throw new Error('Missing AB segment for split')
      }
      const workspacePosition = core?.deps?.render?.elementLocalToWorkspace?.(
        elementId,
        {
          x: (start.x + end.x) / 2,
          y: (start.y + end.y) / 2
        }
      )
      if (!workspacePosition) {
        throw new Error('Missing local-to-workspace split projection')
      }
      const result = elementApis.splitVectorSegmentAtWorkspacePos(
        elementId,
        'AB',
        workspacePosition
      )
      if (!result?.point?.id) {
        throw new Error('Failed to split vector segment')
      }
      return result.point.id
    })
    await page.waitForTimeout(250)
    await expectLocalVectorInvariants(page, 'full-topology:split')
    const splitUndo = await getLastUndoPatchSummary(page)
    expectOnlyComputedPatchUndo(splitUndo)
    expect(splitUndo.pointSetIds).toEqual([splitPointId])
    expect(splitUndo.pointRemoveIds).toEqual([])
    expect(splitUndo.segmentRemoveIds).toContain('AB')
    expect(splitUndo.networkSetIds).toEqual(['main'])

    await page.evaluate(async (pointId) => {
      const core = (await import('../src/testing/runtime-access')).core

      const elementApis = (await import('../src/testing/runtime-access'))
        .elementApis
      const elementId =
        core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
      if (!elementId) {
        throw new Error('Missing selected vector for remove')
      }
      if (!elementApis.removeVectorAnchorPoint(elementId, pointId)) {
        throw new Error('Failed to remove split vector point')
      }
    }, splitPointId)
    await page.waitForTimeout(250)
    await expectLocalVectorInvariants(page, 'full-topology:remove')
    const removeUndo = await getLastUndoPatchSummary(page)
    expectOnlyComputedPatchUndo(removeUndo)
    expect(removeUndo.pointSetIds).toEqual([])
    expect(removeUndo.pointRemoveIds).toEqual([splitPointId])
    expect(removeUndo.networkSetIds).toEqual(expect.arrayContaining(['main']))
    expect(removeUndo.networkSetIds).toHaveLength(2)

    await page.evaluate(async () => {
      const core = (await import('../src/testing/runtime-access')).core

      const elementApis = (await import('../src/testing/runtime-access'))
        .elementApis
      const elementId =
        core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
      if (!elementId) {
        throw new Error('Missing selected vector for close')
      }
      const connected = elementApis.connectVectorAnchorEndpoints(
        elementId,
        'D',
        'A'
      )
      if (!connected || connected.closed) {
        throw new Error('Failed to merge vector topology before close')
      }
    })
    await page.waitForTimeout(250)
    const merged = await expectLocalVectorInvariants(
      page,
      'full-topology:merge'
    )
    expect(merged.computed.pointCount).toBe(4)
    expect(merged.computed.networkCount).toBe(1)
    const mergeUndo = await getLastUndoPatchSummary(page)
    expectOnlyComputedPatchUndo(mergeUndo)
    expect(mergeUndo.valueKeys).not.toContain('closed')
    expect(mergeUndo.networkSetIds).toHaveLength(1)
    const mergedNetworkId = mergeUndo.networkSetIds[0]

    await page.evaluate(async () => {
      const core = (await import('../src/testing/runtime-access')).core

      const elementApis = (await import('../src/testing/runtime-access'))
        .elementApis
      const elementId =
        core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
      if (!elementId) {
        throw new Error('Missing selected vector for close')
      }
      elementApis.setVectorClosed(elementId, true)
    })
    await page.waitForTimeout(250)
    const closed = await expectLocalVectorInvariants(
      page,
      'full-topology:close'
    )
    expect(closed.computed.pointCount).toBe(4)
    expect(closed.computed.segmentCount).toBe(4)
    expect(closed.computed.networkCount).toBe(1)
    const closeUndo = await getLastUndoPatchSummary(page)
    expectOnlyComputedPatchUndo(closeUndo)
    expect(closeUndo.pointSetIds).toEqual([])
    expect(closeUndo.pointRemoveIds).toEqual([])
    expect(closeUndo.valueKeys).toContain('closed')
    expect(closeUndo.networkSetIds).toEqual([mergedNetworkId])

    await page.evaluate(async () => {
      const core = (await import('../src/testing/runtime-access')).core

      const elementApis = (await import('../src/testing/runtime-access'))
        .elementApis
      const elementId =
        core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
      if (!elementId) {
        throw new Error('Missing selected vector for set anchor type')
      }
      const updated = elementApis.updateVectorAnchorPointType(
        elementId,
        'B',
        'smooth'
      )
      if (!updated?.point?.id) {
        throw new Error('Failed to set vector anchor type')
      }
    })
    await page.waitForTimeout(250)
    await expectLocalVectorInvariants(page, 'full-topology:set-type')
    const setTypeUndo = await getLastUndoPatchSummary(page)
    expectOnlyComputedPatchUndo(setTypeUndo)
    expect(setTypeUndo.pointSetIds).toEqual(['B'])
    expect(setTypeUndo.pointRemoveIds).toEqual([])
    expect(setTypeUndo.segmentSetIds).toEqual([])
    expect(setTypeUndo.networkSetIds).toEqual([])

    const handleSegmentIds = await page.evaluate(async () => {
      const core = (await import('../src/testing/runtime-access')).core

      const elementApis = (await import('../src/testing/runtime-access'))
        .elementApis
      const elementId =
        core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
      const computed = elementId
        ? core?.deps?.sceneTree
            ?.getElementById?.(elementId)
            ?.getAllComputedData?.()
        : null
      const point = computed?.points?.B
      if (!elementId || !point) {
        throw new Error('Missing selected vector for set handles')
      }
      interface SegmentLike {
        id: string
        startId: string
        endId: string
      }
      const adjacentSegmentIds = (
        Object.values(computed.segments ?? {}) as SegmentLike[]
      )
        .filter((segment) => segment.startId === 'B' || segment.endId === 'B')
        .map((segment) => segment.id)
      const inHandle = core?.deps?.render?.elementLocalToWorkspace?.(
        elementId,
        {
          x: point.x - 42,
          y: point.y + 18
        }
      )
      const outHandle = core?.deps?.render?.elementLocalToWorkspace?.(
        elementId,
        {
          x: point.x + 48,
          y: point.y - 22
        }
      )
      if (!inHandle || !outHandle) {
        throw new Error('Missing local-to-workspace handle projection')
      }
      elementApis.updateVectorAnchorPointHandles(elementId, [
        {
          pointId: 'B',
          target: 'inHandle',
          position: inHandle,
          forceSmooth: true
        },
        {
          pointId: 'B',
          target: 'outHandle',
          position: outHandle,
          forceSmooth: true
        }
      ])
      return adjacentSegmentIds
    })
    await page.waitForTimeout(250)
    await expectLocalVectorInvariants(page, 'full-topology:set-handles')
    const setHandlesUndo = await getLastUndoPatchSummary(page)
    expectOnlyComputedPatchUndo(setHandlesUndo)
    expect([...setHandlesUndo.pointSetIds].sort()).toEqual(['B:in', 'B:out'])
    expect(setHandlesUndo.pointRemoveIds).toEqual([])
    expect([...setHandlesUndo.segmentSetIds].sort()).toEqual(
      handleSegmentIds.sort()
    )
    expect(setHandlesUndo.networkSetIds).toEqual([])

    await page.evaluate(async () => {
      const core = (await import('../src/testing/runtime-access')).core

      const elementApis = (await import('../src/testing/runtime-access'))
        .elementApis
      const elementId =
        core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
      if (!elementId) {
        throw new Error('Missing selected vector for set handle mode')
      }
      const updated = elementApis.setVectorAnchorPointHandleMode(
        elementId,
        'B',
        'mirror-angle-length'
      )
      if (!updated?.point?.id) {
        throw new Error('Failed to set vector handle mode')
      }
    })
    await page.waitForTimeout(250)
    await expectLocalVectorInvariants(page, 'full-topology:set-handle-mode')
    const setHandleModeUndo = await getLastUndoPatchSummary(page)
    expectOnlyComputedPatchUndo(setHandleModeUndo)
    expect(
      setHandleModeUndo.pointSetIds.every((pointId) =>
        ['B', 'B:in', 'B:out'].includes(pointId)
      )
    ).toBe(true)
    expect(setHandleModeUndo.pointRemoveIds).toEqual([])

    await page.evaluate(async () => {
      const core = (await import('../src/testing/runtime-access')).core

      const elementApis = (await import('../src/testing/runtime-access'))
        .elementApis
      const elementId =
        core?.deps?.selection?.getElementSelectionIds?.()?.[0] ?? null
      if (!elementId) {
        throw new Error('Missing selected vector for set closed')
      }
      elementApis.setVectorClosed(elementId, false)
    })
    await page.waitForTimeout(250)
    await expectLocalVectorInvariants(page, 'full-topology:set-open')
    const setOpenUndo = await getLastUndoPatchSummary(page)
    expectOnlyComputedPatchUndo(setOpenUndo)
    expect(setOpenUndo.pointSetIds).toEqual([])
    expect(setOpenUndo.pointRemoveIds).toEqual([])
    expect(setOpenUndo.valueKeys).toContain('closed')
    expect(setOpenUndo.networkSetIds).toEqual([mergedNetworkId])
  })
})
