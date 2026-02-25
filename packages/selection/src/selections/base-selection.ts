import { OWNER, SELECTION_ACTIONS, type EvnetOptions } from '@asyra/utils'
import type { SelectionChange } from '@asyra/utils'

export default class BaseSelection {
  protected selectedIds: Set<string> = new Set()
  protected prevSelectedIds: Set<string> = new Set()
  changes: SelectionChange[] = []

  private _updatePrevSelectedIds(): void {
    this.prevSelectedIds = new Set(this.selectedIds)
  }

  select(ids: string[], options?: EvnetOptions): void {
    const before = [...this.getSelectedIds()]
    this._updatePrevSelectedIds()
    this.selectedIds = new Set(ids)
    this.addChange(SELECTION_ACTIONS.SELECT_ELEMENTS, before, [...ids], options)
  }

  deselect(ids: string[], options?: EvnetOptions): void {
    const before = [...this.getSelectedIds()]
    this._updatePrevSelectedIds()
    ids.forEach((id) => {
      this.selectedIds.delete(id)
    })
    this.addChange(SELECTION_ACTIONS.SELECT_ELEMENTS, before, [...ids], options)
  }

  clear(options?: EvnetOptions): void {
    const before = [...this.getSelectedIds()]
    this._updatePrevSelectedIds()
    this.selectedIds.clear()
    this.addChange(SELECTION_ACTIONS.SELECT_ELEMENTS, before, [], options)
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
      action,
      owner: OWNER.ELEMENT_SELECTION,
      eventName: 'selectElements',
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
