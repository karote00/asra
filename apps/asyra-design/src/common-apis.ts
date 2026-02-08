/**
 * Feature APIs that can be reused across multiple features
 *
 * This file contains common APIs extracted from features for reuse.
 * As the framework evolves, some of these may move to core packages if needed.
 */

import {
  selectElements,
  startTransaction,
  endTransaction,
  changeComputedData
} from '@asyra/reactive-events'
import { selection } from './contexts'

/**
 * Transaction APIs - for data modifications
 * Used in: create-element, selection, and many future features
 */
export const transactionApis = {
  startTransaction,
  endTransaction
}

/**
 * Selection APIs - for managing element selection
 * Used in: selection, and future features like delete, copy, paste, move, resize
 */
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
  }
}

/**
 * Element Utility APIs - common element operations
 * Used in: create-element, and future features
 */
export const elementApis = {
  /**
   * Reset element to default size
   */
  resetElementSize: (elementId: string, defaultSize: number) => {
    changeComputedData([elementId], 'width', defaultSize)
    changeComputedData([elementId], 'height', defaultSize)
  },

  /**
   * Check if mouse has moved beyond threshold
   * Used to distinguish between click and drag
   */
  hasMovedWithViewport: (
    clientDragStart: { x: number; y: number },
    clientCurrentPos: { x: number; y: number },
    render: { getMousePosInWorkspace: (pos: any) => { x: number; y: number } },
    threshold = 1
  ) => {
    const dragStartWorkspace = render!.getMousePosInWorkspace({
      clientX: clientDragStart.x,
      clientY: clientDragStart.y
    })
    const currentWorkspace = render!.getMousePosInWorkspace({
      clientX: clientCurrentPos.x,
      clientY: clientCurrentPos.y
    })
    return (
      Math.abs(currentWorkspace.x - dragStartWorkspace.x) > threshold ||
      Math.abs(currentWorkspace.y - dragStartWorkspace.y) > threshold
    )
  }
}
