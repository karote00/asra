import { type EVENT_OPTIONS, SELECTION_TYPES } from '@asyra/utils'
import { VECTOR_TOKENS, type VectorPointTarget } from '@asyra/core'

/**
 * Selection APIs - for managing element selection
 * Used in: selection, and future features like delete, copy, paste, move, resize
 */

import core, { selection } from '../contexts'

const SELECTION_ID_SEPARATOR = ':'

export interface VectorPointSelectionRef {
  elementId: string
  pointId: string
  target: VectorPointTarget
}

export interface VectorSegmentSelectionRef {
  elementId: string
  segmentId: string
}

const encodeSelectionToken = (value: string) => encodeURIComponent(value)
const decodeSelectionToken = (value: string) => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

const isVectorPointTarget = (value: string): value is VectorPointTarget =>
  value === VECTOR_TOKENS.POINT.TARGET.ANCHOR ||
  value === VECTOR_TOKENS.POINT.TARGET.IN_HANDLE ||
  value === VECTOR_TOKENS.POINT.TARGET.OUT_HANDLE

export const encodeVectorPointSelectionId = (
  value: VectorPointSelectionRef
): string =>
  [
    encodeSelectionToken(value.elementId),
    encodeSelectionToken(value.pointId),
    encodeSelectionToken(value.target)
  ].join(SELECTION_ID_SEPARATOR)

export const decodeVectorPointSelectionId = (
  value: string
): VectorPointSelectionRef | null => {
  const parts = value.split(SELECTION_ID_SEPARATOR)
  if (parts.length !== 3) {
    return null
  }

  const elementId = decodeSelectionToken(parts[0])
  const pointId = decodeSelectionToken(parts[1])
  const target = decodeSelectionToken(parts[2])

  if (!elementId || !pointId || !isVectorPointTarget(target)) {
    return null
  }

  return {
    elementId,
    pointId,
    target
  }
}

export const encodeVectorSegmentSelectionId = (
  value: VectorSegmentSelectionRef
): string =>
  [
    encodeSelectionToken(value.elementId),
    encodeSelectionToken(value.segmentId)
  ].join(SELECTION_ID_SEPARATOR)

export const decodeVectorSegmentSelectionId = (
  value: string
): VectorSegmentSelectionRef | null => {
  const parts = value.split(SELECTION_ID_SEPARATOR)
  if (parts.length !== 2) {
    return null
  }

  const elementId = decodeSelectionToken(parts[0])
  const segmentId = decodeSelectionToken(parts[1])

  if (!elementId || !segmentId) {
    return null
  }

  return {
    elementId,
    segmentId
  }
}

const getSelectionIds = (selectionType: SELECTION_TYPES): string[] => {
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
    return getSelectionIds(SELECTION_TYPES.VECTOR_POINT)
  },

  getVectorSegmentSelectionIds: () => {
    return getSelectionIds(SELECTION_TYPES.VECTOR_SEGMENT)
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
