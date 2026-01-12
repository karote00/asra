import {
  decideToCreateElement,
  decideToEndResizeElement,
  decideToResizeElement,
  decideToResetElementSize,
  decideToSelectElements
} from '@asra/reactive-events'
import { InteractionActions, InteractionEvent } from '@asra/utils'

export const ElementHandlers = {
  [InteractionActions.INTERACTION_CREATE_ELEMENT]: (
    payload?: InteractionEvent['payload'],
    options?: InteractionEvent['options']
  ) => {
    decideToCreateElement(payload.position, payload.elementType)
  },
  [InteractionActions.INTERACTION_RESIZE_ELEMENT]: (
    payload?: InteractionEvent['payload'],
    options?: InteractionEvent['options']
  ) => {
    decideToResizeElement(
      payload.dragStart,
      payload.position,
      payload.elementType,
      options
    )
  },
  [InteractionActions.INTERACTION_END_RESIZE_ELEMENT]: (
    payload?: InteractionEvent['payload'],
    options?: InteractionEvent['options']
  ) => {
    decideToEndResizeElement(payload.position, payload.elementType)
  },
  [InteractionActions.INTERACTION_RESET_ELEMENT_SIZE]: (
    payload?: InteractionEvent['payload'],
    options?: InteractionEvent['options']
  ) => {
    decideToResetElementSize(payload.dimension, payload.elementType)
  },
  [InteractionActions.INTERACTION_MOVE_ELEMENTS]: (
    payload?: InteractionEvent['payload'],
    options?: InteractionEvent['options']
  ) => {
    // TODO:
  },
  [InteractionActions.INTERACTION_DELETE_ELEMENTS]: (
    payload?: InteractionEvent['payload'],
    options?: InteractionEvent['options']
  ) => {
    // TODO:
  },
  [InteractionActions.INTERACTION_SELECT_ELEMENTS]: (
    payload?: InteractionEvent['payload'],
    options?: InteractionEvent['options']
  ) => {
    decideToSelectElements(payload.elementIds)
  }
}
