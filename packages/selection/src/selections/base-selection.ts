export default class BaseSelection {
  protected selectedIds: Set<string> = new Set()
  protected prevSelectedIds: Set<string> = new Set()

  private _updatePrevSelectedIds(): void {
    this.prevSelectedIds = new Set(this.selectedIds)
  }

  select(ids: string[]): void {
    this._updatePrevSelectedIds()
    this.selectedIds = new Set(ids)
  }

  deselect(id: string): void {
    this._updatePrevSelectedIds()
    this.selectedIds.delete(id)
  }

  clear(): void {
    this._updatePrevSelectedIds()
    this.selectedIds.clear()
  }

  getSelectedIds(): Set<string> {
    return this.selectedIds
  }

  getPrevSelectedIds(): Set<string> {
    return this.prevSelectedIds
  }
}
