export default class BaseSelection {
  protected selectedIds: Set<string> = new Set()
  protected prevSelectedIds: Set<string> = new Set()

  select(ids: string[]): void {
    this.updatePrevSelectedIds()
    this.selectedIds = new Set(ids)
  }

  deselect(id: string): void {
    this.updatePrevSelectedIds()
    this.selectedIds.delete(id)
  }

  clear(): void {
    this.updatePrevSelectedIds()
    this.selectedIds.clear()
  }

  updatePrevSelectedIds(): void {
    this.prevSelectedIds = new Set(this.selectedIds)
  }

  getSelectedIds(): Set<string> {
    return this.selectedIds
  }

  getPrevSelectedIds(): Set<string> {
    return this.prevSelectedIds
  }
}
