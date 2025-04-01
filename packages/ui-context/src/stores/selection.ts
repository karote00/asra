import { BehaviorSubject } from 'rxjs'
import { SelectionManager } from '@asra/selection'
import { ComputedAttrs, SELECTION_TYPES } from '@asra/utils'
import uiContext from '../ui-context'
import sceneTree from '@asra/scene-tree/dist/sceneTree'

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
        uiContext.updateComputedProperties(allElementData)
        break
      case SELECTION_TYPES.VERTEX:
        uiContext.updateVertexSelection(selectedIds)
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
