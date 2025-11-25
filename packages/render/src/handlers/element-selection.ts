import {
  startTransaction,
  selectElements,
  endTransaction
} from '@asra/reactive-events'

export const ElementSelectionHandlers = {
  selectElement: (elementId: string) => {
    startTransaction()
    selectElements([elementId])
    endTransaction()
  },

  deselectAll: () => {
    startTransaction()
    selectElements([])
    endTransaction()
  }
}
