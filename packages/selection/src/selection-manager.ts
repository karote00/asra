import Selection from './selection'

class SelectionManager {
  private selections: Map<string, Selection> = new Map()

  register(name: string, selection: Selection): void {
    this.selections.set(name, selection)
  }

  get(name: string): Selection | undefined {
    return this.selections.get(name)
  }

  clearAllSelections(): void {
    this.selections.forEach((selection) => selection.clear())
  }
}

export default SelectionManager
