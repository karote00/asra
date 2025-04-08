import {
  endTransaction,
  selectElements,
  startTransaction
} from '@asra/reactive-events'
import selectionManager, { SelectionManager } from '@asra/selection'

export default class ElementSelectionManager {
  selection: SelectionManager = selectionManager

  select(elementIds: string[]) {
    startTransaction()
    selectElements(elementIds)
    endTransaction()
  }
}
