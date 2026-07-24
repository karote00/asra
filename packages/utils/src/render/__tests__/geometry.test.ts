import { describe, expect, it } from 'vitest'
import {
  getPointDistance,
  getPointDistanceSquared,
  subdivideCubicBezierAtHalf,
  transformGeometryPoint
} from '../geometry'

describe('geometry helpers', () => {
  it('projects points and measures distance', () => {
    expect(
      transformGeometryPoint(
        { a: 0, b: 1, c: -1, d: 0, tx: 10, ty: 20 },
        { x: 3, y: 4 }
      )
    ).toEqual({ x: 6, y: 23 })
    expect(getPointDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5)
    expect(getPointDistanceSquared({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(25)
  })

  it('subdivides a cubic Bezier at its midpoint', () => {
    expect(
      subdivideCubicBezierAtHalf(
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 2 },
        { x: 4, y: 2 }
      )
    ).toEqual({
      left: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1.5, y: 0.5 },
        { x: 2, y: 1 }
      ],
      right: [
        { x: 2, y: 1 },
        { x: 2.5, y: 1.5 },
        { x: 3, y: 2 },
        { x: 4, y: 2 }
      ]
    })
  })
})
