import { redo, undo } from '@asra/reactive-events'
import { UndoAPIs } from '../types/core-apis'

export const createUndoAPIs = (): UndoAPIs => {
  return {
    undo() {
      undo()
    },
    redo() {
      redo()
    }
  }
}
