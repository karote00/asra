import { Bezier } from 'bezier-js'
import { clampUnit, type Bounds, type PositionData } from '@asyra/utils'

export type CubicBezierBounds = Bounds

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

export interface CubicBezierProjection {
  position: PositionData
  t: number
}

export interface CubicBezierSplitControls {
  splitPoint: PositionData
  startOutControl: PositionData
  splitInControl: PositionData
  splitOutControl: PositionData
  endInControl: PositionData
}

export const projectPointToCubicBezier = (
  p0: PositionData,
  p1: PositionData,
  p2: PositionData,
  p3: PositionData,
  target: PositionData
): CubicBezierProjection => {
  const curve = new Bezier(p0.x, p0.y, p1.x, p1.y, p2.x, p2.y, p3.x, p3.y)
  const projected = curve.project({ x: target.x, y: target.y })
  const rawT =
    typeof (projected as { t?: unknown }).t === 'number'
      ? ((projected as { t: number }).t ?? 0)
      : 0
  const t = clampUnit(rawT)

  return {
    position: { x: projected.x, y: projected.y },
    t
  }
}

export const splitCubicBezierAtT = (
  p0: PositionData,
  p1: PositionData,
  p2: PositionData,
  p3: PositionData,
  t: number
): CubicBezierSplitControls => {
  const clampedT = clampUnit(t)
  const curve = new Bezier(p0.x, p0.y, p1.x, p1.y, p2.x, p2.y, p3.x, p3.y)
  const splitResult = curve.split(clampedT) as unknown as {
    left?: { points?: { x: number; y: number }[] }
    right?: { points?: { x: number; y: number }[] }
  }

  const leftPoints = splitResult.left?.points ?? []
  const rightPoints = splitResult.right?.points ?? []

  if (leftPoints.length >= 4 && rightPoints.length >= 4) {
    const splitPoint = leftPoints[3]
    return {
      splitPoint: { x: splitPoint.x, y: splitPoint.y },
      startOutControl: { x: leftPoints[1].x, y: leftPoints[1].y },
      splitInControl: { x: leftPoints[2].x, y: leftPoints[2].y },
      splitOutControl: { x: rightPoints[1].x, y: rightPoints[1].y },
      endInControl: { x: rightPoints[2].x, y: rightPoints[2].y }
    }
  }

  const lerp = (from: PositionData, to: PositionData): PositionData => ({
    x: from.x + (to.x - from.x) * clampedT,
    y: from.y + (to.y - from.y) * clampedT
  })
  const a = lerp(p0, p1)
  const b = lerp(p1, p2)
  const c = lerp(p2, p3)
  const d = lerp(a, b)
  const e = lerp(b, c)
  const splitPoint = lerp(d, e)

  return {
    splitPoint,
    startOutControl: a,
    splitInControl: d,
    splitOutControl: e,
    endInControl: c
  }
}
