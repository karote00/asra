import type { VectorPointNode, VectorTopology } from '@asyra/core'
import { VECTOR_TOKENS, isVectorAnchorNode as isAnchorNode } from '@asyra/core'
import { getCubicBezierSegmentBounds } from './bezier-adapter'

const MIN_VECTOR_SIZE = 0.1

const includePoint = (
  point: VectorPointNode,
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
) => {
  bounds.minX = Math.min(bounds.minX, point.x)
  bounds.minY = Math.min(bounds.minY, point.y)
  bounds.maxX = Math.max(bounds.maxX, point.x)
  bounds.maxY = Math.max(bounds.maxY, point.y)
}

const includeSegmentBounds = (
  segmentBounds: {
    minX: number
    maxX: number
    minY: number
    maxY: number
  },
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
) => {
  bounds.minX = Math.min(bounds.minX, segmentBounds.minX)
  bounds.minY = Math.min(bounds.minY, segmentBounds.minY)
  bounds.maxX = Math.max(bounds.maxX, segmentBounds.maxX)
  bounds.maxY = Math.max(bounds.maxY, segmentBounds.maxY)
}

export const calculateVectorBounds = (topology: VectorTopology) => {
  const anchorNodes = Object.values(topology.points).filter(
    (
      point
    ): point is VectorPointNode & {
      kind: typeof VECTOR_TOKENS.POINT.KIND.ANCHOR
    } => point.kind === VECTOR_TOKENS.POINT.KIND.ANCHOR
  )
  if (anchorNodes.length === 0) {
    return { x: 0, y: 0, width: MIN_VECTOR_SIZE, height: MIN_VECTOR_SIZE }
  }

  const bounds = {
    minX: anchorNodes[0].x,
    minY: anchorNodes[0].y,
    maxX: anchorNodes[0].x,
    maxY: anchorNodes[0].y
  }

  anchorNodes.forEach((point) => includePoint(point, bounds))

  Object.values(topology.segments).forEach((segment) => {
    const start = topology.points[segment.startId]
    const end = topology.points[segment.endId]
    if (!isAnchorNode(start) || !isAnchorNode(end)) {
      return
    }

    const outControl = segment.outControlId
      ? topology.points[segment.outControlId]
      : undefined
    const inControl = segment.inControlId
      ? topology.points[segment.inControlId]
      : undefined

    const p1 =
      outControl && outControl.kind === VECTOR_TOKENS.POINT.KIND.CONTROL
        ? { x: outControl.x, y: outControl.y }
        : { x: start.x, y: start.y }
    const p2 =
      inControl && inControl.kind === VECTOR_TOKENS.POINT.KIND.CONTROL
        ? { x: inControl.x, y: inControl.y }
        : { x: end.x, y: end.y }

    const hasCurve = !!(segment.outControlId || segment.inControlId)
    if (!hasCurve) {
      return
    }

    includeSegmentBounds(
      getCubicBezierSegmentBounds({ x: start.x, y: start.y }, p1, p2, {
        x: end.x,
        y: end.y
      }),
      bounds
    )
  })

  return {
    x: bounds.minX,
    y: bounds.minY,
    width: bounds.maxX - bounds.minX || MIN_VECTOR_SIZE,
    height: bounds.maxY - bounds.minY || MIN_VECTOR_SIZE
  }
}

export const normalizeVectorTopology = (
  topology: VectorTopology,
  bounds: { x: number; y: number }
): VectorTopology => {
  const normalizedPoints: Record<string, VectorPointNode> = {}

  Object.entries(topology.points).forEach(([pointId, point]) => {
    normalizedPoints[pointId] = {
      ...point,
      x: point.x - bounds.x,
      y: point.y - bounds.y
    }
  })

  return {
    points: normalizedPoints,
    segments: { ...topology.segments },
    networks: { ...topology.networks }
  }
}
