import type { PositionData } from '../types/index.js'

export interface GeometryTransformMatrix {
  a: number
  b: number
  c: number
  d: number
  tx: number
  ty: number
}

export const transformGeometryPoint = (
  matrix: GeometryTransformMatrix,
  point: PositionData
): PositionData => ({
  x: matrix.a * point.x + matrix.c * point.y + matrix.tx,
  y: matrix.b * point.x + matrix.d * point.y + matrix.ty
})

export const getPointDistance = (
  from: PositionData,
  to: PositionData
): number => Math.hypot(to.x - from.x, to.y - from.y)

export const getPointDistanceSquared = (
  from: PositionData,
  to: PositionData
): number => {
  const dx = to.x - from.x
  const dy = to.y - from.y
  return dx * dx + dy * dy
}

export const subdivideCubicBezierAtHalf = (
  p0: PositionData,
  p1: PositionData,
  p2: PositionData,
  p3: PositionData
) => {
  const p01 = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 }
  const p12 = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }
  const p23 = { x: (p2.x + p3.x) / 2, y: (p2.y + p3.y) / 2 }
  const p012 = { x: (p01.x + p12.x) / 2, y: (p01.y + p12.y) / 2 }
  const p123 = { x: (p12.x + p23.x) / 2, y: (p12.y + p23.y) / 2 }
  const p0123 = { x: (p012.x + p123.x) / 2, y: (p012.y + p123.y) / 2 }

  return {
    left: [p0, p01, p012, p0123] as const,
    right: [p0123, p123, p23, p3] as const
  }
}
