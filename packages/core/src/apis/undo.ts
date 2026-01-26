import { redo, undo } from '@asyra/reactive-events'
import { UndoActionAPIs } from '../types'

export const createUndoAPIs = (): UndoActionAPIs => {
  return {
    undo() {
      undo()
    },
    redo() {
      redo()
    }
  }
}
