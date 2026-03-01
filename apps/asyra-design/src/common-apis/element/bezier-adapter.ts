import { Bezier } from 'bezier-js'
import type { PositionData } from '@asyra/utils'

export interface CubicBezierBounds {
  minX: number
  maxX: number
  minY: number
  maxY: number
}

export const getCubicBezierSegmentBounds = (
  p0: PositionData,
  p1: PositionData,
  p2: PositionData,
  p3: PositionData
): CubicBezierBounds => {
  const curve = new Bezier(p0.x, p0.y, p1.x, p1.y, p2.x, p2.y, p3.x, p3.y)
  const bbox = curve.bbox()

  return {
    minX: bbox.x.min,
    maxX: bbox.x.max,
    minY: bbox.y.min,
    maxY: bbox.y.max
  }
}

export const getClosestPointOnCubicBezier = (
  p0: PositionData,
  p1: PositionData,
  p2: PositionData,
  p3: PositionData,
  target: PositionData
): PositionData => {
  const curve = new Bezier(p0.x, p0.y, p1.x, p1.y, p2.x, p2.y, p3.x, p3.y)
  const projected = curve.project({ x: target.x, y: target.y })
  return { x: projected.x, y: projected.y }
}
