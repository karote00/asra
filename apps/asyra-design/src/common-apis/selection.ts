/**
 * Selection APIs - for managing element selection
 * Used in: selection, and future features like delete, copy, paste, move, resize
 */

import {
  selectElements,
  startTransaction,
  endTransaction
} from '@asyra/reactive-events'
import { selection } from '../contexts'

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
    startTransaction()
    selectElements([])
    endTransaction()
  },

  /**
   * Toggle selection of an element
   */
  toggleSelection: (elementId: string) => {
    const currentIds = selection.getElementSelectionIds()
    startTransaction()
    if (currentIds.includes(elementId)) {
      selectElements(currentIds.filter((id) => id !== elementId))
    } else {
      selectElements([...currentIds, elementId])
    }
    endTransaction()
  },

  /**
   * Set selected elements
   */
  selectElements
}
