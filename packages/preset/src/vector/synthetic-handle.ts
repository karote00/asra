import { getPointDistance, type PositionData } from '@asyra/utils'

const SYNTHETIC_HANDLE_MIN_LENGTH = 14
const SYNTHETIC_HANDLE_MAX_LENGTH = 56
const SYNTHETIC_HANDLE_POINT_EPSILON = 0.5

const isVisibleHandlePosition = (
  anchor: PositionData,
  handle: PositionData | null | undefined
): handle is PositionData =>
  !!handle && getPointDistance(anchor, handle) > SYNTHETIC_HANDLE_POINT_EPSILON

const clampSyntheticHandleLength = (
  desiredLength: number,
  segmentLength: number
): number => {
  if (segmentLength <= SYNTHETIC_HANDLE_POINT_EPSILON) {
    return 0
  }

  return Math.min(
    SYNTHETIC_HANDLE_MAX_LENGTH,
    segmentLength * 0.45,
    Math.max(SYNTHETIC_HANDLE_MIN_LENGTH, desiredLength)
  )
}

export const resolveSyntheticVectorHandlePosition = (
  anchor: PositionData,
  actualHandle: PositionData | null | undefined,
  neighbor: PositionData | null,
  mirroredHandle: PositionData | null
): PositionData | null => {
  if (isVisibleHandlePosition(anchor, actualHandle)) {
    return { x: actualHandle.x, y: actualHandle.y }
  }

  if (!neighbor) {
    return null
  }

  const dx = neighbor.x - anchor.x
  const dy = neighbor.y - anchor.y
  const segmentLength = Math.hypot(dx, dy)
  if (segmentLength <= SYNTHETIC_HANDLE_POINT_EPSILON) {
    return null
  }

  const mirroredLength = isVisibleHandlePosition(anchor, mirroredHandle)
    ? getPointDistance(anchor, mirroredHandle)
    : segmentLength / 3
  const handleLength = clampSyntheticHandleLength(mirroredLength, segmentLength)
  if (handleLength <= SYNTHETIC_HANDLE_POINT_EPSILON) {
    return null
  }

  const scale = handleLength / segmentLength
  return {
    x: anchor.x + dx * scale,
    y: anchor.y + dy * scale
  }
}
