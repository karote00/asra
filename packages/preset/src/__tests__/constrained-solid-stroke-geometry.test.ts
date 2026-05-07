import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import type { VectorNetwork, VectorPointNode, VectorSegment } from '@asyra/core'
import Clipper2ZFactory from 'clipper2-wasm'
import type { RenderableStroke } from '../components/stroke-render/renderable-stroke'
import {
  buildConstrainedSolidStrokePolygons,
  supportsConstrainedSolidStroke
} from '../components/stroke-render/constrained-solid-stroke-geometry'
import { buildSelfIntersectingClosedConstrainedDashedLocalSidePolygons } from '../components/stroke-render/constrained-dashed-local-side-geometry'
import { buildVectorGeometryModelPath } from '../components/stroke-render/path-geometry'
import {
  createClipper2GeometryBackend,
  type Clipper2Module
} from '../components/stroke-render/clipper2-geometry-backend'

const require = createRequire(import.meta.url)
const wasmPath = require.resolve('clipper2-wasm/dist/umd/clipper2z.wasm')

const loadClipperModule = async () =>
  (await (
    Clipper2ZFactory as (options: {
      wasmBinary: Uint8Array
    }) => Promise<Clipper2Module>
  )({
    wasmBinary: readFileSync(wasmPath)
  })) as Clipper2Module

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

const createReportedVector6Fixture = () => {
  const points: Record<string, VectorPointNode> = {
    'tp-12': {
      id: 'tp-12',
      kind: 'anchor',
      x: 192.42083700791653,
      y: 0,
      anchorType: 'sharp'
    },
    'tp-13': {
      id: 'tp-13',
      kind: 'anchor',
      x: 11.358174406717296,
      y: 364.1297089212308,
      anchorType: 'smooth'
    },
    'tp-12:out': {
      id: 'tp-12:out',
      kind: 'control',
      x: 170.10536493824844,
      y: 119.07041481724248,
      controlForId: 'tp-12',
      controlRole: 'out'
    },
    'tp-13:in': {
      id: 'tp-13:in',
      kind: 'control',
      x: -42.09205809548172,
      y: 343.2841182453731,
      controlForId: 'tp-13',
      controlRole: 'in'
    },
    'tp-13:out': {
      id: 'tp-13:out',
      kind: 'control',
      x: 78.17096503446606,
      y: 390.18669726605293,
      controlForId: 'tp-13',
      controlRole: 'out'
    },
    'tp-14': {
      id: 'tp-14',
      kind: 'anchor',
      x: 360.120941483566,
      y: 144.31562775593738,
      anchorType: 'sharp'
    },
    'tp-15': {
      id: 'tp-15',
      kind: 'anchor',
      x: 0,
      y: 14.030686031827244,
      anchorType: 'sharp'
    },
    'tp-16': {
      id: 'tp-16',
      kind: 'anchor',
      x: 270.59180204238254,
      y: 345.42212754546125,
      anchorType: 'smooth'
    },
    'tp-15:out': {
      id: 'tp-15:out',
      kind: 'control',
      x: 0,
      y: 14.030686031827244,
      controlForId: 'tp-15',
      controlRole: 'out'
    },
    'tp-16:in': {
      id: 'tp-16:in',
      kind: 'control',
      x: 263.9105229796076,
      y: 362.79345310867603,
      controlForId: 'tp-16',
      controlRole: 'in'
    },
    'tp-16:out': {
      id: 'tp-16:out',
      kind: 'control',
      x: 277.2730811051575,
      y: 328.05080198224647,
      controlForId: 'tp-16',
      controlRole: 'out'
    }
  }
  const segments: Record<string, VectorSegment> = {
    'ts-23': {
      id: 'ts-23',
      startId: 'tp-12',
      endId: 'tp-13',
      outControlId: 'tp-12:out',
      inControlId: 'tp-13:in'
    },
    'ts-24': {
      id: 'ts-24',
      startId: 'tp-13',
      endId: 'tp-14',
      outControlId: 'tp-13:out',
      inControlId: null
    },
    'ts-25': {
      id: 'ts-25',
      startId: 'tp-14',
      endId: 'tp-15',
      outControlId: null,
      inControlId: null
    },
    'ts-26': {
      id: 'ts-26',
      startId: 'tp-15',
      endId: 'tp-16',
      outControlId: 'tp-15:out',
      inControlId: 'tp-16:in'
    },
    'ts-27': {
      id: 'ts-27',
      startId: 'tp-16',
      endId: 'tp-12',
      outControlId: 'tp-16:out',
      inControlId: null
    }
  }
  const network: VectorNetwork = {
    id: 'tn-4',
    pointIds: ['tp-12', 'tp-13', 'tp-14', 'tp-15', 'tp-16'],
    segmentIds: ['ts-23', 'ts-24', 'ts-25', 'ts-26', 'ts-27'],
    closed: true
  }

  return { network, points, segments }
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
    expect(polygons).toHaveLength(1)
    expect(bounds.minX).toBeGreaterThanOrEqual(-2.001)
    expect(bounds.maxX).toBeLessThanOrEqual(22.001)
    expect(bounds.minY).toBeGreaterThanOrEqual(0)
    expect(bounds.maxY).toBeLessThanOrEqual(4)
  })

  it('should run: preserve one-sided round caps on normalized multi-point open strips', () => {
    const polygons = buildConstrainedSolidStrokePolygons(
      [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 10, y: 0 },
        { x: 15, y: 0 },
        { x: 20, y: 0 }
      ],
      false,
      createStroke({
        position: 'inside',
        width: 4,
        cap: 'round'
      }),
      {
        assumeSimpleOpen: true,
        assumeNormalizedOpen: true
      }
    )

    const bounds = getBounds(polygons)
    expect(polygons).toHaveLength(1)
    expect(bounds.minX).toBeLessThan(-1.9)
    expect(bounds.maxX).toBeGreaterThan(21.9)
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

    expect(polygons).toHaveLength(1)
    expect(polygons[0]).toEqual(
      expect.arrayContaining([
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 6, y: 10 },
        { x: 6, y: 4 }
      ])
    )
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

    expect(polygons).toHaveLength(1)
    expect(polygons[0]).toEqual(
      expect.arrayContaining([
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 6, y: 10 },
        { x: 8, y: 2 }
      ])
    )
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

    expect(polygons).toHaveLength(8)
    expect(getBounds(polygons)).toEqual({
      minX: -4,
      minY: -4,
      maxX: 24,
      maxY: 24
    })
    expect(polygons).toContainEqual([
      { x: 0, y: 0 },
      { x: -4, y: 0 },
      { x: -4, y: -4 },
      { x: 0, y: -4 }
    ])
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

  it('should run: reject closed self-intersecting constrained paths from the product solid geometry helper and keep dashed local-side isolated', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 20, y: 20 },
      { x: 0, y: 20 },
      { x: 20, y: 0 }
    ]
    const stroke = createStroke({
      position: 'inside',
      width: 4
    })
    const polygons = buildConstrainedSolidStrokePolygons(points, true, stroke)

    expect(polygons).toEqual([])

    const dashedApproximation =
      buildSelfIntersectingClosedConstrainedDashedLocalSidePolygons(
        points,
        stroke
      )
    expect(dashedApproximation).toHaveLength(8)
    expect(getBounds(dashedApproximation)).toEqual({
      minX: -9.656854249492383,
      minY: -4,
      maxX: 29.656854249492376,
      maxY: 22.82842712474619
    })
  })

  it('should run: keep reported inside-solid self-intersecting geometry out of the local-side helper when exact backend is available', async () => {
    const exactBackend = createClipper2GeometryBackend(
      await loadClipperModule()
    )
    const { network, points, segments } = createReportedVector6Fixture()
    const path = buildVectorGeometryModelPath(network, points, segments)
    const guardPoints = network.pointIds.map((pointId) => {
      const point = points[pointId]
      if (point.kind !== 'anchor') {
        throw new Error(`Expected anchor point ${pointId}`)
      }
      return {
        x: point.x,
        y: point.y,
        sharp: point.anchorType !== 'smooth'
      }
    })

    const polygons = buildConstrainedSolidStrokePolygons(
      path.sampledPoints,
      true,
      createStroke({
        position: 'inside',
        width: 10,
        join: 'miter',
        miterLimit: 4
      }),
      {
        assumeSimpleClosed: false,
        selectedSideGuardPoints: guardPoints,
        sourcePath: path,
        exactBackend,
        fillRule: 'evenodd'
      }
    )

    expect(polygons).toEqual([])
  })
})
