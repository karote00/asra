import { BehaviorSubject } from 'rxjs'
import { SelectionManager } from '@asra/selection'
import { SELECTION_TYPES } from '@asra/utils'
import uiContext from '../ui-context'

const SelectionTypes = Object.values(SELECTION_TYPES)
type SelectionDataTye = Set<string>

export default class SelectionStore {
  selectionManager: SelectionManager
  selections: Map<string, BehaviorSubject<SelectionDataTye>> = new Map()

  constructor(selectionManager: SelectionManager) {
    this.selectionManager = selectionManager
    SelectionTypes.forEach((type: SELECTION_TYPES) => {
      this.selections.set(
        type,
        new BehaviorSubject<SelectionDataTye>(new Set())
      )
    })
  }

  updateSelection(type: SELECTION_TYPES) {
    const selection = this.selectionManager.get(type)
    if (!selection) {
      return
    }

    const selected = this.selections.get(type)
    const selectedIds = selection.getSelectedIds()
    selected?.next(new Set(selectedIds))

    switch (type) {
      case SELECTION_TYPES.ELEMENT:
        uiContext.elementSelection.next(selectedIds)
        break
      case SELECTION_TYPES.VERTEX:
        uiContext.vertexSelection.next(selectedIds)
        break
    }
  }

  get elements() {
    return this.selections.get(SELECTION_TYPES.ELEMENT)
  }

  get vertex() {
    return this.selections.get(SELECTION_TYPES.VERTEX)
  }
}
