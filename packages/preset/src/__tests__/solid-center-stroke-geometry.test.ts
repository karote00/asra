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
  kind: 'solid',
  color: 0x3366ff,
  alpha: 1,
  gradientStyle: null,
  paintKey: 'solid:3366ff:1',
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
      Math.abs(point.x - expected.x) < 1e-6 &&
      Math.abs(point.y - expected.y) < 1e-6
  )

const hasPolygonWithPoints = (polygons: Vec2[][], expected: Vec2[]) =>
  polygons.some((polygon) =>
    expected.every((point) => hasPoint(polygon, point))
  )

const isPointInPolygon = (point: Vec2, polygon: Vec2[]) => {
  let inside = false

  for (
    let index = 0, previous = polygon.length - 1;
    index < polygon.length;
    previous = index, index += 1
  ) {
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

const cubicPoint = (p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t: number) => {
  const u = 1 - t
  return {
    x:
      u * u * u * p0.x +
      3 * u * u * t * p1.x +
      3 * u * t * t * p2.x +
      t * t * t * p3.x,
    y:
      u * u * u * p0.y +
      3 * u * u * t * p1.y +
      3 * u * t * t * p2.y +
      t * t * t * p3.y
  }
}

const pointToSegmentDistance = (point: Vec2, from: Vec2, to: Vec2) => {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared <= 1e-6) {
    return Math.hypot(point.x - from.x, point.y - from.y)
  }

  const ratio = Math.max(
    0,
    Math.min(
      1,
      ((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSquared
    )
  )
  return Math.hypot(
    point.x - (from.x + dx * ratio),
    point.y - (from.y + dy * ratio)
  )
}

const buildReportedVector6SampledPoints = () => {
  const points = {
    'tp-12': { x: 192.42083700791653, y: 0 },
    'tp-13': { x: 11.358174406717296, y: 364.1297089212308 },
    'tp-12:out': { x: 170.10536493824844, y: 119.07041481724248 },
    'tp-13:in': { x: -42.09205809548172, y: 343.2841182453731 },
    'tp-13:out': { x: 78.17096503446606, y: 390.18669726605293 },
    'tp-14': { x: 360.120941483566, y: 144.31562775593738 },
    'tp-15': { x: 0, y: 14.030686031827244 },
    'tp-15:out': { x: 0, y: 14.030686031827244 },
    'tp-16': { x: 270.59180204238254, y: 345.42212754546125 },
    'tp-16:in': { x: 263.9105229796076, y: 362.79345310867603 },
    'tp-16:out': { x: 277.2730811051575, y: 328.05080198224647 }
  } satisfies Record<string, Vec2>
  const segments = [
    ['tp-12', 'tp-13', 'tp-12:out', 'tp-13:in'],
    ['tp-13', 'tp-14', 'tp-13:out', null],
    ['tp-14', 'tp-15', null, null],
    ['tp-15', 'tp-16', 'tp-15:out', 'tp-16:in'],
    ['tp-16', 'tp-12', 'tp-16:out', null]
  ] as const
  const sampled: Vec2[] = []
  const seamSegments: { from: Vec2; to: Vec2 }[] = []

  segments.forEach(([start, end, out, input], segmentIndex) => {
    const p0 = points[start]
    const p3 = points[end]
    const p1 = out ? points[out] : p0
    const p2 = input ? points[input] : p3
    const segmentSamples: Vec2[] = []
    for (let index = 0; index <= 120; index += 1) {
      segmentSamples.push(cubicPoint(p0, p1, p2, p3, index / 120))
    }
    sampled.push(
      ...(sampled.length === 0 ? segmentSamples : segmentSamples.slice(1))
    )

    if (segmentIndex === 0 || segmentIndex === segments.length - 1) {
      segmentSamples.slice(0, -1).forEach((from, index) => {
        seamSegments.push({ from, to: segmentSamples[index + 1] })
      })
    }
  })

  return { sampled, seamSegments }
}

const distanceToSegments = (
  point: Vec2,
  segments: { from: Vec2; to: Vec2 }[]
) =>
  Math.min(
    ...segments.map((segment) =>
      pointToSegmentDistance(point, segment.from, segment.to)
    )
  )

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
    ).toBe(true)

    expect(
      supportsSolidCenterStroke(
        createStroke({
          cap: 'round'
        })
      )
    ).toBe(true)
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

  it('should run: build round-capped open-path polygons for the uniform-width slice', () => {
    const polygons = buildSolidCenterStrokePolygons(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 }
      ],
      false,
      createStroke({
        cap: 'round'
      })
    )

    expect(polygons).toHaveLength(3)
    expect(isPointInPolygons({ x: -1.8, y: 0 }, polygons)).toBe(true)
    expect(isPointInPolygons({ x: -1.8, y: -1.8 }, polygons)).toBe(false)
    expect(isPointInPolygons({ x: 11.8, y: 0 }, polygons)).toBe(true)
    expect(isPointInPolygons({ x: 11.8, y: 1.8 }, polygons)).toBe(false)
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

    expect(polygons.length).toBeGreaterThanOrEqual(4)

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

  it('should run: keep reported vector-6 closed seam local coverage without filling the top hollow', () => {
    const { sampled, seamSegments } = buildReportedVector6SampledPoints()
    const strokeWidth = 10
    const polygons = buildSolidCenterStrokePolygons(
      sampled,
      true,
      createStroke({
        width: strokeWidth,
        join: 'miter',
        cap: 'butt'
      })
    )

    const missing: Vec2[] = []
    for (let y = 0; y <= 230; y += 2) {
      for (let x = 174; x <= 240; x += 2) {
        const probe = { x, y }
        if (
          distanceToSegments(probe, seamSegments) <= strokeWidth / 2 - 1.25 &&
          !isPointInPolygons(probe, polygons)
        ) {
          missing.push(probe)
        }
      }
    }

    expect(missing.slice(0, 16), JSON.stringify({ missing }, null, 2)).toEqual(
      []
    )
    ;[
      { x: 197.8, y: 19.9 },
      { x: 198.8, y: 19.7 },
      { x: 200.2, y: 19.3 },
      { x: 194.1, y: 19.5 },
      { x: 195.6, y: 19.2 }
    ].forEach((probe) => {
      expect(
        isPointInPolygons(probe, polygons),
        JSON.stringify({ probe }, null, 2)
      ).toBe(true)
    })
    ;[
      { x: 192, y: 58 },
      { x: 192, y: 68 },
      { x: 198, y: 74 }
    ].forEach((probe) => {
      expect(
        isPointInPolygons(probe, polygons),
        JSON.stringify({ probe }, null, 2)
      ).toBe(false)
    })
  })
})
