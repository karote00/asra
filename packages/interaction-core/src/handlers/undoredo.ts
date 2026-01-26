import { decideToUndoRedo } from '@asyra/reactive-events'
import { InteractionActions, InteractionEvent } from '@asyra/utils'

export const UndoRedoHandlers = {
  [InteractionActions.INTERACTION_UNDOREDO]: (
    payload?: InteractionEvent['payload'],
    options?: InteractionEvent['options']
  ) => {
    decideToUndoRedo(payload.undoredo)
  }
}
