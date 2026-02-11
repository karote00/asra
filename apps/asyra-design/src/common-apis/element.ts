/**
 * Element Utility APIs - common element operations
 * Used in: create-element, and future features
 */

import { changeComputedData } from '@asyra/reactive-events'

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
  },

  /**
   * Change element computed data
   */
  changeComputedData
}
