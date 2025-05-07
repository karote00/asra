import { Factory } from '@asra/factory'

export interface UndoAPIs {
  undo: () => void
  redo: () => void
}

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
