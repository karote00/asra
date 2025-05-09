import { Factory } from '@asra/factory'
import { UndoAPIs } from '../types/core-apis'

export const createUndoAPIs = (factory: Factory): UndoAPIs => {
  return {
    undo() {
      factory.undo()
    },
    redo() {
      factory.redo()
    }
  }
}
