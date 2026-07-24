import type { PositionData } from '@asyra/utils'
import {
  isVectorHandleMode,
  VectorHandleModes,
  type VectorHandleMode
} from '../../constants'
import { VECTOR_TOKENS } from '@asyra/core'
import type { VectorPointNode } from '@asyra/core'
import type { VectorPointTarget } from './types'

const HANDLE_MODE_EPSILON = 1e-6

const toVector = (anchor: PositionData, handle: PositionData | null) => {
  if (!handle) {
    return null
  }

  return {
    x: handle.x - anchor.x,
    y: handle.y - anchor.y
  }
}

const vectorLength = (vector: PositionData | null) => {
  if (!vector) {
    return 0
  }

  return Math.hypot(vector.x, vector.y)
}

const normalizeVector = (vector: PositionData | null) => {
  if (!vector) {
    return null
  }

  const length = vectorLength(vector)
  if (length <= HANDLE_MODE_EPSILON) {
    return null
  }

  return {
    x: vector.x / length,
    y: vector.y / length
  }
}

const mirrorFromDirection = (
  anchor: PositionData,
  direction: PositionData,
  length: number
) => ({
  x: anchor.x - direction.x * length,
  y: anchor.y - direction.y * length
})

const alignFromDirection = (
  anchor: PositionData,
  direction: PositionData,
  length: number
) => ({
  x: anchor.x + direction.x * length,
  y: anchor.y + direction.y * length
})

const addVector = (anchor: PositionData, vector: PositionData) => ({
  x: anchor.x + vector.x,
  y: anchor.y + vector.y
})

const subtractVector = (anchor: PositionData, vector: PositionData) => ({
  x: anchor.x - vector.x,
  y: anchor.y - vector.y
})

export const getVectorAnchorHandleMode = (
  point: VectorPointNode | undefined
): VectorHandleMode =>
  point?.kind === VECTOR_TOKENS.POINT.KIND.ANCHOR &&
  isVectorHandleMode(point.handleMode)
    ? point.handleMode
    : VectorHandleModes.NONE

export const resolveHandleModeDragUpdate = (params: {
  anchor: PositionData
  inHandle: PositionData | null
  outHandle: PositionData | null
  target: Exclude<VectorPointTarget, typeof VECTOR_TOKENS.POINT.TARGET.ANCHOR>
  position: PositionData
  mode: VectorHandleMode
}): {
  nextIn: PositionData | null | undefined
  nextOut: PositionData | null | undefined
} => {
  const { anchor, inHandle, outHandle, target, position, mode } = params

  if (mode === VectorHandleModes.NONE) {
    return {
      nextIn:
        target === VECTOR_TOKENS.POINT.TARGET.IN_HANDLE ? position : undefined,
      nextOut:
        target === VECTOR_TOKENS.POINT.TARGET.OUT_HANDLE ? position : undefined
    }
  }

  const targetVector = toVector(anchor, position)
  const direction = normalizeVector(targetVector)

  if (mode === VectorHandleModes.MIRROR_ANGLE_LENGTH) {
    if (!targetVector) {
      return {
        nextIn:
          target === VECTOR_TOKENS.POINT.TARGET.IN_HANDLE
            ? position
            : undefined,
        nextOut:
          target === VECTOR_TOKENS.POINT.TARGET.OUT_HANDLE
            ? position
            : undefined
      }
    }

    const opposite = {
      x: anchor.x - targetVector.x,
      y: anchor.y - targetVector.y
    }

    return {
      nextIn:
        target === VECTOR_TOKENS.POINT.TARGET.IN_HANDLE ? position : opposite,
      nextOut:
        target === VECTOR_TOKENS.POINT.TARGET.OUT_HANDLE ? position : opposite
    }
  }

  if (!direction) {
    return {
      nextIn:
        target === VECTOR_TOKENS.POINT.TARGET.IN_HANDLE ? position : undefined,
      nextOut:
        target === VECTOR_TOKENS.POINT.TARGET.OUT_HANDLE ? position : undefined
    }
  }

  if (target === VECTOR_TOKENS.POINT.TARGET.OUT_HANDLE) {
    const inLength = inHandle
      ? vectorLength(toVector(anchor, inHandle))
      : vectorLength(targetVector)

    return {
      nextOut: position,
      nextIn: mirrorFromDirection(anchor, direction, inLength)
    }
  }

  const outLength = outHandle
    ? vectorLength(toVector(anchor, outHandle))
    : vectorLength(targetVector)

  return {
    nextIn: position,
    nextOut: mirrorFromDirection(anchor, direction, outLength)
  }
}

export const resolveHandleModeSwitchUpdate = (params: {
  anchor: PositionData
  inHandle: PositionData | null
  outHandle: PositionData | null
  mode: VectorHandleMode
}): {
  inHandle: PositionData | null
  outHandle: PositionData | null
} | null => {
  const { anchor, inHandle, outHandle, mode } = params

  if (mode === VectorHandleModes.NONE) {
    return null
  }

  const inVector = toVector(anchor, inHandle)
  const outVector = toVector(anchor, outHandle)

  if (mode === VectorHandleModes.MIRROR_ANGLE_LENGTH) {
    const baseVector = outVector ?? inVector
    if (!baseVector) {
      return null
    }

    const hasOutVector = !!outVector

    return {
      outHandle: hasOutVector
        ? addVector(anchor, baseVector)
        : subtractVector(anchor, baseVector),
      inHandle: hasOutVector
        ? subtractVector(anchor, baseVector)
        : addVector(anchor, baseVector)
    }
  }

  const hasOutVector = outVector !== null
  const direction = normalizeVector(outVector) ?? normalizeVector(inVector)
  if (!direction) {
    return null
  }

  let outLength = 0
  if (inVector) {
    outLength = vectorLength(inVector)
  }
  if (outVector !== null) {
    outLength = vectorLength(outVector)
  }

  let inLength = 0
  if (outVector) {
    inLength = vectorLength(outVector)
  }
  if (inVector !== null) {
    inLength = vectorLength(inVector)
  }

  return {
    outHandle: hasOutVector
      ? alignFromDirection(anchor, direction, outLength)
      : mirrorFromDirection(anchor, direction, outLength),
    inHandle: hasOutVector
      ? mirrorFromDirection(anchor, direction, inLength)
      : alignFromDirection(anchor, direction, inLength)
  }
}
