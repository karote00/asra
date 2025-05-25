import { decideToCreateElement } from '@asra/reactive-events'
import { InteractionActions, InteractionEvent } from '@asra/utils'

export const ElementHandlers = {
  [InteractionActions.INTERACTION_CREATE_ELEMENT]: (
    payload?: InteractionEvent['payload']
  ) => {
    decideToCreateElement(payload.position, payload.elementType)
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
