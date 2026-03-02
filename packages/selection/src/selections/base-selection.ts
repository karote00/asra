import {
  OWNER,
  SELECTION_ACTIONS,
  SELECTION_TYPES,
  type EvnetOptions
} from '@asyra/utils'
import type { SelectionChange } from '@asyra/utils'

interface SelectionMetadata {
  selectionType: SELECTION_TYPES
  selectAction: SELECTION_ACTIONS
  eventName: string
}

export default class BaseSelection {
  protected selectedIds: Set<string> = new Set()
  protected prevSelectedIds: Set<string> = new Set()
  changes: SelectionChange[] = []

  constructor(private readonly metadata: SelectionMetadata) {}

  private _updatePrevSelectedIds(): void {
    this.prevSelectedIds = new Set(this.selectedIds)
  }

  private hasSameSelection(nextIds: string[]): boolean {
    if (nextIds.length !== this.selectedIds.size) {
      return false
    }

    return nextIds.every((id) => this.selectedIds.has(id))
  }

  select(ids: string[], options?: EvnetOptions): void {
    if (this.hasSameSelection(ids)) {
      return
    }

    const before = [...this.getSelectedIds()]
    this._updatePrevSelectedIds()
    this.selectedIds = new Set(ids)
    this.addChange(this.metadata.selectAction, before, [...ids], options)
  }

  deselect(ids: string[], options?: EvnetOptions): void {
    const nextSelectedIds = new Set(this.selectedIds)
    ids.forEach((id) => {
      nextSelectedIds.delete(id)
    })
    if (
      nextSelectedIds.size === this.selectedIds.size &&
      [...nextSelectedIds].every((id) => this.selectedIds.has(id))
    ) {
      return
    }

    const before = [...this.getSelectedIds()]
    this._updatePrevSelectedIds()
    this.selectedIds = nextSelectedIds
    this.addChange(
      this.metadata.selectAction,
      before,
      [...this.selectedIds],
      options
    )
  }

  clear(options?: EvnetOptions): void {
    if (this.selectedIds.size === 0) {
      return
    }

    const before = [...this.getSelectedIds()]
    this._updatePrevSelectedIds()
    this.selectedIds.clear()
    this.addChange(this.metadata.selectAction, before, [], options)
  }

  getSelectedIds(): Set<string> {
    return this.selectedIds
  }

  getPrevSelectedIds(): Set<string> {
    return this.prevSelectedIds
  }

  addChange(
    action: SELECTION_ACTIONS,
    before: string[],
    after: string[],
    options?: EvnetOptions
  ) {
    this.changes.push({
      selectionType: this.metadata.selectionType,
      action,
      owner: OWNER.ELEMENT_SELECTION,
      eventName: this.metadata.eventName,
      before,
      after,
      options
    })
  }

  cleanChanges() {
    this.changes = []
  }

  dispose() {
    this.selectedIds.clear()
    this.prevSelectedIds.clear()
    this.changes = []
  }

  reset() {
    this.dispose()
  }
}
