import { subscribeToDecideToUndoRedo } from '@asra/reactive-events'
import { UndoActionAPIs } from '../../types'
import { UNDO } from '@asra/utils'

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
