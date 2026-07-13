import selectionManager, { SelectionManager } from '@asyra/selection'

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
    const selection = this.selectionManager.get('element')
    return selection ? [...selection.getSelectedIds()] : []
  }

  updateSelection(type: string) {
    const selection = this.selectionManager.get(type)
    if (!selection) {
      return
    }

    const selectedIds = selection.getSelectedIds()

    switch (type) {
      case 'element': {
        this.elementSelection = new Set(selectedIds)
        break
      }
      case 'vectorPoint':
        this.vectorPointSelection = new Set(selectedIds)
        break
      case 'vectorSegment':
        this.vectorSegmentSelection = new Set(selectedIds)
        break
    }
  }
}

export { RenderSelection }

const renderStore = new RenderSelection()
export default renderStore
