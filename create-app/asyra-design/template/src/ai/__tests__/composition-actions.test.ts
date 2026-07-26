import { describe, expect, it, vi } from 'vitest'
import {
  ASYRA_DESIGN_AI_COMPOSITION_ITEM_LIMIT,
  AsyraDesignAiActionNames,
  createAsyraDesignAiActions
} from '../actions'

const mutationOptions = {
  sharedDelivery: 'transaction-end',
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

const actionApis = () => ({
  changeElementGeometry: vi.fn(),
  createCompositionElement: vi.fn(),
  getElementBounds: vi.fn(),
  getElementStrokeColor: vi.fn(),
  getElementType: vi.fn(),
  groupElements: vi.fn(),
  removeSubtree: vi.fn(),
  selectElements: vi.fn(),
  setElementVisible: vi.fn(() => true),
  updateElementStrokeColor: vi.fn(() => true)
})

const actionByName = (name: string, apis: ReturnType<typeof actionApis>) => {
  const action = createAsyraDesignAiActions(apis).find(
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
      AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION,
      AsyraDesignAiActionNames.UPDATE_COMPOSITION_ELEMENTS,
      AsyraDesignAiActionNames.REMOVE_AI_COMPOSITION,
      AsyraDesignAiActionNames.SET_ELEMENT_VISIBILITY,
      AsyraDesignAiActionNames.SELECT_ELEMENTS
    ])
  })

  it('strictly accepts one bounded oval/vector batch descriptor', () => {
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
    expect(
      action.schema.parse({
        ...descriptor,
        items: Array.from(
          { length: ASYRA_DESIGN_AI_COMPOSITION_ITEM_LIMIT + 1 },
          (_, index) => ovalItem(`eye-${index}`)
        )
      })
    ).toMatchObject({ success: false })
  })

  it('strictly accepts only bounded geometry or stroke-color updates', () => {
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
            elementId: 'whisker-1',
            style: {
              fillColor: '#2563EB'
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
  it('creates ordinary elements, groups them, and returns detached role/id hints', async () => {
    const apis = actionApis()
    apis.createCompositionElement
      .mockReturnValueOnce('eye-left-id')
      .mockReturnValueOnce('whisker-left-id')
    apis.groupElements.mockReturnValue({
      groupId: 'cat-group-id',
      elementIds: ['eye-left-id', 'whisker-left-id']
    })
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
    expect(apis.createCompositionElement).toHaveBeenNthCalledWith(
      1,
      ovalItem(),
      mutationOptions
    )
    expect(apis.createCompositionElement).toHaveBeenNthCalledWith(
      2,
      vectorItem(),
      mutationOptions
    )
    expect(apis.groupElements).toHaveBeenCalledWith(
      ['eye-left-id', 'whisker-left-id'],
      mutationOptions
    )
  })

  it('skips a duplicate semantic role before mutation and resolves partial evidence', async () => {
    const apis = actionApis()
    apis.createCompositionElement
      .mockReturnValueOnce('face-id')
      .mockReturnValueOnce('whisker-id')
    apis.groupElements.mockReturnValue({
      groupId: 'cat-group-id',
      elementIds: ['face-id', 'whisker-id']
    })
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
    expect(apis.createCompositionElement).toHaveBeenCalledTimes(2)
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
    apis.createCompositionElement.mockReturnValueOnce('face-id')
    apis.createCompositionElement.mockImplementationOnce(() => {
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
