import { describe, expect, it, vi } from 'vitest'
import {
  AsyraDesignAiActionError,
  AsyraDesignAiActionNames,
  createAsyraDesignAiActions
} from '../actions'

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
  updateElementStrokeColor: vi.fn()
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

describe('Asyra Design AI actions', () => {
  it('publishes one deterministic bounded action catalog', () => {
    const actions = createAsyraDesignAiActions(actionApis())

    expect(actions.map(({ name }) => name)).toEqual([
      AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION,
      AsyraDesignAiActionNames.UPDATE_COMPOSITION_ELEMENTS,
      AsyraDesignAiActionNames.REMOVE_AI_COMPOSITION,
      AsyraDesignAiActionNames.SET_ELEMENT_VISIBILITY,
      AsyraDesignAiActionNames.SELECT_ELEMENTS
    ])
    expect(Object.isFrozen(actions)).toBe(true)
    expect(actions.every((action) => Object.isFrozen(action))).toBe(true)
  })

  it('strictly parses visibility arguments without coercion or extra keys', () => {
    const action = actionByName(
      AsyraDesignAiActionNames.SET_ELEMENT_VISIBILITY,
      actionApis()
    )

    expect(
      action.schema.parse({
        elementId: 'shape-1',
        visible: false
      })
    ).toEqual({
      success: true,
      value: {
        elementId: 'shape-1',
        visible: false
      }
    })
    expect(
      action.schema.parse({
        elementId: 'shape-1',
        visible: 'false'
      })
    ).toMatchObject({
      success: false
    })
    expect(
      action.schema.parse({
        elementId: 'shape-1',
        visible: false,
        arbitraryCode: 'run()'
      })
    ).toMatchObject({
      success: false
    })
  })

  it('bounds and validates selection ids without silently repairing them', () => {
    const action = actionByName(
      AsyraDesignAiActionNames.SELECT_ELEMENTS,
      actionApis()
    )

    expect(
      action.schema.parse({
        elementIds: ['shape-1', 'shape-2']
      })
    ).toEqual({
      success: true,
      value: {
        elementIds: ['shape-1', 'shape-2']
      }
    })
    expect(
      action.schema.parse({
        elementIds: ['shape-1', 'shape-1']
      })
    ).toMatchObject({
      success: false
    })
    expect(
      action.schema.parse({
        elementIds: []
      })
    ).toMatchObject({
      success: false
    })
  })

  it('executes only through injected common API boundaries', async () => {
    const apis = actionApis()
    const visibility = actionByName(
      AsyraDesignAiActionNames.SET_ELEMENT_VISIBILITY,
      apis
    )
    const selection = actionByName(
      AsyraDesignAiActionNames.SELECT_ELEMENTS,
      apis
    )
    const context = Object.freeze({
      signal: new AbortController().signal
    })

    await expect(
      visibility.execute(
        {
          elementId: 'shape-1',
          visible: false
        },
        context
      )
    ).resolves.toEqual({
      action: AsyraDesignAiActionNames.SET_ELEMENT_VISIBILITY,
      elementId: 'shape-1',
      changed: true
    })
    await expect(
      selection.execute(
        {
          elementIds: ['shape-1', 'shape-2']
        },
        context
      )
    ).resolves.toEqual({
      action: AsyraDesignAiActionNames.SELECT_ELEMENTS,
      selectedCount: 2
    })

    expect(apis.setElementVisible).toHaveBeenCalledWith('shape-1', false, {
      undoable: true,
      sharedDelivery: 'transaction-end'
    })
    expect(apis.selectElements).toHaveBeenCalledWith(['shape-1', 'shape-2'], {
      undoable: true,
      sharedDelivery: 'transaction-end'
    })
  })

  it('checks abort before requesting any common API mutation', async () => {
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
        Object.freeze({
          signal: controller.signal
        })
      )
    ).rejects.toBeInstanceOf(AsyraDesignAiActionError)
    expect(apis.setElementVisible).not.toHaveBeenCalled()
    expect(apis.selectElements).not.toHaveBeenCalled()
  })
})
