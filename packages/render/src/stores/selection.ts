import selectionManager, { SelectionManager } from '@asyra/selection'
import { SELECTION_TYPES } from '@asyra/utils'

class RenderSelection {
  selectionManager: SelectionManager
  elementSelection: Set<string>
  vectorPointSelection: Set<string>
  vectorSegmentSelection: Set<string>

  constructor() {
    this.selectionManager = selectionManager
    this.elementSelection = new Set()
    this.vectorPointSelection = new Set()
    this.vectorSegmentSelection = new Set()
  }

  getElementSelection() {
    const selection = this.selectionManager.get(SELECTION_TYPES.ELEMENT)
    return selection ? [...selection.getSelectedIds()] : []
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
        break
      }
      case SELECTION_TYPES.VECTOR_POINT:
        this.vectorPointSelection = new Set(selectedIds)
        break
      case SELECTION_TYPES.VECTOR_SEGMENT:
        this.vectorSegmentSelection = new Set(selectedIds)
        break
    }
  }
}

export { RenderSelection }

const renderStore = new RenderSelection()
export default renderStore
