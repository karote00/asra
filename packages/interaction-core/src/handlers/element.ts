import {
  decideToCreateElement,
  decideToEndResizeElement,
  decideToResizeElement,
  decideToResetElementSize
} from '@asra/reactive-events'
import { InteractionActions, InteractionEvent } from '@asra/utils'

export const ElementHandlers = {
  [InteractionActions.INTERACTION_CREATE_ELEMENT]: (
    payload?: InteractionEvent['payload']
  ) => {
    decideToCreateElement(payload.position, payload.elementType)
  },
  [InteractionActions.INTERACTION_RESIZE_ELEMENT]: (
    payload?: InteractionEvent['payload']
  ) => {
    decideToResizeElement(
      payload.dragStart,
      payload.position,
      payload.elementType
    )
  },
  [InteractionActions.INTERACTION_END_RESIZE_ELEMENT]: (
    payload?: InteractionEvent['payload']
  ) => {
    decideToEndResizeElement(payload.position, payload.elementType)
  },
  [InteractionActions.INTERACTION_RESET_ELEMENT_SIZE]: (
    payload?: InteractionEvent['payload']
  ) => {
    decideToResetElementSize(payload.dimension, payload.elementType)
  },
  [InteractionActions.INTERACTION_MOVE_ELEMENTS]: (
    payload?: InteractionEvent['payload']
  ) => {
    // TODO:
  },
  [InteractionActions.INTERACTION_DELETE_ELEMENTS]: (
    payload?: InteractionEvent['payload']
  ) => {
    // TODO:
  },
  [InteractionActions.INTERACTION_SELECT_ELEMENTS]: (
    payload?: InteractionEvent['payload']
  ) => {
    // TODO:
  }
}
