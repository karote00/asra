import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ElementHandlers } from '../element'
import {
  InteractionActions,
  PrimaryToolType,
  DEFAULT_ELEMENT_SIZE
} from '@asra/utils'
import * as reactiveEvents from '@asra/reactive-events'

vi.mock('@asra/reactive-events', () => ({
  decideToCreateElement: vi.fn(),
  decideToEndResizeElement: vi.fn(),
  decideToResizeElement: vi.fn(),
  decideToResetElementSize: vi.fn(),
  decideToSelectElements: vi.fn()
}))

describe('ElementHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should call decideToCreateElement for INTERACTION_CREATE_ELEMENT', () => {
    const payload = {
      position: { x: 10, y: 20 },
      elementType: PrimaryToolType.RECTANGLE
    }
    ElementHandlers[InteractionActions.INTERACTION_CREATE_ELEMENT](payload)
    expect(reactiveEvents.decideToCreateElement).toHaveBeenCalledWith(
      payload.position,
      payload.elementType
    )
  })

  it('should call decideToResizeElement for INTERACTION_RESIZE_ELEMENT', () => {
    const payload = {
      dragStart: { x: 0, y: 0 },
      position: { x: 10, y: 20 },
      elementType: PrimaryToolType.RECTANGLE
    }
    const options = { undoable: false }
    ElementHandlers[InteractionActions.INTERACTION_RESIZE_ELEMENT](
      payload,
      options
    )
    expect(reactiveEvents.decideToResizeElement).toHaveBeenCalledWith(
      payload.dragStart,
      payload.position,
      payload.elementType,
      options
    )
  })

  it('should call decideToEndResizeElement for INTERACTION_END_RESIZE_ELEMENT', () => {
    const payload = {
      position: { x: 10, y: 20 },
      elementType: PrimaryToolType.RECTANGLE
    }
    ElementHandlers[InteractionActions.INTERACTION_END_RESIZE_ELEMENT](payload)
    expect(reactiveEvents.decideToEndResizeElement).toHaveBeenCalledWith(
      payload.position,
      payload.elementType
    )
  })

  it('should call decideToResetElementSize for INTERACTION_RESET_ELEMENT_SIZE', () => {
    const payload = {
      dimension: { width: DEFAULT_ELEMENT_SIZE, height: DEFAULT_ELEMENT_SIZE },
      elementType: PrimaryToolType.RECTANGLE
    }
    ElementHandlers[InteractionActions.INTERACTION_RESET_ELEMENT_SIZE](payload)
    expect(reactiveEvents.decideToResetElementSize).toHaveBeenCalledWith(
      payload.dimension,
      payload.elementType
    )
  })

  it('should call decideToSelectElements for INTERACTION_SELECT_ELEMENTS', () => {
    const payload = { elementIds: ['element-1', 'element-2'] }
    ElementHandlers[InteractionActions.INTERACTION_SELECT_ELEMENTS](payload)
    expect(reactiveEvents.decideToSelectElements).toHaveBeenCalledWith(
      payload.elementIds
    )
  })

  // Test for TODOs (INTERACTION_MOVE_ELEMENTS, INTERACTION_DELETE_ELEMENTS)
  it('should not throw for INTERACTION_MOVE_ELEMENTS (TODO)', () => {
    const payload = { ids: ['element-1'], delta: { x: 5, y: 5 } }
    expect(() =>
      ElementHandlers[InteractionActions.INTERACTION_MOVE_ELEMENTS](payload)
    ).not.toThrow()
  })

  it('should not throw for INTERACTION_DELETE_ELEMENTS (TODO)', () => {
    const payload = { ids: ['element-1'] }
    expect(() =>
      ElementHandlers[InteractionActions.INTERACTION_DELETE_ELEMENTS](payload)
    ).not.toThrow()
  })
})
