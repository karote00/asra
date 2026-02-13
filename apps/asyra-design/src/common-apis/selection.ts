/**
 * Selection APIs - for managing element selection
 * Used in: selection, and future features like delete, copy, paste, move, resize
 */

import core, { selection } from '../contexts'

export const selectionApis = {
  /**
   * Get currently selected element IDs
   */
  getSelectedIds: () => {
    return selection.getElementSelectionIds()
  },

  /**
   * Clear all selections
   */
  clearSelection: () => {
    core.selectElements([])
  },

  /**
   * Toggle selection of an element
   */
  toggleSelection: (elementId: string) => {
    const currentIds = selection.getElementSelectionIds()
    const newIds = currentIds.includes(elementId)
      ? currentIds.filter((id: string) => id !== elementId)
      : [...currentIds, elementId]
    core.selectElements(newIds)
  },

  /**
   * Set selected elements (delegates to core)
   */
  selectElements: (elementIds: string[]) => {
    core.selectElements(elementIds)
  }
}
