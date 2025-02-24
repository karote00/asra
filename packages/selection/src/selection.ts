export default class Selection {
  protected selectedIds: Set<string> = new Set()
  protected prevSelectedIds: Set<string> = new Set()

  select(ids: string[]): void {
    this.updatePrevSelectedIds()
    ids.forEach((id) => this.selectedIds.add(id))
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
