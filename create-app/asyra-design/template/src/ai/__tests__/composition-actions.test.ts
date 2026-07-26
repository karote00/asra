import { describe, expect, it, vi } from 'vitest'
import {
  ASYRA_DESIGN_AI_PROGRESSIVE_CREATE_POINT_BUDGET,
  AsyraDesignAiActionError,
  AsyraDesignAiActionNames,
  createAsyraDesignAiActions,
  hasAsyraDesignAiCompositionMinimumItemCount
} from '../actions'

const mutationOptions = {
  sharedDelivery: 'transaction-end',
  undoable: true
} as const
const progressiveMutationOptions = {
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
  setElementVisible: vi.fn(() => true),
  updateElementFillColor: vi.fn(() => true),
  updateElementStrokeColor: vi.fn(() => true)
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
  it('submits one validated composition batch into the precreated Group', async () => {
    const apis = actionApis()
    const items = [vectorItem('fur-1'), vectorItem('fur-2')]
    apis.createCompositionElements.mockReturnValue(['fur-1-id', 'fur-2-id'])
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

  it('streams a large accepted composition through ordered batches into one Group', async () => {
    const apis = actionApis()
    const items = Array.from({ length: 513 }, (_, index) =>
      vectorItem(`fur-${index}`)
    )
    apis.createCompositionElements.mockImplementation((batch) =>
      batch.map(({ role }) => `${role}-id`)
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
      appliedElementIds: items.map(({ role }) => `${role}-id`),
      compositionId: 'cat-group-id',
      status: 'complete'
    })
    expect(apis.createCompositionElements.mock.calls.length).toBeGreaterThan(1)
    expect(
      apis.createCompositionElements.mock.calls.flatMap(([batch]) => batch)
    ).toEqual(items)
    expect(apis.createCompositionGroup).toHaveBeenCalledOnce()
    expect(apis.groupElements).not.toHaveBeenCalled()
  })

  it('publishes progressive creation through the existing ordered batches without splitting undo', async () => {
    const apis = actionApis()
    const items = Array.from({ length: 513 }, (_, index) =>
      vectorItem(`fur-${index}`)
    )
    const yieldToHost = vi.fn(async () => undefined)
    apis.createCompositionElements.mockImplementation((batch) =>
      batch.map(({ role }) => `${role}-id`)
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

    expect(apis.createCompositionGroup).toHaveBeenCalledWith(
      expect.any(Object),
      progressiveMutationOptions
    )
    expect(apis.createCompositionElements).toHaveBeenCalledTimes(3)
    apis.createCompositionElements.mock.calls.forEach((call) => {
      expect(call[2]).toEqual(progressiveMutationOptions)
    })
    expect(yieldToHost).toHaveBeenCalledTimes(3)
  })

  it('uses a point-aware progressive soft budget without rejecting an intact over-target element', async () => {
    const items = [
      vectorItemWithPointCount(1500, 'detail-1'),
      vectorItemWithPointCount(700, 'detail-2'),
      vectorItemWithPointCount(700, 'detail-3'),
      vectorItemWithPointCount(2591, 'detail-over-target')
    ]
    const progressiveApis = actionApis()
    progressiveApis.createCompositionElements.mockImplementation((batch) =>
      batch.map(({ role }) => `${role}-id`)
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
      progressiveApis.createCompositionElements.mock.calls.map(
        ([batch]) => batch
      )
    ).toEqual([[items[0]], [items[1], items[2]], [items[3]]])
    expect(
      progressiveApis.createCompositionElements.mock.calls.flatMap(
        ([batch]) => batch
      )
    ).toEqual(items)
    expect(ASYRA_DESIGN_AI_PROGRESSIVE_CREATE_POINT_BUDGET).toBe(2048)

    const atomicApis = actionApis()
    atomicApis.createCompositionElements.mockImplementation((batch) =>
      batch.map(({ role }) => `${role}-id`)
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

  it('creates the canonical group before streaming ordered batches without post-hoc regrouping', async () => {
    const apis = actionApis()
    const items = Array.from({ length: 513 }, (_, index) =>
      vectorItem(`fur-${index}`)
    )
    apis.createCompositionGroup.mockReturnValue('cat-group-id')
    apis.createCompositionElements.mockImplementation((batch) =>
      batch.map(({ role }) => `${role}-id`)
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
    expect(apis.createCompositionElements.mock.calls.length).toBeGreaterThan(1)
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
    apis.createCompositionElements.mockReturnValue([
      'pupil-left-id',
      'pupil-right-id'
    ])
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
    apis.createCompositionElements.mockReturnValue(['face-id', 'whisker-id'])
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
    expect(apis.updateElementStrokeColor).toHaveBeenNthCalledWith(
      1,
      'whisker-left',
      '#2563EB',
      progressiveMutationOptions
    )
    expect(apis.updateElementStrokeColor).toHaveBeenNthCalledWith(
      2,
      'whisker-right',
      '#2563EB',
      progressiveMutationOptions
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
