import { describe, expect, it, vi } from 'vitest'
import {
  AsyraDesignAiActionError,
  AsyraDesignAiActionNames,
  createAsyraDesignAiActions,
  type AsyraDesignAiActionApis
} from '../actions'

const actionApis = (): AsyraDesignAiActionApis => ({
  changeElementGeometry: vi.fn(),
  createCompositionElement: vi.fn(),
  createCompositionElements: vi.fn(),
  createCompositionGroup: vi.fn(),
  getElementBounds: vi.fn(),
  getElementFillColor: vi.fn(),
  getElementStrokeColor: vi.fn(),
  getElementType: vi.fn(),
  removeSubtree: vi.fn(() => ({ removed: [] })),
  scaleVectorElementGeometry: vi.fn(() => true),
  selectElements: vi.fn(),
  setElementVisible: vi.fn(() => true),
  updateElementFillColor: vi.fn(),
  updateElementStrokeColor: vi.fn()
})

const actionByName = (name: string, apis: AsyraDesignAiActionApis) => {
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

describe('Asyra Design AI actions', () => {
  it('publishes one deterministic backend-facing action catalog', () => {
    const actions = createAsyraDesignAiActions(actionApis())

    expect(actions.map(({ name }) => name)).toEqual([
      AsyraDesignAiActionNames.REQUEST_DRAWING_DETAIL_CHOICE,
      AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION,
      AsyraDesignAiActionNames.UPDATE_COMPOSITION_ELEMENTS,
      AsyraDesignAiActionNames.REMOVE_AI_COMPOSITION,
      AsyraDesignAiActionNames.SET_ELEMENT_VISIBILITY,
      AsyraDesignAiActionNames.SELECT_ELEMENTS
    ])
    expect(Object.isFrozen(actions)).toBe(true)
    actions.forEach((action) => {
      expect(Object.isFrozen(action)).toBe(true)
      expect(action.inputSchema).toEqual(expect.any(Object))
      expect(action).not.toHaveProperty('schema')
      expect(action).not.toHaveProperty('prepare')
    })
  })

  it('returns App-owned drawing-detail options without mutating the document', async () => {
    const apis = actionApis()
    const action = actionByName(
      AsyraDesignAiActionNames.REQUEST_DRAWING_DETAIL_CHOICE,
      apis
    )

    await expect(action.execute({}, executionContext())).resolves.toEqual({
      action: AsyraDesignAiActionNames.REQUEST_DRAWING_DETAIL_CHOICE,
      clarification: {
        kind: 'drawing-detail',
        optionIds: ['balanced', 'maximum']
      },
      status: 'no-change'
    })
    Object.values(apis).forEach((api) => {
      expect(api).not.toHaveBeenCalled()
    })
  })

  it('executes server-prepared visibility and selection through common APIs', async () => {
    const apis = actionApis()
    const visibility = actionByName(
      AsyraDesignAiActionNames.SET_ELEMENT_VISIBILITY,
      apis
    )
    const selection = actionByName(
      AsyraDesignAiActionNames.SELECT_ELEMENTS,
      apis
    )

    await expect(
      visibility.execute(
        {
          elementId: 'shape-1',
          visible: false
        },
        executionContext()
      )
    ).resolves.toEqual({
      action: AsyraDesignAiActionNames.SET_ELEMENT_VISIBILITY,
      changed: true,
      elementId: 'shape-1'
    })
    await expect(
      selection.execute(
        {
          elementIds: ['shape-1', 'shape-2']
        },
        executionContext()
      )
    ).resolves.toEqual({
      action: AsyraDesignAiActionNames.SELECT_ELEMENTS,
      selectedCount: 2
    })
    expect(apis.setElementVisible).toHaveBeenCalledWith('shape-1', false, {
      sharedDelivery: 'immediate',
      undoable: true
    })
    expect(apis.selectElements).toHaveBeenCalledWith(['shape-1', 'shape-2'], {
      sharedDelivery: 'immediate',
      undoable: true
    })
  })

  it('checks abort before requesting a common API mutation', async () => {
    const apis = actionApis()
    const action = actionByName(
      AsyraDesignAiActionNames.SET_ELEMENT_VISIBILITY,
      apis
    )
    const controller = new AbortController()
    controller.abort()

    await expect(
      action.execute(
        {
          elementId: 'shape-1',
          visible: false
        },
        {
          signal: controller.signal
        }
      )
    ).rejects.toBeInstanceOf(AsyraDesignAiActionError)
    expect(apis.setElementVisible).not.toHaveBeenCalled()
  })
})
