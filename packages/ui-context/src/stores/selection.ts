import { SelectionManager } from '@asra/selection'
import { ComputedAttrs, SELECTION_TYPES } from '@asra/utils'
import sceneTree from '@asra/scene-tree'
import uiContext from '../ui-context'

export default class SelectionStore {
  selectionManager: SelectionManager

  constructor(selectionManager: SelectionManager) {
    this.selectionManager = selectionManager
  }

  updateSelection(type: SELECTION_TYPES) {
    const selection = this.selectionManager.get(type)
    if (!selection) {
      return
    }

    const selectedIds = selection.getSelectedIds()

    switch (type) {
      case SELECTION_TYPES.ELEMENT:
        uiContext.updateElementSelection(selectedIds)
        const allElementData = [...selectedIds].reduce((acc, elementId) => {
          const element = sceneTree.getElementById(elementId)
          if (!element) {
            return acc
          }

          const elementData = element.getAllComputedData() as ComputedAttrs
          acc.push(elementData)
          return acc
        }, [] as ComputedAttrs[])
        if (selectedIds.size) {
          uiContext.updateComputedProperties(allElementData)
        }
        break
      case SELECTION_TYPES.VERTEX:
        uiContext.updateVertexSelection(selectedIds)
        break
    }
  }
}
