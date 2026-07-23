import { type EVENT_OPTIONS } from '@asyra/utils'
import {
  SelectionChannels,
  decodeVectorPointSelectionId,
  decodeVectorSegmentSelectionId,
  encodeVectorPointSelectionId,
  encodeVectorSegmentSelectionId,
  type VectorPointSelectionRef,
  type VectorSegmentSelectionRef
} from '@asyra/preset'

/**
 * Selection APIs - for managing element selection
 * Used in: selection, and future features like delete, copy, paste, move, resize
 */

import core, { selection } from '../contexts'

export {
  decodeVectorPointSelectionId,
  decodeVectorSegmentSelectionId,
  encodeVectorPointSelectionId,
  encodeVectorSegmentSelectionId
}
export type { VectorPointSelectionRef, VectorSegmentSelectionRef }

const getSelectionIds = (selectionType: string): string[] => {
  const selectionState = core.getSelection(selectionType)
  if (selectionState) {
    return [...selectionState.getSelectedIds()]
  }

  return []
}

export const selectionApis = {
  /**
   * Get currently selected element IDs
   */
  getSelectedIds: () => {
    return selection.getElementSelectionIds()
  },

  getVectorPointSelectionIds: () => {
    return getSelectionIds(SelectionChannels.VECTOR_POINT)
  },

  getVectorSegmentSelectionIds: () => {
    return getSelectionIds(SelectionChannels.VECTOR_SEGMENT)
  },

  getSelectedVectorPoints: (): VectorPointSelectionRef[] => {
    return selectionApis
      .getVectorPointSelectionIds()
      .map((id) => decodeVectorPointSelectionId(id))
      .filter((item): item is VectorPointSelectionRef => item !== null)
  },

  getSelectedVectorSegments: (): VectorSegmentSelectionRef[] => {
    return selectionApis
      .getVectorSegmentSelectionIds()
      .map((id) => decodeVectorSegmentSelectionId(id))
      .filter((item): item is VectorSegmentSelectionRef => item !== null)
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
  },

  /**
   * Set selected vector points (encoded ids)
   */
  selectVectorPoints: (pointIds: string[], options?: EVENT_OPTIONS) => {
    core.selectVectorPoints(pointIds, options)
  },

  selectVectorPoint: (
    point: VectorPointSelectionRef,
    options?: EVENT_OPTIONS
  ) => {
    selectionApis.selectVectorPoints(
      [encodeVectorPointSelectionId(point)],
      options
    )
  },

  clearVectorPointSelection: (options?: EVENT_OPTIONS) => {
    selectionApis.selectVectorPoints([], options)
  },

  /**
   * Set selected vector segments (encoded ids)
   */
  selectVectorSegments: (segmentIds: string[], options?: EVENT_OPTIONS) => {
    core.selectVectorSegments(segmentIds, options)
  },

  selectVectorSegment: (
    segment: VectorSegmentSelectionRef,
    options?: EVENT_OPTIONS
  ) => {
    selectionApis.selectVectorSegments(
      [encodeVectorSegmentSelectionId(segment)],
      options
    )
  },

  clearVectorSegmentSelection: (options?: EVENT_OPTIONS) => {
    selectionApis.selectVectorSegments([], options)
  }
}
