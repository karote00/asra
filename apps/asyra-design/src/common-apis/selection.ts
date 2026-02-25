import { type EVENT_OPTIONS } from '@asyra/utils'

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
  clearSelection: (options?: EVENT_OPTIONS) => {
    core.selectElements([], options)
  },

  /**
   * Toggle selection of an element
   */
  toggleSelection: (elementId: string, options?: EVENT_OPTIONS) => {
    const currentIds = selection.getElementSelectionIds()
    const newIds = currentIds.includes(elementId)
      ? currentIds.filter((id: string) => id !== elementId)
      : [...currentIds, elementId]
    core.selectElements(newIds, options)
  },

  /**
   * Set selected elements (delegates to core)
   */
  selectElements: (elementIds: string[], options?: EVENT_OPTIONS) => {
    core.selectElements(elementIds, options)
  }
}
