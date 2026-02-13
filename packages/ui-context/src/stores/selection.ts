import selectionManager, { SelectionManager } from '@asyra/selection'
import { ComputedAttrs, SELECTION_TYPES } from '@asyra/utils'
import sceneTree from '@asyra/scene-tree'
import uiContext from '../ui-context'
import type { PropertyComputeContext } from '../property-registry'

export default class SelectionStore {
  selectionManager: SelectionManager

  constructor() {
    this.selectionManager = selectionManager
  }

  updateSelection(type: SELECTION_TYPES) {
    const selection = this.selectionManager.get(type)
    if (!selection) {
      return
    }

    const selectedIds = selection.getSelectedIds()

    switch (type) {
      case SELECTION_TYPES.ELEMENT: {
        uiContext.set('elementSelection', selectedIds)
        uiContext.recomputeSelectionProperties(
          this.buildSelectionContext(selectedIds)
        )
        break
      }
      case SELECTION_TYPES.VERTEX:
        uiContext.set('vertexSelection', selectedIds)
        break
    }
  }

  getCurrentSelectionContext(): PropertyComputeContext {
    const selection = this.selectionManager.get(SELECTION_TYPES.ELEMENT)
    const selectedIds = selection ? selection.getSelectedIds() : new Set<string>()
    return this.buildSelectionContext(selectedIds)
  }

  recomputeSelectionProperties(): void {
    uiContext.recomputeSelectionProperties(this.getCurrentSelectionContext())
  }

  private buildSelectionContext(
    selectedIds: Set<string>
  ): PropertyComputeContext {
    const elements = [...selectedIds].reduce((acc, elementId) => {
      const element = sceneTree.getElementById(elementId)
      if (!element) {
        return acc
      }

      const elementData = element.getAllComputedData() as ComputedAttrs
      acc.push(elementData)
      return acc
    }, [] as ComputedAttrs[])

    return {
      selectedIds,
      elements
    }
  }
}
