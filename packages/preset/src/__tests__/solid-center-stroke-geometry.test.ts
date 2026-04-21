import { describe, expect, it } from 'vitest'
import {
  buildSolidCenterStrokePolygons,
  supportsSolidCenterStroke
} from '../components/stroke-render/solid-center-stroke-geometry'
import type { RenderableStroke } from '../components/stroke-render/renderable-stroke'

interface Vec2 {
  x: number
  y: number
}

const createStroke = (
  overrides: Partial<RenderableStroke> = {}
): RenderableStroke => ({
  style: 'solid',
  position: 'center',
  width: 4,
  dashPattern: [20, 20],
  dashOffset: 0,
  join: 'miter',
  miterLimit: 4,
  cap: 'square',
  color: 0x3366ff,
  alpha: 1,
  ...overrides
})

const getBounds = (polygon: Vec2[]) => {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  polygon.forEach((point) => {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  })

  return { minX, minY, maxX, maxY }
}

const hasPoint = (polygon: Vec2[], expected: Vec2) =>
  polygon.some(
    (point) =>
      Math.abs(point.x - expected.x) < 1e-6 && Math.abs(point.y - expected.y) < 1e-6
  )

const hasPolygonWithPoints = (polygons: Vec2[][], expected: Vec2[]) =>
  polygons.some((polygon) => expected.every((point) => hasPoint(polygon, point)))

const isPointInPolygon = (point: Vec2, polygon: Vec2[]) => {
  let inside = false

  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
    const current = polygon[index]
    const prior = polygon[previous]
    const intersects =
      current.y > point.y !== prior.y > point.y &&
      point.x <
        ((prior.x - current.x) * (point.y - current.y)) /
          (prior.y - current.y) +
          current.x

    if (intersects) {
      inside = !inside
    }
  }

  return inside
}

const isPointInPolygons = (point: Vec2, polygons: Vec2[][]) =>
  polygons.some((polygon) => isPointInPolygon(point, polygon))

describe('solid center stroke geometry', () => {
  it('should run: accept the supported solid-center stroke slice', () => {
    expect(
      supportsSolidCenterStroke(
        createStroke({
          join: 'bevel',
          cap: 'butt'
        })
      )
    ).toBe(true)
  })

  it('should not run: reject unsupported stroke modes from the solid-center slice', () => {
    expect(
      supportsSolidCenterStroke(
        createStroke({
          style: 'dashed'
        })
      )
    ).toBe(false)

    expect(
      supportsSolidCenterStroke(
        createStroke({
          position: 'inside'
        })
      )
    ).toBe(false)

    expect(
      supportsSolidCenterStroke(
        createStroke({
          join: 'round'
        })
      )
    ).toBe(false)

    expect(
      supportsSolidCenterStroke(
        createStroke({
          cap: 'round'
        })
      )
    ).toBe(false)
  })

  it('should run: build square-capped open-path polygons for the supported slice', () => {
    const polygons = buildSolidCenterStrokePolygons(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 }
      ],
      false,
      createStroke({
        cap: 'square'
      })
    )

    expect(polygons).toHaveLength(1)
    expect(getBounds(polygons[0])).toEqual({
      minX: -2,
      minY: -2,
      maxX: 12,
      maxY: 2
    })
  })

  it('should run: build open bevel turns with explicit diagonal corner points instead of midpoint joins', () => {
    const polygons = buildSolidCenterStrokePolygons(
      [
        { x: 0, y: 0 },
        { x: 80, y: 0 },
        { x: 80, y: 7 }
      ],
      false,
      createStroke({
        width: 10,
        join: 'bevel',
        cap: 'butt'
      })
    )

    expect(polygons).toHaveLength(1)
    expect(hasPoint(polygons[0], { x: 80, y: 5 })).toBe(true)
    expect(hasPoint(polygons[0], { x: 75, y: 0 })).toBe(true)
    expect(hasPoint(polygons[0], { x: 85, y: 0 })).toBe(true)
    expect(hasPoint(polygons[0], { x: 80, y: -5 })).toBe(true)
    expect(hasPoint(polygons[0], { x: 77.5, y: 2.5 })).toBe(false)
    expect(hasPoint(polygons[0], { x: 82.5, y: -2.5 })).toBe(false)
  })

  it('should run: keep the inner turn corridor filled for open miter turns with a short post-turn remainder', () => {
    const polygons = buildSolidCenterStrokePolygons(
      [
        { x: 329, y: 0 },
        { x: 353.09, y: 0 },
        { x: 353.09, y: 2.91 }
      ],
      false,
      createStroke({
        width: 10,
        join: 'miter',
        cap: 'butt'
      })
    )

    expect(isPointInPolygons({ x: 349, y: 4 }, polygons)).toBe(true)
    expect(isPointInPolygons({ x: 353, y: 4 }, polygons)).toBe(true)
    expect(isPointInPolygons({ x: 356, y: -2 }, polygons)).toBe(true)
  })

  it('should run: decompose closed solid rectangles into non-self-intersecting segment polygons', () => {
    const polygons = buildSolidCenterStrokePolygons(
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 20 },
        { x: 0, y: 20 }
      ],
      true,
      createStroke({
        cap: 'butt'
      })
    )

    expect(polygons).toHaveLength(4)
    expect(polygons.every((polygon) => polygon.length === 4)).toBe(true)

    const allPoints = polygons.flat()
    expect(allPoints).toContainEqual({ x: -2, y: -2 })
    expect(allPoints).toContainEqual({ x: 22, y: -2 })
    expect(allPoints).toContainEqual({ x: 22, y: 22 })
    expect(allPoints).toContainEqual({ x: -2, y: 22 })
  })

  it('should run: decompose closed bevel rectangles into edge quads plus inner/outer corner bevel polygons', () => {
    const polygons = buildSolidCenterStrokePolygons(
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 20 },
        { x: 0, y: 20 }
      ],
      true,
      createStroke({
        join: 'bevel',
        cap: 'butt'
      })
    )

    expect(polygons).toHaveLength(12)

    expect(
      hasPolygonWithPoints(polygons, [
        { x: 0, y: 2 },
        { x: 20, y: 2 },
        { x: 20, y: -2 },
        { x: 0, y: -2 }
      ])
    ).toBe(true)

    expect(
      hasPolygonWithPoints(polygons, [
        { x: -2, y: 0 },
        { x: 0, y: -2 },
        { x: 0, y: 0 }
      ])
    ).toBe(true)

    expect(
      hasPolygonWithPoints(polygons, [
        { x: 20, y: -2 },
        { x: 22, y: 0 },
        { x: 20, y: 0 }
      ])
    ).toBe(true)

    expect(
      hasPolygonWithPoints(polygons, [
        { x: 0, y: 2 },
        { x: 2, y: 0 },
        { x: 0, y: 0 }
      ])
    ).toBe(true)
  })
})
