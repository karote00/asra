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
  dashPattern: [20, 20],
  dashOffset: 0,
  join: 'miter',
  miterLimit: 4,
  cap: 'butt',
  kind: 'solid',
  color: 0x3366ff,
  alpha: 1,
  gradientStyle: null,
  paintKey: 'solid:3366ff:1',
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

  it('should run: accept simple open constrained solid slices', () => {
    expect(
      supportsConstrainedSolidStroke(
        createStroke({
          position: 'inside'
        }),
        false
      )
    ).toBe(true)

    expect(
      supportsConstrainedSolidStroke(
        createStroke({
          position: 'outside'
        }),
        false
      )
    ).toBe(true)
  })

  it('should not run: reject unsupported constrained solid slices', () => {
    expect(
      supportsConstrainedSolidStroke(
        createStroke({
          position: 'center'
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
    ).toBe(true)

    expect(
      supportsConstrainedSolidStroke(
        createStroke({
          cap: 'round'
        }),
        true
      )
    ).toBe(true)
  })

  it('should run: build open inside geometry on the authored left side only', () => {
    const polygons = buildConstrainedSolidStrokePolygons(
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 }
      ],
      false,
      createStroke({
        position: 'inside',
        width: 4
      })
    )

    expect(polygons).toEqual([
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 4 },
        { x: 0, y: 4 }
      ]
    ])
  })

  it('should run: keep self-intersecting open constrained solid paths visible as local-side geometry', () => {
    const polygons = buildConstrainedSolidStrokePolygons(
      [
        { x: 0, y: 0 },
        { x: 20, y: 20 },
        { x: 0, y: 20 },
        { x: 20, y: 0 }
      ],
      false,
      createStroke({
        position: 'inside',
        width: 4
      }),
      { assumeSimpleOpen: true }
    )

    expect(polygons.length).toBeGreaterThan(0)
  })

  it('should run: build open outside geometry on the authored right side only', () => {
    const polygons = buildConstrainedSolidStrokePolygons(
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 }
      ],
      false,
      createStroke({
        position: 'outside',
        width: 4
      })
    )

    expect(polygons).toEqual([
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: -4 },
        { x: 0, y: -4 }
      ]
    ])
  })

  it('should run: apply square caps before one-sided open constrained geometry is built', () => {
    const polygons = buildConstrainedSolidStrokePolygons(
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 }
      ],
      false,
      createStroke({
        position: 'inside',
        width: 4,
        cap: 'square'
      })
    )

    expect(getBounds(polygons)).toEqual({
      minX: -2,
      minY: 0,
      maxX: 22,
      maxY: 4
    })
  })

  it('should run: build one-sided round caps without mirrored ghost geometry', () => {
    const polygons = buildConstrainedSolidStrokePolygons(
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 }
      ],
      false,
      createStroke({
        position: 'inside',
        width: 4,
        cap: 'round'
      })
    )

    const bounds = getBounds(polygons)
    expect(polygons.length).toBeGreaterThan(1)
    expect(bounds.minX).toBeGreaterThanOrEqual(-2.001)
    expect(bounds.maxX).toBeLessThanOrEqual(22.001)
    expect(bounds.minY).toBeGreaterThanOrEqual(0)
    expect(bounds.maxY).toBeLessThanOrEqual(4)
  })

  it('should run: use one-sided offset distance for open constrained miter limit checks', () => {
    const polygons = buildConstrainedSolidStrokePolygons(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 }
      ],
      false,
      createStroke({
        position: 'inside',
        width: 4,
        join: 'miter',
        miterLimit: 2
      })
    )

    expect(polygons).toContainEqual([
      { x: 10, y: 0 },
      { x: 10, y: 4 },
      { x: 6, y: 4 },
      { x: 6, y: 0 }
    ])
  })

  it('should run: resolve open constrained miter-limit exceedance as bevel geometry', () => {
    const polygons = buildConstrainedSolidStrokePolygons(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 }
      ],
      false,
      createStroke({
        position: 'inside',
        width: 4,
        join: 'miter',
        miterLimit: 1
      })
    )

    expect(polygons).toContainEqual([
      { x: 10, y: 0 },
      { x: 10, y: 4 },
      { x: 8, y: 2 },
      { x: 6, y: 0 }
    ])
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

    expect(polygons).toHaveLength(8)
    expect(getBounds(polygons)).toEqual({
      minX: 0,
      minY: 0,
      maxX: 20,
      maxY: 20
    })
    expect(polygons).toEqual(
      expect.arrayContaining([
        [
          { x: 0, y: 0 },
          { x: 20, y: 0 },
          { x: 20, y: 4 },
          { x: 0, y: 4 }
        ],
        [
          { x: 20, y: 0 },
          { x: 20, y: 4 },
          { x: 16, y: 4 },
          { x: 16, y: 0 }
        ]
      ])
    )
  })

  it('should run: build closed inside bevel joins as explicit one-sided join faces', () => {
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
        width: 4,
        join: 'bevel'
      })
    )

    expect(polygons).toContainEqual([
      { x: 20, y: 0 },
      { x: 20, y: 4 },
      { x: 16, y: 0 }
    ])
    expect(polygons).not.toContainEqual([
      { x: 20, y: 0 },
      { x: 20, y: 4 },
      { x: 16, y: 4 },
      { x: 16, y: 0 }
    ])
  })

  it('should run: resolve closed miter-limit exceedance as bevel join geometry', () => {
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
        width: 4,
        join: 'miter',
        miterLimit: 1
      })
    )

    expect(polygons).toContainEqual([
      { x: 20, y: 0 },
      { x: 20, y: 4 },
      { x: 16, y: 0 }
    ])
    expect(polygons).not.toContainEqual([
      { x: 20, y: 0 },
      { x: 20, y: 4 },
      { x: 16, y: 4 },
      { x: 16, y: 0 }
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

  it('should run: build inside round-join constrained solid geometry on closed paths', () => {
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
        width: 4,
        join: 'round',
        cap: 'round'
      })
    )

    expect(polygons.length).toBeGreaterThan(4)
    expect(polygons.some((polygon) => polygon.length > 4)).toBe(true)
    expect(getBounds(polygons)).toEqual({
      minX: 0,
      minY: 0,
      maxX: 20,
      maxY: 20
    })
  })

  it('should run: build outside round-join constrained solid geometry on closed paths', () => {
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
        width: 4,
        join: 'round',
        cap: 'round'
      })
    )

    expect(polygons.length).toBeGreaterThan(4)
    expect(polygons.some((polygon) => polygon.length > 4)).toBe(true)
    expect(getBounds(polygons)).toEqual({
      minX: -4,
      minY: -4,
      maxX: 24,
      maxY: 24
    })
  })

  it('should run: build closed self-intersecting constrained paths as local-side faces', () => {
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

    expect(polygons).toHaveLength(8)
    expect(getBounds(polygons)).toEqual({
      minX: -9.656854249492383,
      minY: -4,
      maxX: 29.656854249492376,
      maxY: 22.82842712474619
    })
  })
})
