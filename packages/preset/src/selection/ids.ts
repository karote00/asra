import {
  VECTOR_TOKENS,
  type SelectedVectorSegmentState,
  type VectorSelectionRef
} from '@asyra/core'

const SELECTION_ID_SEPARATOR = ':'

export type VectorPointSelectionRef = VectorSelectionRef

export type VectorSegmentSelectionRef = Pick<
  SelectedVectorSegmentState,
  'elementId' | 'segmentId'
>

const encodeSelectionToken = (value: string): string =>
  encodeURIComponent(value)

const decodeSelectionToken = (value: string): string => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

const isVectorPointTarget = (
  value: string
): value is VectorSelectionRef['target'] =>
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

  return { elementId, pointId, target }
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

  return { elementId, segmentId }
}
