import { decideToUndoRedo } from '@asra/reactive-events'
import { InteractionActions, InteractionEvent } from '@asra/utils'

export const UndoRedoHandlers = {
  [InteractionActions.INTERACTION_UNDOREDO]: (
    payload?: InteractionEvent['payload'],
    options?: InteractionEvent['options']
  ) => {
    decideToUndoRedo(payload.undoredo)
  }
}
