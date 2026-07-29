import { describe, expect, it, vi } from 'vitest'
import {
  ASYRA_DESIGN_AI_PROGRESSIVE_CREATE_ELEMENT_BUDGET,
  ASYRA_DESIGN_AI_PROGRESSIVE_CREATE_MAX_POINT_BUDGET,
  ASYRA_DESIGN_AI_PROGRESSIVE_CREATE_POINT_BUDGET,
  AsyraDesignAiActionError,
  AsyraDesignAiActionNames,
  createAsyraDesignAiActions,
  hasAsyraDesignAiCompositionMinimumItemCount,
  type AsyraDesignAiColorUpdate
} from '../actions'
import { createDeferred } from './deferred'

const mutationOptions = {
  sharedDelivery: 'transaction-end',
  undoable: true
} as const
const progressiveMutationOptions = {
  sharedDelivery: 'immediate',
  undoable: true
} as const

const canonicalElementIds = (
  orderedElementIds: readonly string[]
): readonly string[] => Object.freeze([...orderedElementIds])

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

const multiPathVectorItem = (pathCount: number, role = 'fur-texture') => ({
  bounds: {
    height: 420,
    width: 520,
    x: 120,
    y: 100
  },
  paths: Array.from({ length: pathCount }, (_, index) => {
    const x = 160 + (index % 120)
    const y = 140 + Math.floor(index / 120) * 4
    return {
      closed: false,
      points: [
        { x, y },
        { x: x + 8, y: y + 3 }
      ]
    }
  }),
  primitive: 'vector',
  role,
  style: {
    strokeColor: '#5B3A29',
    strokeWidth: 1
  }
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
  setDrawingProgress: vi.fn(),
  setElementVisible: vi.fn(() => true),
  updateElementFillColor: vi.fn(() => true),
  updateElementFillColors: vi.fn(
    (updates: readonly AsyraDesignAiColorUpdate[]) => updates.map(() => true)
  ),
  updateElementStrokeColor: vi.fn(() => true),
  updateElementStrokeColors: vi.fn(
    (updates: readonly AsyraDesignAiColorUpdate[]) => updates.map(() => true)
  )
})

const actionByName = (
  name: string,
  apis: ReturnType<typeof actionApis>,
  options?: {
    readonly deliveryMode?: 'atomic' | 'progressive'
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

describe('Asyra Design AI composition action schemas', () => {
  it('registers the three bounded composition actions with the existing catalog', () => {
    expect(
      createAsyraDesignAiActions(actionApis()).map(({ name }) => name)
    ).toEqual([
      AsyraDesignAiActionNames.REQUEST_DRAWING_DETAIL_CHOICE,
      AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION,
      AsyraDesignAiActionNames.UPDATE_COMPOSITION_ELEMENTS,
      AsyraDesignAiActionNames.REMOVE_AI_COMPOSITION,
      AsyraDesignAiActionNames.SET_ELEMENT_VISIBILITY,
      AsyraDesignAiActionNames.SELECT_ELEMENTS
    ])
  })

  it('strictly accepts one validated oval/vector batch descriptor without an item ceiling', () => {
    const action = actionByName(
      AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION,
      actionApis()
    )
    const descriptor = {
      compositionRole: 'cat-face',
      items: [ovalItem(), vectorItem()],
      parent: 'workspace'
    }

    expect(action.schema.parse(descriptor)).toEqual({
      success: true,
      value: descriptor
    })
    expect(hasAsyraDesignAiCompositionMinimumItemCount(0)).toBe(false)
    expect(hasAsyraDesignAiCompositionMinimumItemCount(1)).toBe(true)
    expect(hasAsyraDesignAiCompositionMinimumItemCount(1_000_000)).toBe(true)
    expect(hasAsyraDesignAiCompositionMinimumItemCount(1_000_001)).toBe(true)
    expect(
      action.schema.parse({
        ...descriptor,
        arbitraryCode: 'run()'
      })
    ).toMatchObject({ success: false })
    expect(
      action.schema.parse({
        ...descriptor,
        parent: 'provider-selected-parent-id'
      })
    ).toMatchObject({ success: false })
    expect(
      action.schema.parse({
        ...descriptor,
        items: [
          {
            ...ovalItem(),
            bounds: {
              ...ovalItem().bounds,
              x: 2040,
              width: 100
            }
          }
        ]
      })
    ).toMatchObject({ success: false })
  })

  it('accepts finite multi-path vectors without artificial path or point ceilings', () => {
    const action = actionByName(
      AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION,
      actionApis()
    )
    const descriptor = {
      compositionRole: 'cat-face',
      items: [
        multiPathVectorItem(1025, 'fur-texture'),
        {
          ...vectorItem('high-resolution-contour'),
          points: Array.from({ length: 4097 }, (_, index) => ({
            x: 472 + (index % 159),
            y: 372 + (index % 23)
          }))
        }
      ],
      parent: 'workspace'
    }

    expect(action.schema.parse(descriptor)).toMatchObject({ success: true })
  })

  it('strictly accepts only bounded geometry, fill-color, or stroke-color updates', () => {
    const action = actionByName(
      AsyraDesignAiActionNames.UPDATE_COMPOSITION_ELEMENTS,
      actionApis()
    )
    const descriptor = {
      updates: [
        {
          elementId: 'eye-left',
          geometry: {
            scaleX: 1.2,
            scaleY: 1.2
          }
        },
        {
          elementId: 'whisker-1',
          style: {
            strokeColor: '#2563EB'
          }
        },
        {
          elementId: 'pupil-left',
          style: {
            fillColor: '#DC2626'
          }
        }
      ]
    }

    expect(action.schema.parse(descriptor)).toEqual({
      success: true,
      value: descriptor
    })
    expect(
      action.schema.parse({
        updates: [
          {
            elementId: 'eye-left',
            geometry: {
              scaleX: 10,
              scaleY: 1.2
            }
          }
        ]
      })
    ).toMatchObject({ success: false })
    expect(
      action.schema.parse({
        updates: [
          {
            elementId: 'pupil-left',
            style: {
              fillColor: '#DC2626',
              strokeColor: '#2563EB'
            }
          }
        ]
      })
    ).toMatchObject({ success: false })
    expect(
      action.schema.parse({
        updates: [
          {
            elementId: 'shape-1',
            arbitraryPropertyPath: 'props.secret'
          }
        ]
      })
    ).toMatchObject({ success: false })
  })

  it('strictly accepts only one non-empty composition id for removal', () => {
    const action = actionByName(
      AsyraDesignAiActionNames.REMOVE_AI_COMPOSITION,
      actionApis()
    )

    expect(
      action.schema.parse({
        compositionId: 'group-cat'
      })
    ).toEqual({
      success: true,
      value: {
        compositionId: 'group-cat'
      }
    })
    expect(
      action.schema.parse({
        compositionId: 'group-cat',
        recursiveScript: true
      })
    ).toMatchObject({ success: false })
  })
})

describe('Asyra Design AI composition action execution', () => {
  it('emits detached preparation and canonical batch spans', async () => {
    const runtimeGlobal = globalThis as typeof globalThis & {
      __asyraBrowserDragPhaseSink?: (name: string, durationMs: number) => void
    }
    const previous = runtimeGlobal.__asyraBrowserDragPhaseSink
    const phaseNames: string[] = []
    runtimeGlobal.__asyraBrowserDragPhaseSink = (name) => phaseNames.push(name)
    const apis = actionApis()
    apis.createCompositionElements.mockReturnValue(
      canonicalElementIds(['eye-left-id', 'whisker-left-id'])
    )
    const action = actionByName(
      AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION,
      apis
    )

    try {
      await action.execute(
        {
          compositionRole: 'cat-face',
          items: [ovalItem(), vectorItem()],
          parent: 'workspace'
        },
        executionContext()
      )
    } finally {
      runtimeGlobal.__asyraBrowserDragPhaseSink = previous
    }

    expect(phaseNames).toEqual(
      expect.arrayContaining([
        'ai-app:prepare-composition',
        'ai-app:create-composition-group',
        'ai-app:create-composition-batch',
        'ai-app:record-created-elements'
      ])
    )
  })

  it('creates one canonical Group for one valid vectorized item', async () => {
    const apis = actionApis()
    const item = vectorItem('reference-vector-000001')
    apis.createCompositionElements.mockReturnValue(
      canonicalElementIds(['reference-vector-id'])
    )
    const action = actionByName(
      AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION,
      apis
    )
    const argumentsValue = {
      compositionRole: 'vectorized-image',
      items: [item],
      parent: 'workspace'
    }

    expect(action.schema.parse(argumentsValue)).toMatchObject({
      success: true
    })
    await expect(
      action.execute(argumentsValue, executionContext())
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
    apis.createCompositionElements.mockReturnValue(
      canonicalElementIds(['fur-1-id', 'fur-2-id'])
    )
    const action = actionByName(
      AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION,
      apis
    )

    await expect(
      action.execute(
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

  it('submits one large accepted composition as one ordered canonical batch', async () => {
    const apis = actionApis()
    const items = Array.from({ length: 513 }, (_, index) =>
      vectorItem(`fur-${index}`)
    )
    const orderedElementIds = items.map(({ role }) => `${role}-id`)
    apis.createCompositionElements.mockReturnValue(
      canonicalElementIds(orderedElementIds)
    )
    const action = actionByName(
      AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION,
      apis
    )

    await expect(
      action.execute(
        {
          compositionRole: 'cat-face',
          items,
          parent: 'workspace'
        },
        executionContext()
      )
    ).resolves.toMatchObject({
      appliedElementIds: orderedElementIds,
      compositionId: 'cat-group-id',
      status: 'complete'
    })
    expect(apis.createCompositionElements).toHaveBeenCalledOnce()
    expect(apis.createCompositionElements).toHaveBeenCalledWith(
      items,
      expect.objectContaining({ id: 'cat-group-id' }),
      mutationOptions
    )
    expect(apis.createCompositionGroup).toHaveBeenCalledOnce()
    expect(apis.groupElements).not.toHaveBeenCalled()
  })

  it('paints exact accepted bounds before the first canonical mutation and clears terminal state', async () => {
    const apis = actionApis()
    const calls: string[] = []
    apis.setDrawingProgress.mockImplementation(
      (
        state: {
          readonly bounds: {
            readonly height: number
            readonly width: number
            readonly x: number
            readonly y: number
          }
          readonly completedElements: number
          readonly phase: 'drawing' | 'preparing'
          readonly totalElements: number
        } | null
      ) => {
        calls.push(
          state
            ? `progress:${state.phase}:${state.completedElements}/${state.totalElements}:${state.bounds.x},${state.bounds.y},${state.bounds.width},${state.bounds.height}`
            : 'progress:clear'
        )
      }
    )
    apis.createCompositionGroup.mockImplementation(() => {
      calls.push('canonical:group')
      return 'cat-group-id'
    })
    apis.createCompositionElements.mockImplementation(() => {
      calls.push('canonical:children')
      return canonicalElementIds(['left-eye-id', 'left-whisker-id'])
    })
    const yieldToHost = vi.fn(async () => {
      calls.push('paint')
    })
    const action = actionByName(
      AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION,
      apis,
      { yieldToHost }
    )

    await action.execute(
      {
        compositionRole: 'cat-face',
        items: [ovalItem(), vectorItem()],
        parent: 'workspace'
      },
      executionContext()
    )

    expect(calls).toEqual([
      'progress:preparing:0/2:472,300,180,94',
      'paint',
      'canonical:group',
      'canonical:children',
      'progress:drawing:2/2:472,300,180,94',
      'paint',
      'progress:clear'
    ])
  })

  it('splits zero-point progressive primitives by element count and reports only completed batches', async () => {
    const apis = actionApis()
    const items = Array.from({ length: 513 }, (_, index) =>
      ovalItem(`detail-${index}`)
    )
    apis.createCompositionElements.mockImplementation(
      (batch: readonly { readonly role: string }[]) =>
        canonicalElementIds(batch.map(({ role }) => `${role}-id`))
    )
    const yieldToHost = vi.fn(async () => undefined)
    const action = actionByName(
      AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION,
      apis,
      {
        deliveryMode: 'progressive',
        yieldToHost
      }
    )

    await action.execute(
      {
        compositionRole: 'cat-face',
        items,
        parent: 'workspace'
      },
      executionContext()
    )

    expect(
      apis.createCompositionElements.mock.calls.map(([batch]) => batch.length)
    ).toEqual([...Array.from({ length: 16 }, () => 32), 1])
    expect(
      apis.setDrawingProgress.mock.calls
        .map(([state]) => state)
        .filter((state) => state?.phase === 'drawing')
        .map(({ completedElements }) => completedElements)
    ).toEqual([
      ...Array.from({ length: 16 }, (_, index) => (index + 1) * 32),
      513
    ])
    expect(apis.createCompositionGroup).toHaveBeenCalledWith(
      expect.any(Object),
      progressiveMutationOptions
    )
    expect(ASYRA_DESIGN_AI_PROGRESSIVE_CREATE_ELEMENT_BUDGET).toBe(32)
    expect(yieldToHost).toHaveBeenCalledTimes(18)
    expect(apis.setDrawingProgress).toHaveBeenLastCalledWith(null)
  })

  it('emits post-paint milestones from actual completed progressive batches', async () => {
    const runtimeGlobal = globalThis as typeof globalThis & {
      __asyraDiagnosticCounterSink?: (name: string, value: number) => void
    }
    const previousCounterSink = runtimeGlobal.__asyraDiagnosticCounterSink
    const counters: (readonly [string, number])[] = []
    runtimeGlobal.__asyraDiagnosticCounterSink = (name, value) => {
      counters.push([name, value])
    }
    const apis = actionApis()
    const items = Array.from({ length: 513 }, (_, index) =>
      ovalItem(`detail-${index}`)
    )
    apis.createCompositionElements.mockImplementation(
      (batch: readonly { readonly role: string }[]) =>
        canonicalElementIds(batch.map(({ role }) => `${role}-id`))
    )
    const action = actionByName(
      AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION,
      apis,
      {
        deliveryMode: 'progressive',
        yieldToHost: async () => undefined
      }
    )

    try {
      await action.execute(
        {
          compositionRole: 'cat-face',
          items,
          parent: 'workspace'
        },
        executionContext()
      )

      expect(
        counters.filter(([name]) => name.startsWith('ai-drawing:'))
      ).toEqual([
        ['ai-drawing:loading-frame-visible', 1],
        ...Array.from(
          { length: 16 },
          (_, index) =>
            ['ai-drawing:visible-element-count', (index + 1) * 32] as const
        ),
        ['ai-drawing:visible-element-count', 513],
        ['ai-drawing:cooperative-yield-count', 17]
      ])
    } finally {
      runtimeGlobal.__asyraDiagnosticCounterSink = previousCounterSink
    }
  })

  it('keeps one cooperative host boundary in flight and never starts the next ordered batch early', async () => {
    const apis = actionApis()
    const items = Array.from({ length: 40 }, (_, index) =>
      ovalItem(`detail-${index}`)
    )
    apis.createCompositionElements.mockImplementation(
      (batch: readonly { readonly role: string }[]) =>
        canonicalElementIds(batch.map(({ role }) => `${role}-id`))
    )
    const boundaries = [
      createDeferred<undefined>(),
      createDeferred<undefined>(),
      createDeferred<undefined>()
    ]
    let boundaryIndex = 0
    let inFlight = 0
    let maxInFlight = 0
    const yieldToHost = vi.fn(() => {
      const boundary = boundaries[boundaryIndex]
      if (!boundary) {
        throw new Error('Unexpected extra cooperative boundary')
      }
      boundaryIndex += 1
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
      return boundary.promise.finally(() => {
        inFlight -= 1
      })
    })
    const action = actionByName(
      AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION,
      apis,
      {
        deliveryMode: 'progressive',
        yieldToHost
      }
    )

    const execution = action.execute(
      {
        compositionRole: 'cat-face',
        items,
        parent: 'workspace'
      },
      executionContext()
    )

    await Promise.resolve()
    expect(apis.createCompositionGroup).not.toHaveBeenCalled()
    expect(apis.createCompositionElements).not.toHaveBeenCalled()

    boundaries[0].resolve(undefined)
    await vi.waitFor(() =>
      expect(apis.createCompositionElements).toHaveBeenCalledTimes(1)
    )
    expect(
      apis.createCompositionElements.mock.calls[0]?.[0].map(
        ({ role }: { readonly role: string }) => role
      )
    ).toEqual(items.slice(0, 32).map(({ role }) => role))
    expect(apis.createCompositionElements).toHaveBeenCalledTimes(1)
    expect(inFlight).toBe(1)

    boundaries[1].resolve(undefined)
    await vi.waitFor(() =>
      expect(apis.createCompositionElements).toHaveBeenCalledTimes(2)
    )
    expect(
      apis.createCompositionElements.mock.calls[1]?.[0].map(
        ({ role }: { readonly role: string }) => role
      )
    ).toEqual(items.slice(32).map(({ role }) => role))

    boundaries[2].resolve(undefined)
    await expect(execution).resolves.toMatchObject({
      appliedElementIds: items.map(({ role }) => `${role}-id`),
      status: 'complete'
    })
    expect(maxInFlight).toBe(1)
    expect(inFlight).toBe(0)
    expect(yieldToHost).toHaveBeenCalledTimes(3)
    expect(apis.setDrawingProgress).toHaveBeenLastCalledWith(null)
  })

  it('ramps point-aware plural batch boundaries and preserves exact order', async () => {
    const apis = actionApis()
    const items = Array.from({ length: 31 }, (_, index) =>
      vectorItemWithPointCount(1024, `detail-${index}`)
    )
    const orderedElementIds = items.map(({ role }) => `${role}-id`)
    const yieldToHost = vi.fn(async () => undefined)
    apis.createCompositionElements.mockImplementation(
      (batch: readonly { readonly role: string }[]) =>
        canonicalElementIds(batch.map(({ role }) => `${role}-id`))
    )
    const action = actionByName(
      AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION,
      apis,
      {
        deliveryMode: 'progressive',
        yieldToHost
      }
    )

    await action.execute(
      {
        compositionRole: 'cat-face',
        items,
        parent: 'workspace'
      },
      executionContext()
    )

    expect(
      apis.createCompositionElements.mock.calls.map(([batch]) => batch.length)
    ).toEqual([2, 4, 8, 8, 8, 1])
    expect(
      apis.createCompositionElements.mock.calls.flatMap(([batch]) =>
        batch.map(({ role }: { readonly role: string }) => `${role}-id`)
      )
    ).toEqual(orderedElementIds)
    expect(yieldToHost).toHaveBeenCalledTimes(7)
    expect(apis.setDrawingProgress).toHaveBeenLastCalledWith(null)
  })

  it('uses a point-aware progressive soft budget without rejecting an intact over-target element', async () => {
    const items = [
      vectorItemWithPointCount(2591, 'detail-over-target'),
      vectorItemWithPointCount(1500, 'detail-1'),
      vectorItemWithPointCount(700, 'detail-2'),
      vectorItemWithPointCount(700, 'detail-3')
    ]
    const orderedElementIds = items.map(({ role }) => `${role}-id`)
    const progressiveApis = actionApis()
    progressiveApis.createCompositionElements.mockImplementation(
      (batch: readonly { readonly role: string }[]) =>
        canonicalElementIds(batch.map(({ role }) => `${role}-id`))
    )
    const progressive = actionByName(
      AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION,
      progressiveApis,
      {
        deliveryMode: 'progressive',
        yieldToHost: async () => undefined
      }
    )

    await progressive.execute(
      {
        compositionRole: 'cat-face',
        items,
        parent: 'workspace'
      },
      executionContext()
    )

    expect(
      progressiveApis.createCompositionElements.mock.calls.map(([batch]) =>
        batch.map(({ role }: { readonly role: string }) => `${role}-id`)
      )
    ).toEqual([[orderedElementIds[0]], orderedElementIds.slice(1)])
    expect(ASYRA_DESIGN_AI_PROGRESSIVE_CREATE_POINT_BUDGET).toBe(2048)
    expect(ASYRA_DESIGN_AI_PROGRESSIVE_CREATE_MAX_POINT_BUDGET).toBe(8192)

    const atomicApis = actionApis()
    atomicApis.createCompositionElements.mockReturnValue(
      canonicalElementIds(orderedElementIds)
    )
    const atomic = actionByName(
      AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION,
      atomicApis
    )

    await atomic.execute(
      {
        compositionRole: 'cat-face',
        items,
        parent: 'workspace'
      },
      executionContext()
    )

    expect(atomicApis.createCompositionElements).toHaveBeenCalledOnce()
    expect(atomicApis.createCompositionElements).toHaveBeenCalledWith(
      items,
      expect.any(Object),
      mutationOptions
    )
  })

  it('creates the canonical Group before one ordered child batch without post-hoc regrouping', async () => {
    const apis = actionApis()
    const items = Array.from({ length: 513 }, (_, index) =>
      vectorItem(`fur-${index}`)
    )
    apis.createCompositionGroup.mockReturnValue('cat-group-id')
    apis.createCompositionElements.mockReturnValue(
      canonicalElementIds(items.map(({ role }) => `${role}-id`))
    )
    const action = actionByName(
      AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION,
      apis
    )

    await action.execute(
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
    expect(apis.groupElements).not.toHaveBeenCalled()
  })

  it('creates ordinary grouped elements and returns detached role/id hints', async () => {
    const apis = actionApis()
    apis.createCompositionElements.mockReturnValue(
      canonicalElementIds(['eye-left-id', 'whisker-left-id'])
    )
    const action = actionByName(
      AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION,
      apis
    )

    await expect(
      action.execute(
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
    apis.createCompositionElements.mockReturnValue(
      canonicalElementIds(['pupil-left-id', 'pupil-right-id'])
    )
    const action = actionByName(
      AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION,
      apis
    )

    await expect(
      action.execute(
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
    apis.createCompositionElements.mockReturnValue(
      canonicalElementIds(['face-id', 'whisker-id'])
    )
    const action = actionByName(
      AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION,
      apis
    )

    await expect(
      action.execute(
        {
          compositionRole: 'cat-face',
          items: [
            ovalItem('face'),
            vectorItem('right-whisker-2'),
            vectorItem('right-whisker-2')
          ],
          parent: 'workspace'
        },
        executionContext()
      )
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
      action.execute(
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
    expect(apis.updateElementStrokeColors).toHaveBeenCalledWith(
      [
        {
          color: '#2563EB',
          elementId: 'whisker-present'
        }
      ],
      mutationOptions
    )
    expect(apis.updateElementStrokeColor).not.toHaveBeenCalled()
  })

  it('applies one ordered progressive style batch before yielding once', async () => {
    const apis = actionApis()
    const yieldToHost = vi.fn(async () => undefined)
    apis.getElementType.mockReturnValue('vector')
    apis.getElementStrokeColor.mockReturnValue('#5B3A29')
    const action = actionByName(
      AsyraDesignAiActionNames.UPDATE_COMPOSITION_ELEMENTS,
      apis,
      {
        deliveryMode: 'progressive',
        yieldToHost
      }
    )

    await expect(
      action.execute(
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
    expect(apis.updateElementStrokeColors).toHaveBeenCalledOnce()
    expect(apis.updateElementStrokeColors).toHaveBeenCalledWith(
      [
        {
          color: '#2563EB',
          elementId: 'whisker-left'
        },
        {
          color: '#2563EB',
          elementId: 'whisker-right'
        }
      ],
      progressiveMutationOptions
    )
    expect(apis.updateElementStrokeColor).not.toHaveBeenCalled()
    expect(yieldToHost).toHaveBeenCalledOnce()
  })

  it('bounds progressive style batches at 256 items without reordering', async () => {
    const apis = actionApis()
    const yieldToHost = vi.fn(async () => undefined)
    const updates = Array.from({ length: 513 }, (_, index) => ({
      elementId: `whisker-${index}`,
      style: { strokeColor: '#2563EB' }
    }))
    apis.getElementType.mockReturnValue('vector')
    apis.getElementStrokeColor.mockReturnValue('#5B3A29')
    const action = actionByName(
      AsyraDesignAiActionNames.UPDATE_COMPOSITION_ELEMENTS,
      apis,
      {
        deliveryMode: 'progressive',
        yieldToHost
      }
    )

    await expect(
      action.execute({ updates }, executionContext())
    ).resolves.toMatchObject({
      appliedElementIds: updates.map(({ elementId }) => elementId),
      status: 'complete'
    })
    expect(
      apis.updateElementStrokeColors.mock.calls.map(([batch]) => batch.length)
    ).toEqual([256, 256, 1])
    expect(
      apis.updateElementStrokeColors.mock.calls.flatMap(([batch]) =>
        batch.map(({ elementId }) => elementId)
      )
    ).toEqual(updates.map(({ elementId }) => elementId))
    expect(apis.updateElementStrokeColor).not.toHaveBeenCalled()
    expect(yieldToHost).toHaveBeenCalledTimes(3)
  })

  it('stops before the next progressive style batch after cancellation', async () => {
    const apis = actionApis()
    const controller = new AbortController()
    const yieldToHost = vi.fn(async () => {
      controller.abort()
    })
    const updates = Array.from({ length: 257 }, (_, index) => ({
      elementId: `whisker-${index}`,
      style: { strokeColor: '#2563EB' }
    }))
    apis.getElementType.mockReturnValue('vector')
    apis.getElementStrokeColor.mockReturnValue('#5B3A29')
    const action = actionByName(
      AsyraDesignAiActionNames.UPDATE_COMPOSITION_ELEMENTS,
      apis,
      {
        deliveryMode: 'progressive',
        yieldToHost
      }
    )

    await expect(
      action.execute({ updates }, { signal: controller.signal })
    ).rejects.toBeInstanceOf(AsyraDesignAiActionError)
    expect(apis.updateElementStrokeColors).toHaveBeenCalledOnce()
    expect(apis.updateElementStrokeColors.mock.calls[0]?.[0]).toHaveLength(256)
    expect(apis.updateElementStrokeColor).not.toHaveBeenCalled()
    expect(yieldToHost).toHaveBeenCalledOnce()
  })

  it('aligns applied and no-change outcomes from a style batch', async () => {
    const apis = actionApis()
    apis.getElementType.mockReturnValue('vector')
    apis.getElementFillColor.mockReturnValue('#050504')
    apis.updateElementFillColors.mockReturnValue([true, false, true])
    const action = actionByName(
      AsyraDesignAiActionNames.UPDATE_COMPOSITION_ELEMENTS,
      apis
    )

    await expect(
      action.execute(
        {
          updates: ['left', 'middle', 'right'].map((suffix) => ({
            elementId: `pupil-${suffix}`,
            style: { fillColor: '#DC2626' }
          }))
        },
        executionContext()
      )
    ).resolves.toEqual({
      action: AsyraDesignAiActionNames.UPDATE_COMPOSITION_ELEMENTS,
      appliedElementIds: ['pupil-left', 'pupil-right'],
      skipped: [
        {
          elementId: 'pupil-middle',
          reason: 'no-change'
        }
      ],
      status: 'partial'
    })
  })

  it('rejects a style batch result that is not index-aligned', async () => {
    const apis = actionApis()
    apis.getElementType.mockReturnValue('vector')
    apis.getElementFillColor.mockReturnValue('#050504')
    apis.updateElementFillColors.mockReturnValue([true])
    const action = actionByName(
      AsyraDesignAiActionNames.UPDATE_COMPOSITION_ELEMENTS,
      apis
    )

    await expect(
      action.execute(
        {
          updates: [
            {
              elementId: 'pupil-left',
              style: { fillColor: '#DC2626' }
            },
            {
              elementId: 'pupil-right',
              style: { fillColor: '#DC2626' }
            }
          ]
        },
        executionContext()
      )
    ).rejects.toThrow(
      'AI composition style batch did not preserve the requested item count.'
    )
  })

  it('preserves contiguous fill and stroke batch order', async () => {
    const apis = actionApis()
    const yieldToHost = vi.fn(async () => undefined)
    apis.getElementType.mockReturnValue('vector')
    apis.getElementFillColor.mockReturnValue('#050504')
    apis.getElementStrokeColor.mockReturnValue('#5B3A29')
    const action = actionByName(
      AsyraDesignAiActionNames.UPDATE_COMPOSITION_ELEMENTS,
      apis,
      {
        deliveryMode: 'progressive',
        yieldToHost
      }
    )

    await expect(
      action.execute(
        {
          updates: [
            {
              elementId: 'pupil-left',
              style: { fillColor: '#DC2626' }
            },
            {
              elementId: 'whisker-left',
              style: { strokeColor: '#2563EB' }
            },
            {
              elementId: 'pupil-right',
              style: { fillColor: '#DC2626' }
            }
          ]
        },
        executionContext()
      )
    ).resolves.toMatchObject({
      appliedElementIds: ['pupil-left', 'whisker-left', 'pupil-right'],
      status: 'complete'
    })
    expect(apis.updateElementFillColors).toHaveBeenCalledTimes(2)
    expect(apis.updateElementStrokeColors).toHaveBeenCalledOnce()
    expect(
      apis.updateElementFillColors.mock.invocationCallOrder[0]
    ).toBeLessThan(apis.updateElementStrokeColors.mock.invocationCallOrder[0])
    expect(
      apis.updateElementStrokeColors.mock.invocationCallOrder[0]
    ).toBeLessThan(apis.updateElementFillColors.mock.invocationCallOrder[1])
    expect(yieldToHost).toHaveBeenCalledTimes(3)
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
        deliveryMode: 'progressive',
        yieldToHost
      }
    )

    await expect(
      action.execute(
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
    expect(apis.updateElementStrokeColors).toHaveBeenCalledOnce()
    expect(apis.updateElementStrokeColor).not.toHaveBeenCalled()
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
      action.execute(
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
      action.execute(
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
    expect(apis.updateElementFillColors).toHaveBeenCalledOnce()
    expect(apis.updateElementFillColors).toHaveBeenCalledWith(
      [
        {
          color: '#DC2626',
          elementId: 'pupil-left'
        },
        {
          color: '#DC2626',
          elementId: 'pupil-right'
        }
      ],
      mutationOptions
    )
    expect(apis.updateElementFillColor).not.toHaveBeenCalled()
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
      action.execute(
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
    expect(apis.updateElementFillColors).toHaveBeenCalledOnce()
    expect(apis.updateElementFillColors).toHaveBeenCalledWith(
      [
        {
          color: '#DC2626',
          elementId: 'pupil-right'
        }
      ],
      mutationOptions
    )
    expect(apis.updateElementFillColor).not.toHaveBeenCalled()
  })

  it('returns no-change for a missing removal target and removes an existing Group once', async () => {
    const missingApis = actionApis()
    missingApis.getElementType.mockReturnValue(undefined)
    const missing = actionByName(
      AsyraDesignAiActionNames.REMOVE_AI_COMPOSITION,
      missingApis
    )

    await expect(
      missing.execute(
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
      existing.execute(
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

  it('rejects a pre-aborted insert before requesting Group or child mutation', async () => {
    const apis = actionApis()
    const controller = new AbortController()
    controller.abort()
    const action = actionByName(
      AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION,
      apis
    )

    await expect(
      action.execute(
        {
          compositionRole: 'cat-face',
          items: [ovalItem('face'), vectorItem()],
          parent: 'workspace'
        },
        { signal: controller.signal }
      )
    ).rejects.toBeInstanceOf(AsyraDesignAiActionError)
    expect(apis.setDrawingProgress).not.toHaveBeenCalled()
    expect(apis.createCompositionGroup).not.toHaveBeenCalled()
    expect(apis.createCompositionElements).not.toHaveBeenCalled()
  })

  it('rejects a null canonical child result as fatal', async () => {
    const apis = actionApis()
    apis.createCompositionElements.mockReturnValue(null)
    const action = actionByName(
      AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION,
      apis
    )

    await expect(
      action.execute(
        {
          compositionRole: 'cat-face',
          items: [ovalItem('face'), vectorItem()],
          parent: 'workspace'
        },
        executionContext()
      )
    ).rejects.toThrow('AI composition canonical batch failed.')
    expect(apis.createCompositionGroup).toHaveBeenCalledOnce()
    expect(apis.createCompositionElements).toHaveBeenCalledOnce()
    expect(apis.setDrawingProgress).toHaveBeenLastCalledWith(null)
  })

  it('rejects canonical child result cardinality mismatch as fatal', async () => {
    const apis = actionApis()
    apis.createCompositionElements.mockReturnValue(
      canonicalElementIds(['face-id'])
    )
    const action = actionByName(
      AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION,
      apis
    )

    await expect(
      action.execute(
        {
          compositionRole: 'cat-face',
          items: [ovalItem('face'), vectorItem()],
          parent: 'workspace'
        },
        executionContext()
      )
    ).rejects.toThrow(
      'AI composition creation did not preserve the validated item count.'
    )
    expect(apis.createCompositionElements).toHaveBeenCalledOnce()
    expect(apis.setDrawingProgress).toHaveBeenLastCalledWith(null)
  })

  it('reports only the completed prefix before a later progressive batch fails and clears progress', async () => {
    const apis = actionApis()
    const items = Array.from({ length: 6 }, (_, index) =>
      vectorItemWithPointCount(1024, `detail-${index}`)
    )
    apis.createCompositionElements
      .mockImplementationOnce((batch: readonly { readonly role: string }[]) =>
        canonicalElementIds(batch.map(({ role }) => `${role}-id`))
      )
      .mockReturnValueOnce(null)
    const action = actionByName(
      AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION,
      apis,
      {
        deliveryMode: 'progressive',
        yieldToHost: async () => undefined
      }
    )

    await expect(
      action.execute(
        {
          compositionRole: 'cat-face',
          items,
          parent: 'workspace'
        },
        executionContext()
      )
    ).rejects.toThrow('AI composition canonical batch failed.')

    expect(apis.createCompositionElements).toHaveBeenCalledTimes(2)
    expect(
      apis.setDrawingProgress.mock.calls
        .map(([state]) => state)
        .filter((state) => state?.phase === 'drawing')
        .map(({ completedElements }) => completedElements)
    ).toEqual([2])
    expect(apis.setDrawingProgress).toHaveBeenLastCalledWith(null)
  })

  it('stops before the next progressive canonical batch after cancellation and clears progress', async () => {
    const apis = actionApis()
    const items = Array.from({ length: 6 }, (_, index) =>
      vectorItemWithPointCount(1024, `detail-${index}`)
    )
    apis.createCompositionElements.mockImplementation(
      (batch: readonly { readonly role: string }[]) =>
        canonicalElementIds(batch.map(({ role }) => `${role}-id`))
    )
    const controller = new AbortController()
    let yieldCount = 0
    const yieldToHost = vi.fn(async () => {
      yieldCount += 1
      if (yieldCount === 2) {
        controller.abort()
      }
    })
    const action = actionByName(
      AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION,
      apis,
      {
        deliveryMode: 'progressive',
        yieldToHost
      }
    )

    await expect(
      action.execute(
        {
          compositionRole: 'cat-face',
          items,
          parent: 'workspace'
        },
        { signal: controller.signal }
      )
    ).rejects.toBeInstanceOf(AsyraDesignAiActionError)
    expect(apis.createCompositionElements).toHaveBeenCalledOnce()
    expect(
      apis.createCompositionElements.mock.calls[0]?.[0].map(
        ({ role }: { readonly role: string }) => role
      )
    ).toEqual(['detail-0', 'detail-1'])
    expect(yieldToHost).toHaveBeenCalledTimes(2)
    expect(apis.setDrawingProgress).toHaveBeenLastCalledWith(null)
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
      action.execute(
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
