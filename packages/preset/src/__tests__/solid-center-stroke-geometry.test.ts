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
  dash: 20,
  gap: 20,
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
})
