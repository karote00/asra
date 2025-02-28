import { selectElements } from '@asra/reactive-events'
import selectionManager, { SelectionManager } from '@asra/selection'

export default class ElementSelectionManager {
  selection: SelectionManager = selectionManager

  select(elementIds: string[]) {
    selectElements(elementIds)
  }
}
