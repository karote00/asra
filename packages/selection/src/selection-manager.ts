import { SELECTION_TYPES } from '@asyra/utils'
import Selection from './selections/base-selection'

class SelectionManager {
  private selections: Map<string, Selection> = new Map()

  register(type: SELECTION_TYPES, selection: Selection): void {
    this.selections.set(type, selection)
  }

  get(type: SELECTION_TYPES): Selection | undefined {
    return this.selections.get(type)
  }

  clearAllSelections(): void {
    this.selections.forEach((selection) => selection.clear())
  }

  getElementSelectionIds(): string[] {
    return Array.from(
      this.selections.get(SELECTION_TYPES.ELEMENT)?.getSelectedIds() || []
    )
  }
}

export default SelectionManager
