import selectionManager, { SelectionManager } from '@asra/selection'
import { SELECTION_TYPES } from '@asra/utils'
import render from '../render'

class RenderSelection {
  selectionManager: SelectionManager
  elementSelection: Set<string>

  constructor() {
    this.selectionManager = selectionManager
    this.elementSelection = new Set()
  }

  getElementSelection() {
    const selection = this.selectionManager.get(SELECTION_TYPES.ELEMENT)
    return selection ? selection.getSelectedIds() : []
  }

  updateSelection(type: SELECTION_TYPES) {
    const selection = this.selectionManager.get(type)
    if (!selection) {
      return
    }

    const selectedIds = selection.getSelectedIds()

    switch (type) {
      case SELECTION_TYPES.ELEMENT: {
        this.elementSelection = new Set(selectedIds)
        render.updateSelectedSelection()
        break
      }
      case SELECTION_TYPES.VERTEX:
        break
    }
  }
}

export { RenderSelection }

const renderStore = new RenderSelection()
export default renderStore
