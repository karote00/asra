/**
 * Element Utility APIs - common element operations
 * Used in: create-element, and future features
 */

import {
  changeComputedData,
  startTransaction,
  endTransaction
} from '@asyra/reactive-events'
import { DEFAULT_ELEMENT_SIZE } from '@asyra/utils'
import { MOUSE_MOVEMENT_THRESHOLD } from '../constants'

export const elementApis = {
  /**
   * Reset element to default size
   */
  resetElementSize: (elementId: string) => {
    startTransaction()
    changeComputedData([elementId], 'width', DEFAULT_ELEMENT_SIZE)
    changeComputedData([elementId], 'height', DEFAULT_ELEMENT_SIZE)
    endTransaction()
  },

  /**
   * Check if user significantly moved the mouse
   * Helps distinguish intentional drag from accidental movement
   */
  hasMovedBeyondThreshold: (
    clientDragStart: { x: number; y: number },
    clientCurrentPos: { x: number; y: number },
    render: { getMousePosInWorkspace: (pos: any) => { x: number; y: number } },
    threshold = MOUSE_MOVEMENT_THRESHOLD
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
  },

  /**
   * Change element computed data (wrapped in transaction)
   */
  changeComputedData: (elementIds: string[], key: string, value: any) => {
    startTransaction()
    changeComputedData(elementIds, key, value)
    endTransaction()
  }
}
