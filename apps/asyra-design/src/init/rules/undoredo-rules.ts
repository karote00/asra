import { KeySnapshot, UNDO } from '@asyra/utils'
import type { DecisionResult } from '@asyra/interaction-core'
import { decideToUndoRedo } from '@asyra/reactive-events'

export const decideUndoRedoRules = (
  keySnapshot: KeySnapshot
): DecisionResult => {
  return {
    type: 'INTERACTION_UNDOREDO',
    payload: {
      undoredo: keySnapshot.shift ? UNDO.REDO : UNDO.UNDO
    },
    handler: (payload: any) => decideToUndoRedo(payload.undoredo)
  }
}
