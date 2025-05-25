import { subscribeToDecideToUndoRedo } from '@asra/reactive-events'
import { UNDO } from '@asra/utils'
import { UndoActionAPIs } from '../../types'

export const initUndoRedoHandlers = (apis: UndoActionAPIs) => {
  subscribeToDecideToUndoRedo(({ payload }) => {
    switch (payload.undoredo) {
      case UNDO.UNDO:
        apis.undo()
        break
      case UNDO.REDO:
        apis.redo()
        break
    }
  })
}
