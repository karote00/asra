import { MapRegistry } from '@asyra/utils'
import Selection from './selections/base-selection'

class SelectionManager {
  private selections = new MapRegistry<string, Selection>()

  register(type: string, selection: Selection): void {
    this.selections.register(type, selection, {
      duplicateErrorMessage: `Selection "${type}" is already registered`
    })
  }

  get(type: string): Selection | undefined {
    return this.selections.get(type)
  }

  getChannelByAction(action: string): string | undefined {
    for (const [channel, selection] of this.selections.entries()) {
      if (
        selection.getSelectAction() === action ||
        selection.getEventName() === action
      ) {
        return channel
      }
    }
    return undefined
  }

  clearAllSelections(): void {
    this.selections.values().forEach((selection) => selection.clear())
  }

  getElementSelectionIds(): string[] {
    return Array.from(this.selections.get('element')?.getSelectedIds() || [])
  }
}

export default SelectionManager
