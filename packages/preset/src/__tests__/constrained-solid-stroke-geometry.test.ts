import { describe, expect, it } from 'vitest'
import type { RenderableStroke } from '../components/stroke-render/renderable-stroke'
import {
  buildConstrainedSolidStrokePolygons,
  supportsConstrainedSolidStroke
} from '../components/stroke-render/constrained-solid-stroke-geometry'

const createStroke = (
  overrides: Partial<RenderableStroke> = {}
): RenderableStroke => ({
  style: 'solid',
  position: 'inside',
  width: 4,
  dash: 20,
  gap: 20,
  join: 'miter',
  miterLimit: 4,
  cap: 'butt',
  color: 0x3366ff,
  alpha: 1,
  ...overrides
})

const getBounds = (polygons: { x: number; y: number }[][]) => {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  polygons.forEach((polygon) =>
    polygon.forEach((point) => {
      minX = Math.min(minX, point.x)
      minY = Math.min(minY, point.y)
      maxX = Math.max(maxX, point.x)
      maxY = Math.max(maxY, point.y)
    })
  )

  return { minX, minY, maxX, maxY }
}

describe('constrained solid stroke geometry', () => {
  it('should run: accept supported constrained solid slices on closed paths', () => {
    expect(
      supportsConstrainedSolidStroke(
        createStroke({
          position: 'inside',
          join: 'bevel'
        }),
        true
      )
    ).toBe(true)

    expect(
      supportsConstrainedSolidStroke(
        createStroke({
          position: 'outside'
        }),
        true
      )
    ).toBe(true)
  })

  it('should not run: reject open or unsupported constrained solid slices', () => {
    expect(
      supportsConstrainedSolidStroke(
        createStroke({
          position: 'inside'
        }),
        false
      )
    ).toBe(false)

    expect(
      supportsConstrainedSolidStroke(
        createStroke({
          position: 'center'
        }),
        true
      )
    ).toBe(false)

    expect(
      supportsConstrainedSolidStroke(
        createStroke({
          join: 'round'
        }),
        true
      )
    ).toBe(false)
  })

  it('should run: keep inside geometry inside the legal owner domain for rectangles', () => {
    const polygons = buildConstrainedSolidStrokePolygons(
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 20 },
        { x: 0, y: 20 }
      ],
      true,
      createStroke({
        position: 'inside',
        width: 4
      })
    )

    expect(polygons).toHaveLength(4)
    expect(getBounds(polygons)).toEqual({
      minX: 0,
      minY: 0,
      maxX: 20,
      maxY: 20
    })
    expect(polygons).toEqual([
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 16, y: 4 },
        { x: 4, y: 4 }
      ],
      [
        { x: 20, y: 0 },
        { x: 20, y: 20 },
        { x: 16, y: 16 },
        { x: 16, y: 4 }
      ],
      [
        { x: 20, y: 20 },
        { x: 0, y: 20 },
        { x: 4, y: 16 },
        { x: 16, y: 16 }
      ],
      [
        { x: 0, y: 20 },
        { x: 0, y: 0 },
        { x: 4, y: 4 },
        { x: 4, y: 16 }
      ]
    ])
  })

  it('should run: keep outside geometry outside the legal owner domain for rectangles', () => {
    const polygons = buildConstrainedSolidStrokePolygons(
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 20 },
        { x: 0, y: 20 }
      ],
      true,
      createStroke({
        position: 'outside',
        width: 4
      })
    )

    expect(polygons).toHaveLength(4)
    expect(getBounds(polygons)).toEqual({
      minX: -4,
      minY: -4,
      maxX: 24,
      maxY: 24
    })
  })

  it('should not run: reject self-intersecting constrained paths deterministically', () => {
    const polygons = buildConstrainedSolidStrokePolygons(
      [
        { x: 0, y: 0 },
        { x: 20, y: 20 },
        { x: 0, y: 20 },
        { x: 20, y: 0 }
      ],
      true,
      createStroke({
        position: 'inside',
        width: 4
      })
    )

    expect(polygons).toEqual([])
  })
})
