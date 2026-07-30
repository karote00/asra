import { describe, expect, it, vi } from 'vitest'
import {
  ASYRA_DESIGN_AI_PROGRESSIVE_CREATE_ELEMENT_BUDGET,
  ASYRA_DESIGN_AI_PROGRESSIVE_CREATE_MAX_POINT_BUDGET,
  ASYRA_DESIGN_AI_PROGRESSIVE_CREATE_POINT_BUDGET,
  AsyraDesignAiActionError,
  AsyraDesignAiActionNames,
  createAsyraDesignAiActions,
  type AsyraDesignAiCompositionItem,
  type ServerPreparedCompositionItem,
  type ServerPreparedCompositionPath,
  type ServerPreparedInsertVectorCompositionArgs
} from '../actions'

const mutationOptions = {
  sharedDelivery: 'immediate',
  undoable: true
} as const

const ovalItem = (role = 'left-eye') => ({
  bounds: {
    height: 70,
    width: 58,
    x: 594,
    y: 300
  },
  primitive: 'oval',
  role,
  style: {
    fillColor: '#FFFDF7',
    strokeColor: '#5B3A29',
    strokeWidth: 3
  }
})

const vectorItem = (role = 'left-whisker-1') => ({
  bounds: {
    height: 22,
    width: 158,
    x: 472,
    y: 372
  },
  closed: false,
  points: [
    { x: 630, y: 394 },
    { x: 472, y: 372 }
  ],
  primitive: 'vector',
  role,
  style: {
    strokeColor: '#5B3A29',
    strokeWidth: 3
  }
})

const vectorItemWithPointCount = (pointCount: number, role: string) => ({
  ...vectorItem(role),
  points: Array.from({ length: pointCount }, (_, index) => ({
    x: 472 + (index % 158),
    y: 372 + (index % 22)
  }))
})

const actionApis = () => ({
  changeElementGeometry: vi.fn(),
  createCompositionElement: vi.fn(),
  createCompositionElements: vi.fn(),
  createCompositionGroup: vi.fn(() => 'cat-group-id'),
  getElementBounds: vi.fn(),
  getElementFillColor: vi.fn(),
  getElementStrokeColor: vi.fn(),
  getElementType: vi.fn(),
  groupElements: vi.fn(),
  removeSubtree: vi.fn(),
  scaleVectorElementGeometry: vi.fn(() => true),
  selectElements: vi.fn(),
  setElementVisible: vi.fn(() => true),
  updateElementFillColor: vi.fn(() => true),
  updateElementStrokeColor: vi.fn(() => true)
})

const actionByName = (
  name: string,
  apis: ReturnType<typeof actionApis>,
  options?: {
    readonly yieldToHost?: () => Promise<void>
  }
) => {
  const action = createAsyraDesignAiActions(apis, options).find(
    (candidate) => candidate.name === name
  )
  if (!action) {
    throw new Error(`Missing test action: ${name}`)
  }
  return action
}

const executionContext = () => ({
  signal: new AbortController().signal
})

const createServerPreparedInsertArguments = (value: {
  readonly compositionRole: string
  readonly items: readonly AsyraDesignAiCompositionItem[]
  readonly parent: 'workspace'
}): ServerPreparedInsertVectorCompositionArgs => {
  const coordinates: number[] = []
  const items: ServerPreparedCompositionItem[] = []
  const paths: ServerPreparedCompositionPath[] = []
  const skipped: {
    readonly reason: 'duplicate-role'
    readonly role: string
  }[] = []
  const roles = new Set<string>()
  for (const item of value.items) {
    if (roles.has(item.role)) {
      skipped.push({
        reason: 'duplicate-role',
        role: item.role
      })
      continue
    }
    roles.add(item.role)

    const pathStart = paths.length
    const sourcePaths =
      item.primitive === 'vector'
        ? (item.paths ?? [
            {
              closed: item.closed === true,
              points: item.points ?? []
            }
          ])
        : []
    let pointCount = 0
    for (const path of sourcePaths) {
      const coordinateOffset = coordinates.length
      for (const point of path.points) {
        coordinates.push(point.x, point.y)
      }
      pointCount += path.points.length
      paths.push({
        closed: path.closed,
        coordinateOffset,
        pointCount: path.points.length
      })
    }
    items.push({
      bounds: item.bounds,
      pathCount: sourcePaths.length,
      pathStart,
      pointCount,
      primitive: item.primitive,
      role: item.role,
      style: item.style,
      ...(item.primitive === 'vector'
        ? {
            vectorEncoding:
              item.paths === undefined
                ? ('points' as const)
                : ('paths' as const)
          }
        : {})
    })
  }
  if (items.length === 0) {
    throw new Error('The server-prepared test batch requires one item.')
  }
  const groupBounds = items.reduce((bounds, item) => {
    const x = Math.min(bounds.x, item.bounds.x)
    const y = Math.min(bounds.y, item.bounds.y)
    return {
      height:
        Math.max(bounds.y + bounds.height, item.bounds.y + item.bounds.height) -
        y,
      width:
        Math.max(bounds.x + bounds.width, item.bounds.x + item.bounds.width) -
        x,
      x,
      y
    }
  }, items[0].bounds)
  return {
    artifactVersion: 1,
    compositionRole: value.compositionRole,
    coordinates: new Float64Array(coordinates).buffer,
    groupBounds,
    items,
    parent: value.parent,
    paths,
    pointCount: items.reduce(
      (totalPointCount, item) => totalPointCount + item.pointCount,
      0
    ),
    skipped
  }
}

const serverPreparedArguments = (
  action: ReturnType<typeof actionByName>,
  value: unknown
) => {
  if (action.name === AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION) {
    return createServerPreparedInsertArguments(
      value as {
        readonly compositionRole: string
        readonly items: readonly AsyraDesignAiCompositionItem[]
        readonly parent: 'workspace'
      }
    )
  }
  return value
}

const executeServerPrepared = (
  action: ReturnType<typeof actionByName>,
  value: unknown,
  context = executionContext()
) => action.execute(serverPreparedArguments(action, value), context)

describe('Asyra Design AI composition action definitions', () => {
  it('registers one backend-facing input schema and one executor per action', () => {
    const actions = createAsyraDesignAiActions(actionApis())

    expect(actions.map(({ name }) => name)).toEqual([
      AsyraDesignAiActionNames.REQUEST_DRAWING_DETAIL_CHOICE,
      AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION,
      AsyraDesignAiActionNames.UPDATE_COMPOSITION_ELEMENTS,
      AsyraDesignAiActionNames.REMOVE_AI_COMPOSITION,
      AsyraDesignAiActionNames.SET_ELEMENT_VISIBILITY,
      AsyraDesignAiActionNames.SELECT_ELEMENTS
    ])
    actions.forEach((action) => {
      expect(action.inputSchema).toEqual(expect.any(Object))
      expect(action.execute).toEqual(expect.any(Function))
      expect(action).not.toHaveProperty('schema')
      expect(action).not.toHaveProperty('prepare')
    })
  })

  it('executes one explicit server-prepared composition payload without client preparation', () => {
    const prepared = createServerPreparedInsertArguments({
      compositionRole: 'cat-face',
      items: [ovalItem('face'), vectorItem('right-whisker-2')],
      parent: 'workspace'
    })

    expect(prepared).toMatchObject({
      artifactVersion: 1,
      compositionRole: 'cat-face',
      groupBounds: {
        height: 94,
        width: 180,
        x: 472,
        y: 300
      },
      items: [
        {
          pathCount: 0,
          pathStart: 0,
          pointCount: 0,
          primitive: 'oval',
          role: 'face'
        },
        {
          pathCount: 1,
          pathStart: 0,
          pointCount: 2,
          primitive: 'vector',
          role: 'right-whisker-2',
          vectorEncoding: 'points'
        }
      ],
      parent: 'workspace',
      paths: [
        {
          closed: false,
          coordinateOffset: 0,
          pointCount: 2
        }
      ],
      pointCount: 2,
      skipped: []
    })
    expect(prepared.coordinates).toBeInstanceOf(ArrayBuffer)
    expect([...new Float64Array(prepared.coordinates)]).toEqual([
      630, 394, 472, 372
    ])
  })
})

describe('Asyra Design AI composition action execution', () => {
  it('creates one canonical Group for one valid vectorized item', async () => {
    const apis = actionApis()
    const item = vectorItem('reference-vector-000001')
    apis.createCompositionElements.mockReturnValue(['reference-vector-id'])
    const action = actionByName(
      AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION,
      apis
    )
    const argumentsValue = {
      compositionRole: 'vectorized-image',
      items: [item],
      parent: 'workspace'
    }

    await expect(
      executeServerPrepared(action, argumentsValue, executionContext())
    ).resolves.toMatchObject({
      appliedElementIds: ['reference-vector-id'],
      compositionId: 'cat-group-id',
      status: 'complete'
    })
    expect(apis.createCompositionGroup).toHaveBeenCalledOnce()
    expect(apis.createCompositionElements).toHaveBeenCalledWith(
      [item],
      {
        id: 'cat-group-id',
        workspaceOrigin: {
          x: 472,
          y: 372
        }
      },
      mutationOptions
    )
  })

  it('submits one validated composition batch into the precreated Group', async () => {
    const apis = actionApis()
    const items = [vectorItem('fur-1'), vectorItem('fur-2')]
    apis.createCompositionElements.mockReturnValue(['fur-1-id', 'fur-2-id'])
    const action = actionByName(
      AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION,
      apis
    )

    await expect(
      executeServerPrepared(
        action,
        {
          compositionRole: 'cat-face',
          items,
          parent: 'workspace'
        },
        executionContext()
      )
    ).resolves.toMatchObject({
      appliedElementIds: ['fur-1-id', 'fur-2-id'],
      compositionId: 'cat-group-id',
      status: 'complete'
    })
    expect(apis.createCompositionElements).toHaveBeenCalledOnce()
    expect(apis.createCompositionElements).toHaveBeenCalledWith(
      items,
      {
        id: 'cat-group-id',
        workspaceOrigin: {
          x: 472,
          y: 372
        }
      },
      mutationOptions
    )
    expect(apis.createCompositionElement).not.toHaveBeenCalled()
    expect(apis.groupElements).not.toHaveBeenCalled()
  })

  it('publishes ordered creation slices without splitting the outer action or Undo', async () => {
    const apis = actionApis()
    const items = Array.from({ length: 513 }, (_, index) =>
      vectorItem(`fur-${index}`)
    )
    const yieldToHost = vi.fn(async () => undefined)
    apis.createCompositionElements.mockImplementation(
      (batch: readonly AsyraDesignAiCompositionItem[]) =>
        batch.map(({ role }) => `${role}-id`)
    )
    const action = actionByName(
      AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION,
      apis,
      {
        yieldToHost
      }
    )

    await executeServerPrepared(
      action,
      {
        compositionRole: 'cat-face',
        items,
        parent: 'workspace'
      },
      executionContext()
    )

    expect(apis.createCompositionGroup).toHaveBeenCalledWith(
      expect.any(Object),
      mutationOptions
    )
    expect(
      apis.createCompositionElements.mock.calls.map(([batch]) => batch.length)
    ).toEqual([...Array.from({ length: 8 }, () => 64), 1])
    apis.createCompositionElements.mock.calls.forEach((call) => {
      expect(call[2]).toEqual(mutationOptions)
    })
    expect(ASYRA_DESIGN_AI_PROGRESSIVE_CREATE_ELEMENT_BUDGET).toBe(64)
    expect(yieldToHost).toHaveBeenCalledTimes(9)
  })

  it('uses a point-aware progressive soft budget without rejecting an intact over-target element', async () => {
    const items = [
      vectorItemWithPointCount(1500, 'detail-1'),
      vectorItemWithPointCount(700, 'detail-2'),
      vectorItemWithPointCount(700, 'detail-3'),
      vectorItemWithPointCount(2591, 'detail-over-target')
    ]
    const progressiveApis = actionApis()
    progressiveApis.createCompositionElements.mockImplementation(
      (batch: readonly AsyraDesignAiCompositionItem[]) =>
        batch.map(({ role }) => `${role}-id`)
    )
    const progressive = actionByName(
      AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION,
      progressiveApis,
      {
        yieldToHost: async () => undefined
      }
    )

    await executeServerPrepared(
      progressive,
      {
        compositionRole: 'cat-face',
        items,
        parent: 'workspace'
      },
      executionContext()
    )

    expect(
      progressiveApis.createCompositionElements.mock.calls.map(([batch]) =>
        batch.map(({ role }) => role)
      )
    ).toEqual([['detail-1'], ['detail-2', 'detail-3', 'detail-over-target']])
    expect(
      progressiveApis.createCompositionElements.mock.calls.flatMap(([batch]) =>
        batch.map(({ role }) => role)
      )
    ).toEqual(items.map(({ role }) => role))
    expect(ASYRA_DESIGN_AI_PROGRESSIVE_CREATE_POINT_BUDGET).toBe(2048)
    expect(ASYRA_DESIGN_AI_PROGRESSIVE_CREATE_MAX_POINT_BUDGET).toBe(8192)
  })

  it('creates the canonical group before one ordered child batch without post-hoc regrouping', async () => {
    const apis = actionApis()
    const items = Array.from({ length: 2 }, (_, index) =>
      vectorItem(`fur-${index}`)
    )
    apis.createCompositionGroup.mockReturnValue('cat-group-id')
    apis.createCompositionElements.mockImplementation(
      (batch: readonly AsyraDesignAiCompositionItem[]) =>
        batch.map(({ role }) => `${role}-id`)
    )
    const action = actionByName(
      AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION,
      apis
    )

    await executeServerPrepared(
      action,
      {
        compositionRole: 'cat-face',
        items,
        parent: 'workspace'
      },
      executionContext()
    )

    expect(apis.createCompositionGroup).toHaveBeenCalledWith(
      {
        height: 22,
        width: 158,
        x: 472,
        y: 372
      },
      mutationOptions
    )
    expect(
      apis.createCompositionGroup.mock.invocationCallOrder[0]
    ).toBeLessThan(apis.createCompositionElements.mock.invocationCallOrder[0])
    expect(apis.createCompositionElements).toHaveBeenCalledOnce()
    expect(apis.createCompositionElements).toHaveBeenCalledWith(
      expect.any(Array),
      {
        id: 'cat-group-id',
        workspaceOrigin: {
          x: 472,
          y: 372
        }
      },
      mutationOptions
    )
    expect(apis.groupElements).not.toHaveBeenCalled()
  })

  it('creates ordinary grouped elements and returns detached role/id hints', async () => {
    const apis = actionApis()
    apis.createCompositionElements.mockReturnValue([
      'eye-left-id',
      'whisker-left-id'
    ])
    const action = actionByName(
      AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION,
      apis
    )

    await expect(
      executeServerPrepared(
        action,
        {
          compositionRole: 'cat-face',
          items: [ovalItem(), vectorItem()],
          parent: 'workspace'
        },
        executionContext()
      )
    ).resolves.toEqual({
      action: AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION,
      appliedElementIds: ['eye-left-id', 'whisker-left-id'],
      compositionId: 'cat-group-id',
      roleToElementIds: {
        'left-eye': ['eye-left-id'],
        'left-whisker-1': ['whisker-left-id'],
        whiskers: ['whisker-left-id']
      },
      skipped: [],
      status: 'complete'
    })
    expect(apis.createCompositionElements).toHaveBeenCalledWith(
      [ovalItem(), vectorItem()],
      {
        id: 'cat-group-id',
        workspaceOrigin: {
          x: 472,
          y: 300
        }
      },
      mutationOptions
    )
    expect(apis.groupElements).not.toHaveBeenCalled()
  })

  it('aggregates canonical pupil ids without replacing their formal roles', async () => {
    const apis = actionApis()
    apis.createCompositionElements.mockReturnValue([
      'pupil-left-id',
      'pupil-right-id'
    ])
    const action = actionByName(
      AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION,
      apis
    )

    await expect(
      executeServerPrepared(
        action,
        {
          compositionRole: 'cat-face',
          items: [ovalItem('left-pupil'), ovalItem('right-pupil')],
          parent: 'workspace'
        },
        executionContext()
      )
    ).resolves.toMatchObject({
      roleToElementIds: {
        'left-pupil': ['pupil-left-id'],
        'right-pupil': ['pupil-right-id'],
        pupils: ['pupil-left-id', 'pupil-right-id']
      },
      status: 'complete'
    })
  })

  it('skips a duplicate semantic role before mutation and resolves partial evidence', async () => {
    const apis = actionApis()
    apis.createCompositionElements.mockReturnValue(['face-id', 'whisker-id'])
    const action = actionByName(
      AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION,
      apis
    )
    const descriptor = {
      compositionRole: 'cat-face',
      items: [
        ovalItem('face'),
        vectorItem('right-whisker-2'),
        vectorItem('right-whisker-2')
      ],
      parent: 'workspace' as const
    }
    const prepared = createServerPreparedInsertArguments(descriptor)

    expect(prepared).toMatchObject({
      groupBounds: {
        height: 94,
        width: 180,
        x: 472,
        y: 300
      },
      items: [
        {
          pathCount: 0,
          pointCount: 0,
          role: 'face'
        },
        {
          pathCount: 1,
          pointCount: 2,
          role: 'right-whisker-2',
          vectorEncoding: 'points'
        }
      ],
      pointCount: 2,
      skipped: [
        {
          reason: 'duplicate-role',
          role: 'right-whisker-2'
        }
      ]
    })
    await expect(
      action.execute(prepared, executionContext())
    ).resolves.toMatchObject({
      appliedElementIds: ['face-id', 'whisker-id'],
      skipped: [
        {
          reason: 'duplicate-role',
          role: 'right-whisker-2'
        }
      ],
      status: 'partial'
    })
    expect(apis.createCompositionElements).toHaveBeenCalledOnce()
    expect(apis.createCompositionElements).toHaveBeenCalledWith(
      [ovalItem('face'), vectorItem('right-whisker-2')],
      {
        id: 'cat-group-id',
        workspaceOrigin: {
          x: 472,
          y: 300
        }
      },
      mutationOptions
    )
  })

  it('revalidates update targets immediately before mutation and skips only missing items', async () => {
    const apis = actionApis()
    const reads = new Map<string, number>()
    apis.getElementType.mockImplementation((elementId: string) => {
      const count = (reads.get(elementId) ?? 0) + 1
      reads.set(elementId, count)
      if (elementId === 'eye-gone' && count > 1) {
        return undefined
      }
      return elementId.startsWith('eye') ? 'oval' : 'vector'
    })
    apis.getElementBounds.mockReturnValue({
      height: 50,
      width: 100,
      x: 200,
      y: 300
    })
    apis.getElementStrokeColor.mockReturnValue('#5B3A29')
    const action = actionByName(
      AsyraDesignAiActionNames.UPDATE_COMPOSITION_ELEMENTS,
      apis
    )

    await expect(
      executeServerPrepared(
        action,
        {
          updates: [
            {
              elementId: 'eye-gone',
              geometry: {
                scaleX: 1.2,
                scaleY: 1.2
              }
            },
            {
              elementId: 'eye-present',
              geometry: {
                scaleX: 1.2,
                scaleY: 1.2
              }
            },
            {
              elementId: 'whisker-present',
              style: {
                strokeColor: '#2563EB'
              }
            }
          ]
        },
        executionContext()
      )
    ).resolves.toEqual({
      action: AsyraDesignAiActionNames.UPDATE_COMPOSITION_ELEMENTS,
      appliedElementIds: ['eye-present', 'whisker-present'],
      skipped: [
        {
          elementId: 'eye-gone',
          reason: 'missing-target'
        }
      ],
      status: 'partial'
    })
    expect(apis.changeElementGeometry).toHaveBeenCalledOnce()
    expect(apis.changeElementGeometry).toHaveBeenCalledWith(
      'eye-present',
      {
        height: 60,
        width: 120,
        x: 190,
        y: 295
      },
      mutationOptions
    )
    expect(apis.updateElementStrokeColor).toHaveBeenCalledWith(
      'whisker-present',
      '#2563EB',
      mutationOptions
    )
  })

  it('yields after each applied progressive update while retaining one action execution', async () => {
    const apis = actionApis()
    const yieldToHost = vi.fn(async () => undefined)
    apis.getElementType.mockReturnValue('vector')
    apis.getElementStrokeColor.mockReturnValue('#5B3A29')
    const action = actionByName(
      AsyraDesignAiActionNames.UPDATE_COMPOSITION_ELEMENTS,
      apis,
      {
        yieldToHost
      }
    )

    await expect(
      executeServerPrepared(
        action,
        {
          updates: [
            {
              elementId: 'whisker-left',
              style: { strokeColor: '#2563EB' }
            },
            {
              elementId: 'whisker-right',
              style: { strokeColor: '#2563EB' }
            }
          ]
        },
        executionContext()
      )
    ).resolves.toMatchObject({
      appliedElementIds: ['whisker-left', 'whisker-right'],
      status: 'complete'
    })
    expect(apis.updateElementStrokeColor).toHaveBeenNthCalledWith(
      1,
      'whisker-left',
      '#2563EB',
      mutationOptions
    )
    expect(apis.updateElementStrokeColor).toHaveBeenNthCalledWith(
      2,
      'whisker-right',
      '#2563EB',
      mutationOptions
    )
    expect(yieldToHost).toHaveBeenCalledTimes(2)
  })

  it('rejects a progressive update when cancellation arrives during its final host yield', async () => {
    const apis = actionApis()
    const controller = new AbortController()
    const yieldToHost = vi.fn(async () => {
      controller.abort()
    })
    apis.getElementType.mockReturnValue('vector')
    apis.getElementStrokeColor.mockReturnValue('#5B3A29')
    const action = actionByName(
      AsyraDesignAiActionNames.UPDATE_COMPOSITION_ELEMENTS,
      apis,
      {
        yieldToHost
      }
    )

    await expect(
      executeServerPrepared(
        action,
        {
          updates: [
            {
              elementId: 'whisker-left',
              style: { strokeColor: '#2563EB' }
            }
          ]
        },
        { signal: controller.signal }
      )
    ).rejects.toBeInstanceOf(AsyraDesignAiActionError)
    expect(apis.updateElementStrokeColor).toHaveBeenCalledOnce()
    expect(yieldToHost).toHaveBeenCalledOnce()
  })

  it('scales existing vector eye topology without regenerating composition elements', async () => {
    const apis = actionApis()
    apis.getElementType.mockReturnValue('vector')
    const action = actionByName(
      AsyraDesignAiActionNames.UPDATE_COMPOSITION_ELEMENTS,
      apis
    )

    await expect(
      executeServerPrepared(
        action,
        {
          updates: [
            {
              elementId: 'vector-eye-left',
              geometry: {
                scaleX: 1.2,
                scaleY: 1.2
              }
            }
          ]
        },
        executionContext()
      )
    ).resolves.toEqual({
      action: AsyraDesignAiActionNames.UPDATE_COMPOSITION_ELEMENTS,
      appliedElementIds: ['vector-eye-left'],
      skipped: [],
      status: 'complete'
    })
    expect(apis.scaleVectorElementGeometry).toHaveBeenCalledWith(
      'vector-eye-left',
      {
        scaleX: 1.2,
        scaleY: 1.2
      },
      mutationOptions
    )
    expect(apis.changeElementGeometry).not.toHaveBeenCalled()
    expect(apis.createCompositionElement).not.toHaveBeenCalled()
    expect(apis.createCompositionElements).not.toHaveBeenCalled()
    expect(apis.removeSubtree).not.toHaveBeenCalled()
    expect(apis.groupElements).not.toHaveBeenCalled()
  })

  it('updates only existing pupil fills through the canonical fill boundary', async () => {
    const apis = actionApis()
    apis.getElementType.mockReturnValue('vector')
    apis.getElementFillColor.mockReturnValue('#050504')
    const action = actionByName(
      AsyraDesignAiActionNames.UPDATE_COMPOSITION_ELEMENTS,
      apis
    )

    await expect(
      executeServerPrepared(
        action,
        {
          updates: [
            {
              elementId: 'pupil-left',
              style: {
                fillColor: '#DC2626'
              }
            },
            {
              elementId: 'pupil-right',
              style: {
                fillColor: '#DC2626'
              }
            }
          ]
        },
        executionContext()
      )
    ).resolves.toEqual({
      action: AsyraDesignAiActionNames.UPDATE_COMPOSITION_ELEMENTS,
      appliedElementIds: ['pupil-left', 'pupil-right'],
      skipped: [],
      status: 'complete'
    })
    expect(apis.updateElementFillColor).toHaveBeenCalledTimes(2)
    expect(apis.updateElementFillColor).toHaveBeenNthCalledWith(
      1,
      'pupil-left',
      '#DC2626',
      mutationOptions
    )
    expect(apis.updateElementFillColor).toHaveBeenNthCalledWith(
      2,
      'pupil-right',
      '#DC2626',
      mutationOptions
    )
    expect(apis.createCompositionElement).not.toHaveBeenCalled()
    expect(apis.createCompositionElements).not.toHaveBeenCalled()
    expect(apis.removeSubtree).not.toHaveBeenCalled()
  })

  it('skips a missing pupil fill while committing the valid sibling as partial', async () => {
    const apis = actionApis()
    apis.getElementType.mockReturnValue('vector')
    apis.getElementFillColor.mockImplementation((elementId: string) =>
      elementId === 'pupil-left' ? null : '#050504'
    )
    const action = actionByName(
      AsyraDesignAiActionNames.UPDATE_COMPOSITION_ELEMENTS,
      apis
    )

    await expect(
      executeServerPrepared(
        action,
        {
          updates: [
            {
              elementId: 'pupil-left',
              style: {
                fillColor: '#DC2626'
              }
            },
            {
              elementId: 'pupil-right',
              style: {
                fillColor: '#DC2626'
              }
            }
          ]
        },
        executionContext()
      )
    ).resolves.toEqual({
      action: AsyraDesignAiActionNames.UPDATE_COMPOSITION_ELEMENTS,
      appliedElementIds: ['pupil-right'],
      skipped: [
        {
          elementId: 'pupil-left',
          reason: 'missing-fill'
        }
      ],
      status: 'partial'
    })
    expect(apis.updateElementFillColor).toHaveBeenCalledOnce()
    expect(apis.updateElementFillColor).toHaveBeenCalledWith(
      'pupil-right',
      '#DC2626',
      mutationOptions
    )
  })

  it('returns no-change for a missing removal target and removes an existing Group once', async () => {
    const missingApis = actionApis()
    missingApis.getElementType.mockReturnValue(undefined)
    const missing = actionByName(
      AsyraDesignAiActionNames.REMOVE_AI_COMPOSITION,
      missingApis
    )

    await expect(
      executeServerPrepared(
        missing,
        {
          compositionId: 'gone-group'
        },
        executionContext()
      )
    ).resolves.toEqual({
      action: AsyraDesignAiActionNames.REMOVE_AI_COMPOSITION,
      appliedElementIds: [],
      skipped: [
        {
          elementId: 'gone-group',
          reason: 'missing-target'
        }
      ],
      status: 'no-change'
    })
    expect(missingApis.removeSubtree).not.toHaveBeenCalled()

    const existingApis = actionApis()
    existingApis.getElementType.mockReturnValue('group')
    existingApis.removeSubtree.mockReturnValue({
      removed: ['cat-group', 'face-id'],
      rootId: 'cat-group'
    })
    const existing = actionByName(
      AsyraDesignAiActionNames.REMOVE_AI_COMPOSITION,
      existingApis
    )

    await expect(
      executeServerPrepared(
        existing,
        {
          compositionId: 'cat-group'
        },
        executionContext()
      )
    ).resolves.toMatchObject({
      appliedElementIds: ['cat-group', 'face-id'],
      status: 'complete'
    })
    expect(existingApis.getElementType).toHaveBeenCalledTimes(2)
    expect(existingApis.removeSubtree).toHaveBeenCalledWith(
      'cat-group',
      mutationOptions
    )
  })

  it('propagates canonical common-API rejection as fatal without accepted partial evidence', async () => {
    const apis = actionApis()
    const failure = new Error('canonical creation failed')
    apis.createCompositionElements.mockImplementationOnce(() => {
      throw failure
    })
    const action = actionByName(
      AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION,
      apis
    )

    await expect(
      executeServerPrepared(
        action,
        {
          compositionRole: 'cat-face',
          items: [ovalItem('face'), vectorItem()],
          parent: 'workspace'
        },
        executionContext()
      )
    ).rejects.toBe(failure)
    expect(apis.groupElements).not.toHaveBeenCalled()
  })
})
