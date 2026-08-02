import { describe, expect, it, vi } from 'vitest'
import {
  AiActionError,
  AiActionNames,
  createAiActions,
  type AiActionApis
} from '../actions'

const actionApis = (): AiActionApis => ({
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
  setDrawingProgress: vi.fn(),
  setElementVisible: vi.fn(() => true),
  updateElementFillColor: vi.fn(),
  updateElementFillColors: vi.fn(() => []),
  updateElementStrokeColor: vi.fn(),
  updateElementStrokeColors: vi.fn(() => [])
})

const actionByName = (name: string, apis: AiActionApis) => {
  const action = createAiActions(apis).find(
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
    const actions = createAiActions(actionApis())

    expect(actions.map(({ name }) => name)).toEqual([
      AiActionNames.REQUEST_DRAWING_DETAIL_CHOICE,
      AiActionNames.INSERT_VECTOR_COMPOSITION,
      AiActionNames.UPDATE_COMPOSITION_ELEMENTS,
      AiActionNames.REMOVE_AI_COMPOSITION,
      AiActionNames.SET_ELEMENT_VISIBILITY,
      AiActionNames.SELECT_ELEMENTS
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
      AiActionNames.REQUEST_DRAWING_DETAIL_CHOICE,
      apis
    )

    await expect(action.execute({}, executionContext())).resolves.toEqual({
      action: AiActionNames.REQUEST_DRAWING_DETAIL_CHOICE,
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
    const visibility = actionByName(AiActionNames.SET_ELEMENT_VISIBILITY, apis)
    const selection = actionByName(AiActionNames.SELECT_ELEMENTS, apis)

    await expect(
      visibility.execute(
        {
          elementId: 'shape-1',
          visible: false
        },
        executionContext()
      )
    ).resolves.toEqual({
      action: AiActionNames.SET_ELEMENT_VISIBILITY,
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
      action: AiActionNames.SELECT_ELEMENTS,
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
    const action = actionByName(AiActionNames.SET_ELEMENT_VISIBILITY, apis)
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
    ).rejects.toBeInstanceOf(AiActionError)
    expect(apis.setElementVisible).not.toHaveBeenCalled()
  })
})
