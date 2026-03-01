import type { VectorAnchorPoint } from '@asyra/core'
import type { PositionData } from '@asyra/utils'
import { getCubicBezierSegmentBounds } from './bezier-adapter'

const MIN_VECTOR_SIZE = 0.1

export const calculateVectorBounds = (anchorPoints: VectorAnchorPoint[]) => {
  if (anchorPoints.length === 0) {
    return { x: 0, y: 0, width: MIN_VECTOR_SIZE, height: MIN_VECTOR_SIZE }
  }

  let minX = anchorPoints[0].x
  let minY = anchorPoints[0].y
  let maxX = anchorPoints[0].x
  let maxY = anchorPoints[0].y

  const includePoint = (point: PositionData) => {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  }

  const includeSegmentBounds = (segmentBounds: {
    minX: number
    maxX: number
    minY: number
    maxY: number
  }) => {
    minX = Math.min(minX, segmentBounds.minX)
    minY = Math.min(minY, segmentBounds.minY)
    maxX = Math.max(maxX, segmentBounds.maxX)
    maxY = Math.max(maxY, segmentBounds.maxY)
  }

  let prev = anchorPoints[0]
  for (let i = 1; i < anchorPoints.length; i += 1) {
    const current = anchorPoints[i]
    includePoint(current)

    if (current.isMove) {
      prev = current
      continue
    }

    const hasCurve = !!prev.outHandle || !!current.inHandle
    if (!hasCurve) {
      prev = current
      continue
    }

    includeSegmentBounds(
      getCubicBezierSegmentBounds(
        { x: prev.x, y: prev.y },
        prev.outHandle ?? { x: prev.x, y: prev.y },
        current.inHandle ?? { x: current.x, y: current.y },
        { x: current.x, y: current.y }
      )
    )

    prev = current
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX || MIN_VECTOR_SIZE,
    height: maxY - minY || MIN_VECTOR_SIZE
  }
}

export const normalizeVectorAnchorPoints = (
  anchorPoints: VectorAnchorPoint[],
  bounds: { x: number; y: number }
): VectorAnchorPoint[] =>
  anchorPoints.map((point) => ({
    ...point,
    x: point.x - bounds.x,
    y: point.y - bounds.y,
    inHandle: point.inHandle
      ? {
          x: point.inHandle.x - bounds.x,
          y: point.inHandle.y - bounds.y
        }
      : null,
    outHandle: point.outHandle
      ? {
          x: point.outHandle.x - bounds.x,
          y: point.outHandle.y - bounds.y
        }
      : null
  }))

export const toWorkspaceAnchorPoint = (
  point: VectorAnchorPoint,
  computed: { x?: number; y?: number; width?: number; height?: number }
): VectorAnchorPoint => {
  const offsetX = typeof computed.x === 'number' ? computed.x : 0
  const offsetY = typeof computed.y === 'number' ? computed.y : 0
  const width = typeof computed.width === 'number' ? computed.width : 0
  const height = typeof computed.height === 'number' ? computed.height : 0

  const isLikelyLocal =
    point.x >= -1 &&
    point.x <= width + 1 &&
    point.y >= -1 &&
    point.y <= height + 1

  if (!isLikelyLocal) {
    return { ...point }
  }

  return {
    ...point,
    x: point.x + offsetX,
    y: point.y + offsetY,
    inHandle: point.inHandle
      ? {
          x: point.inHandle.x + offsetX,
          y: point.inHandle.y + offsetY
        }
      : null,
    outHandle: point.outHandle
      ? {
          x: point.outHandle.x + offsetX,
          y: point.outHandle.y + offsetY
        }
      : null
  }
}
