import { EventTypes } from '@asra/reactive-events'
import { OWNER, SELECTION_ACTIONS } from '@asra/utils'
import type { SelectionChange } from '@asra/utils'

export default class BaseSelection {
  protected selectedIds: Set<string> = new Set()
  protected prevSelectedIds: Set<string> = new Set()
  changes: SelectionChange[] = []

  private _updatePrevSelectedIds(): void {
    this.prevSelectedIds = new Set(this.selectedIds)
  }

  select(ids: string[]): void {
    const before = [...this.getSelectedIds()]
    this._updatePrevSelectedIds()
    this.selectedIds = new Set(ids)
    this.addChange(SELECTION_ACTIONS.SELECT_ELEMENTS, before, [...ids])
  }

  deselect(ids: string[]): void {
    const before = [...this.getSelectedIds()]
    this._updatePrevSelectedIds()
    ids.forEach((id) => {
      this.selectedIds.delete(id)
    })
    this.addChange(SELECTION_ACTIONS.SELECT_ELEMENTS, before, [...ids])
  }

  clear(): void {
    const before = [...this.getSelectedIds()]
    this._updatePrevSelectedIds()
    this.selectedIds.clear()
    this.addChange(SELECTION_ACTIONS.SELECT_ELEMENTS, before, [])
  }

  getSelectedIds(): Set<string> {
    return this.selectedIds
  }

  getPrevSelectedIds(): Set<string> {
    return this.prevSelectedIds
  }

  addChange(action: SELECTION_ACTIONS, before: string[], after: string[]) {
    this.changes.push({
      action,
      owner: OWNER.ELEMENT_SELECTION,
      eventName: EventTypes.SELECT_ELEMENTS,
      before,
      after
    })
  }

  cleanChanges() {
    this.changes = []
  }
}
