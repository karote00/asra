import { describe, expect, it } from 'vitest'
import type { VectorNetwork, VectorPointNode, VectorSegment } from '@asyra/core'
import { StrokePositions, createDefaultStroke } from '@asyra/utils'
import { earcut } from 'pixi.js'
import {
  __dashedGeometryModelTestUtils as helpers,
  buildDashIntervalAllocation,
  buildPolylineGeometryModelPath,
  buildVectorGeometryModelPath
} from '../components/geometry-model'
import type { DashCandidateRecord } from '../components/geometry-model'
import {
  REPORTED_ROUND_INSIDE_DASHED_STAR_NETWORK_ID,
  createReportedRoundInsideDashedStarVectorData
} from './inside-dashed-fixtures'
import type { RenderableStroke } from '../components/strokes'

interface TestAnchorPoint {
  id: string
  x: number
  y: number
  inHandle?: { x: number; y: number } | null
  outHandle?: { x: number; y: number } | null
}

const toVectorData = (anchors: TestAnchorPoint[], closed: boolean) => {
  const points: Record<string, VectorPointNode> = {}
  const segments: Record<string, VectorSegment> = {}
  const networks: Record<string, VectorNetwork> = {
    'tn-0': {
      id: 'tn-0',
      pointIds: anchors.map((anchor) => anchor.id),
      segmentIds: [],
      closed
    }
  }

  anchors.forEach((anchor, index) => {
    points[anchor.id] = {
      id: anchor.id,
      kind: 'anchor',
      anchorType: 'smooth',
      x: anchor.x,
      y: anchor.y
    }

    if (anchor.inHandle) {
      points[`${anchor.id}:in`] = {
        id: `${anchor.id}:in`,
        kind: 'control',
        controlForId: anchor.id,
        controlRole: 'in',
        x: anchor.inHandle.x,
        y: anchor.inHandle.y
      }
    }

    if (anchor.outHandle) {
      points[`${anchor.id}:out`] = {
        id: `${anchor.id}:out`,
        kind: 'control',
        controlForId: anchor.id,
        controlRole: 'out',
        x: anchor.outHandle.x,
        y: anchor.outHandle.y
      }
    }

    if (index === 0) {
      return
    }

    const previous = anchors[index - 1]
    const segmentId = `ts-${index - 1}`
    segments[segmentId] = {
      id: segmentId,
      startId: previous.id,
      endId: anchor.id,
      outControlId: previous.outHandle ? `${previous.id}:out` : null,
      inControlId: anchor.inHandle ? `${anchor.id}:in` : null
    }
    networks['tn-0'].segmentIds.push(segmentId)
  })

  if (closed && anchors.length > 1) {
    const first = anchors[0]
    const last = anchors[anchors.length - 1]
    const segmentId = 'ts-close'
    segments[segmentId] = {
      id: segmentId,
      startId: last.id,
      endId: first.id,
      outControlId: last.outHandle ? `${last.id}:out` : null,
      inControlId: first.inHandle ? `${first.id}:in` : null
    }
    networks['tn-0'].segmentIds.push(segmentId)
  }

  return { points, segments, networks }
}

const buildPath = (anchors: TestAnchorPoint[], closed: boolean) => {
  const vector = toVectorData(anchors, closed)
  return buildVectorGeometryModelPath(
    vector.networks['tn-0'],
    vector.points,
    vector.segments
  )
}

const createRenderableStroke = (
  overrides: Partial<ReturnType<typeof createDefaultStroke>> = {},
  renderOverrides: Partial<RenderableStroke> = {}
): RenderableStroke => {
  const stroke = createDefaultStroke({
    style: 'dashed',
    position: StrokePositions.CENTER,
    width: 10,
    dash: 20,
    gap: 10,
    joinType: 'round',
    ...overrides
  })

  return {
    style: stroke.style,
    position: stroke.position,
    width: stroke.width,
    dash: stroke.dash,
    gap: stroke.gap,
    join: stroke.joinType,
    miterLimit: 4,
    cap: 'round',
    color: 0,
    alpha: stroke.opacity,
    ...renderOverrides
  }
}

const buildReportedRoundInsideDashedStarPath = () => {
  const vector = createReportedRoundInsideDashedStarVectorData()
  return buildVectorGeometryModelPath(
    vector.networks[REPORTED_ROUND_INSIDE_DASHED_STAR_NETWORK_ID],
    vector.points,
    vector.segments
  )
}

const buildStrokeDashAllocation = (
  path: ReturnType<typeof buildReportedRoundInsideDashedStarPath>,
  stroke: RenderableStroke
) => helpers.buildStrokeDashIntervalAllocation(path, stroke)

const getPolygonBounds = (polygons: { x: number; y: number }[][]) => {
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

const pointInPolygon = (
  point: { x: number; y: number },
  polygon: { x: number; y: number }[]
) => {
  let inside = false
  for (
    let index = 0, previous = polygon.length - 1;
    index < polygon.length;
    previous = index++
  ) {
    const current = polygon[index]
    const prior = polygon[previous]
    const intersects =
      current.y > point.y !== prior.y > point.y &&
      point.x <
        ((prior.x - current.x) * (point.y - current.y)) /
          (prior.y - current.y + 1e-12) +
          current.x

    if (intersects) {
      inside = !inside
    }
  }

  return inside
}

const pointCoveredByPolygons = (
  point: { x: number; y: number },
  polygons: { x: number; y: number }[][]
) =>
  polygons.some((polygon) => {
    if (pointInPolygon(point, polygon)) {
      return true
    }

    for (let index = 0; index < polygon.length; index += 1) {
      const next = polygon[(index + 1) % polygon.length]
      if (helpers.pointOnSegment(point, polygon[index], next, 1e-3)) {
        return true
      }
    }

    return false
  })

const getLast = <T>(items: readonly T[]) => items[items.length - 1]

const clonePolygon = (polygon: readonly { x: number; y: number }[]) =>
  polygon.map((point) => ({ ...point }))

const buildSyntheticDashCandidates = (
  polygonsByDash: readonly (readonly { x: number; y: number }[])[]
): DashCandidateRecord[] =>
  polygonsByDash.map((polygon, dashIndex) => {
    const mutablePolygon = clonePolygon(polygon)

    return {
      dashIndex,
      interval: {} as never,
      centerlinePoints: [],
      primitives: [
        {
          id: `synthetic:${dashIndex}:body:0`,
          dashIndex,
          kind: 'body',
          touchedSegmentIndices: [0],
          polygon: mutablePolygon,
          bounds: helpers.getPolygonBounds(mutablePolygon) ?? {
            minX: 0,
            minY: 0,
            maxX: 0,
            maxY: 0
          }
        }
      ],
      polygons: [mutablePolygon],
      bounds: helpers.getPolygonBounds(mutablePolygon)
    }
  })

const estimatePolygonOverlapPixels = (
  polygons: { x: number; y: number }[][],
  sampleSize = 128
) => {
  const bounds = getPolygonBounds(polygons)
  const width = Math.max(1e-6, bounds.maxX - bounds.minX)
  const height = Math.max(1e-6, bounds.maxY - bounds.minY)
  let overlapPixelCount = 0

  for (let y = 0; y < sampleSize; y += 1) {
    for (let x = 0; x < sampleSize; x += 1) {
      const sample = {
        x: bounds.minX + ((x + 0.5) / sampleSize) * width,
        y: bounds.minY + ((y + 0.5) / sampleSize) * height
      }
      const coveredCount = polygons.filter((polygon) =>
        pointInPolygon(sample, polygon)
      ).length

      if (coveredCount > 1) {
        overlapPixelCount += 1
      }
    }
  }

  return overlapPixelCount
}

const pointInTriangle = (
  point: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number }
) => {
  const denominator = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y)

  if (Math.abs(denominator) <= 1e-12) {
    return false
  }

  const w1 =
    ((b.y - c.y) * (point.x - c.x) + (c.x - b.x) * (point.y - c.y)) /
    denominator
  const w2 =
    ((c.y - a.y) * (point.x - c.x) + (a.x - c.x) * (point.y - c.y)) /
    denominator
  const w3 = 1 - w1 - w2

  return w1 >= -1e-6 && w2 >= -1e-6 && w3 >= -1e-6
}

const orientation = (
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number }
) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)

const segmentsProperlyIntersect = (
  a1: { x: number; y: number },
  a2: { x: number; y: number },
  b1: { x: number; y: number },
  b2: { x: number; y: number }
) => {
  const o1 = orientation(a1, a2, b1)
  const o2 = orientation(a1, a2, b2)
  const o3 = orientation(b1, b2, a1)
  const o4 = orientation(b1, b2, a2)

  return (
    ((o1 > 1e-6 && o2 < -1e-6) || (o1 < -1e-6 && o2 > 1e-6)) &&
    ((o3 > 1e-6 && o4 < -1e-6) || (o3 < -1e-6 && o4 > 1e-6))
  )
}

const polygonsHavePositiveAreaOverlap = (
  left: { x: number; y: number }[],
  right: { x: number; y: number }[]
) => {
  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    const leftStart = left[leftIndex]
    const leftEnd = left[(leftIndex + 1) % left.length]

    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      const rightStart = right[rightIndex]
      const rightEnd = right[(rightIndex + 1) % right.length]
      if (segmentsProperlyIntersect(leftStart, leftEnd, rightStart, rightEnd)) {
        return true
      }
    }
  }

  return (
    pointInPolygon(getAveragePoint(left), right) ||
    pointInPolygon(getAveragePoint(right), left)
  )
}

const getAveragePoint = (polygon: { x: number; y: number }[]) => {
  const total = polygon.reduce(
    (accumulated, point) => ({
      x: accumulated.x + point.x,
      y: accumulated.y + point.y
    }),
    { x: 0, y: 0 }
  )

  return {
    x: total.x / polygon.length,
    y: total.y / polygon.length
  }
}

const triangulatePolygons = (polygons: { x: number; y: number }[][]) =>
  polygons.flatMap((polygon) => {
    const flatPolygon = polygon.flatMap((point) => [point.x, point.y])
    const indices = earcut(flatPolygon)
    const triangles: [
      { x: number; y: number },
      { x: number; y: number },
      { x: number; y: number }
    ][] = []

    for (let index = 0; index < indices.length; index += 3) {
      triangles.push([
        polygon[indices[index]],
        polygon[indices[index + 1]],
        polygon[indices[index + 2]]
      ])
    }

    return triangles
  })

const estimateTriangleOverdrawPixels = (
  polygons: { x: number; y: number }[][],
  sampleSize = 256
) => {
  const bounds = getPolygonBounds(polygons)
  const width = Math.max(1e-6, bounds.maxX - bounds.minX)
  const height = Math.max(1e-6, bounds.maxY - bounds.minY)
  const triangles = triangulatePolygons(polygons)
  let overlapPixelCount = 0

  for (let y = 0; y < sampleSize; y += 1) {
    for (let x = 0; x < sampleSize; x += 1) {
      const sample = {
        x: bounds.minX + ((x + 0.5) / sampleSize) * width,
        y: bounds.minY + ((y + 0.5) / sampleSize) * height
      }
      const coveredCount = triangles.filter(([a, b, c]) =>
        pointInTriangle(sample, a, b, c)
      ).length

      if (coveredCount > 1) {
        overlapPixelCount += 1
      }
    }
  }

  return overlapPixelCount
}

describe('geometry model helper contracts', () => {
  it('atomic region partition preserves triple-coverage metadata for a synthetic three-way overlap component', () => {
    const rectangles = [
      [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 4 },
        { x: 0, y: 4 }
      ],
      [
        { x: 2, y: 0 },
        { x: 6, y: 0 },
        { x: 6, y: 4 },
        { x: 2, y: 4 }
      ],
      [
        { x: 1, y: 2 },
        { x: 5, y: 2 },
        { x: 5, y: 6 },
        { x: 1, y: 6 }
      ]
    ] as const

    const dashCandidates = buildSyntheticDashCandidates(rectangles)

    const overlapGraph = helpers.buildOverlapGraph(dashCandidates)
    const conflictComponents = helpers.buildConflictComponents(
      dashCandidates,
      overlapGraph
    )
    const atomicRegions = helpers.buildAtomicRegions(
      dashCandidates,
      conflictComponents,
      overlapGraph
    )

    expect(overlapGraph.edges).toHaveLength(3)
    expect(conflictComponents).toEqual([{ dashIndices: [0, 1, 2] }])
    expect(atomicRegions.length).toBeGreaterThan(0)
    expect(
      atomicRegions.some(
        (region) =>
          region.coverageSet.length === 3 &&
          region.coverageSet.join(',') === '0,1,2'
      )
    ).toBe(true)

    atomicRegions.forEach((region) => {
      const regionPoint = getAveragePoint(region.regionPolygon)
      region.coverageSet.forEach((dashIndex) => {
        expect(
          pointCoveredByPolygons(regionPoint, [
            clonePolygon(rectangles[dashIndex])
          ])
        ).toBe(true)
      })
    })
  })

  it('atomic region partition keeps pairwise exclusive and shared regions as disjoint atomic cells', () => {
    const rectangles = [
      [
        { x: 0, y: 0 },
        { x: 8, y: 0 },
        { x: 8, y: 4 },
        { x: 0, y: 4 }
      ],
      [
        { x: 4, y: 0 },
        { x: 12, y: 0 },
        { x: 12, y: 4 },
        { x: 4, y: 4 }
      ]
    ] as const

    const dashCandidates = buildSyntheticDashCandidates(rectangles)

    const overlapGraph = helpers.buildOverlapGraph(dashCandidates)
    const conflictComponents = helpers.buildConflictComponents(
      dashCandidates,
      overlapGraph
    )
    const atomicRegions = helpers.buildAtomicRegions(
      dashCandidates,
      conflictComponents,
      overlapGraph
    )
    const coverageKeys = atomicRegions
      .map((region) => region.coverageSet.join(','))
      .sort()

    expect(coverageKeys.filter((key) => key === '0').length).toBeGreaterThan(0)
    expect(coverageKeys.filter((key) => key === '0,1').length).toBeGreaterThan(
      0
    )
    expect(coverageKeys.filter((key) => key === '1').length).toBeGreaterThan(0)

    for (let leftIndex = 0; leftIndex < atomicRegions.length; leftIndex += 1) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < atomicRegions.length;
        rightIndex += 1
      ) {
        expect(
          polygonsHavePositiveAreaOverlap(
            atomicRegions[leftIndex].regionPolygon,
            atomicRegions[rightIndex].regionPolygon
          )
        ).toBe(false)
      }
    }
  })

  it('primitive vector helpers return stable results and reject degenerate vectors', () => {
    expect(helpers.distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBeCloseTo(5, 6)
    expect(helpers.samePoint({ x: 0, y: 0 }, { x: 5e-7, y: 5e-7 })).toBe(true)
    expect(helpers.samePoint({ x: 0, y: 0 }, { x: 0.01, y: 0.01 })).toBe(false)
    expect(helpers.addVec2({ x: 1, y: 2 }, { x: 3, y: 4 })).toEqual({
      x: 4,
      y: 6
    })
    expect(helpers.subtractVec2({ x: 5, y: 7 }, { x: 2, y: 3 })).toEqual({
      x: 3,
      y: 4
    })
    expect(helpers.scaleVec2({ x: 2, y: -3 }, 4)).toEqual({ x: 8, y: -12 })
    expect(helpers.dotVec2({ x: 1, y: 2 }, { x: 3, y: 4 })).toBe(11)
    expect(helpers.normalizeVector({ x: 3, y: 4 })).toEqual({
      x: 0.6,
      y: 0.8
    })
    expect(helpers.normalizeVector({ x: 0, y: 0 })).toBeNull()
  })

  it('point-list helpers dedupe adjacent points, trim closed duplicates, and preserve polygon orientation', () => {
    expect(
      helpers.dedupeAdjacentPoints([
        { x: 0, y: 0 },
        { x: 0, y: 0 },
        { x: 1, y: 0 }
      ])
    ).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 }
    ])

    expect(
      helpers.dedupeClosedPolygonPoints([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 0 }
      ])
    ).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 }
    ])

    expect(
      helpers.mergePointLists(
        [
          { x: 0, y: 0 },
          { x: 1, y: 0 }
        ],
        [
          { x: 1, y: 0 },
          { x: 2, y: 0 }
        ]
      )
    ).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 }
    ])

    expect(
      helpers.polygonArea([
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 4 },
        { x: 0, y: 4 }
      ])
    ).toBeGreaterThan(0)
  })

  it('frame merge helpers dedupe repeated points and preserve the existing seam tangent when lists join', () => {
    const frames = helpers.dedupeAdjacentFrames([
      {
        point: { x: 0, y: 0 },
        tangent: { x: 1, y: 0 }
      },
      {
        point: { x: 0, y: 0 },
        tangent: { x: 0, y: 1 }
      },
      {
        point: { x: 2, y: 0 },
        tangent: { x: 1, y: 0 }
      }
    ])

    expect(frames).toHaveLength(2)
    expect(frames[0].tangent).toEqual({ x: 0, y: 1 })

    const merged = helpers.mergeFrameLists(frames, [
      {
        point: { x: 2, y: 0 },
        tangent: { x: 0, y: 1 }
      },
      {
        point: { x: 4, y: 0 },
        tangent: { x: 1, y: 0 }
      }
    ])

    expect(merged).toHaveLength(3)
    expect(merged[1].tangent).toEqual({ x: 1, y: 0 })
  })

  it('segment tangent and line samplers produce clamped endpoints with stable tangents', () => {
    const path = buildPolylineGeometryModelPath(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 }
      ],
      false
    )
    const lineSegment = path.segments[0]
    expect(lineSegment).toBeDefined()
    if (!lineSegment || lineSegment.type !== 'line') {
      return
    }

    expect(helpers.getSegmentStartTangent(lineSegment)).toEqual({ x: 1, y: 0 })

    const frames = helpers.sampleLineSegmentFrames(lineSegment, -5, 15)
    expect(frames).toEqual([
      { point: { x: 0, y: 0 }, tangent: { x: 1, y: 0 } },
      { point: { x: 10, y: 0 }, tangent: { x: 1, y: 0 } }
    ])

    expect(helpers.slicePathSegmentFrames(lineSegment, 0, 0, 0.5)).toEqual([])
    expect(helpers.samplePathSegment(lineSegment, 0.5)).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 }
    ])
  })

  it('cubic helper family inverts arc length, samples frames, and falls back from degenerate start handles', () => {
    const path = buildPath(
      [
        {
          id: 'a',
          x: 0,
          y: 0,
          outHandle: { x: 0, y: 0 }
        },
        {
          id: 'b',
          x: 60,
          y: 80,
          inHandle: { x: 30, y: 80 }
        }
      ],
      false
    )
    const cubicSegment = path.segments[0]
    expect(cubicSegment).toBeDefined()
    if (!cubicSegment || cubicSegment.type !== 'cubic') {
      return
    }
    const halfLength = cubicSegment.length / 2
    const halfT = helpers.getCurveTAtLength(cubicSegment, halfLength)

    expect(helpers.getCurveLengthAtT(cubicSegment, 0)).toBe(0)
    expect(helpers.getCurveLengthAtT(cubicSegment, 1)).toBeCloseTo(
      cubicSegment.length,
      6
    )
    expect(halfT).toBeGreaterThan(0)
    expect(halfT).toBeLessThan(1)
    expect(helpers.getCurveLengthAtT(cubicSegment, halfT)).toBeCloseTo(
      halfLength,
      1
    )

    const frames = helpers.sampleCubicSegmentFrames(
      cubicSegment,
      0,
      cubicSegment.length,
      0.5
    )
    expect(frames.length).toBeGreaterThanOrEqual(8)
    expect(frames[0].tangent.x).not.toBeNaN()
    expect(getLast(frames)?.point.x ?? 0).toBeCloseTo(60, 2)
  })

  it('dash pattern helpers clamp invalid authored values and derive width-based defaults', () => {
    expect(
      helpers.getDashPattern({
        width: 12,
        dash: Number.NaN,
        gap: Number.POSITIVE_INFINITY
      })
    ).toEqual({
      dash: 48,
      gap: 24
    })

    expect(
      helpers.getDashPattern({
        width: 0,
        dash: 0,
        gap: -5
      })
    ).toEqual({
      dash: 0.1,
      gap: 0.1
    })

    expect(
      helpers.createDashedStrokeGeometryContext(
        createRenderableStroke({
          width: 8,
          dash: Number.NaN,
          gap: Number.NaN
        })
      )
    ).toEqual({
      dash: 32,
      gap: 16
    })
  })

  it('dash interval helpers allocate open and closed intervals with seam-aware adjacency metadata', () => {
    const openPath = buildPolylineGeometryModelPath(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 }
      ],
      false
    )
    const closedPath = buildPolylineGeometryModelPath(
      [
        { x: 0, y: 0 },
        { x: 40, y: 0 },
        { x: 40, y: 40 },
        { x: 0, y: 40 }
      ],
      true
    )

    expect(helpers.buildDashIntervals(0, 20, 10, false)).toEqual([])
    expect(helpers.buildDashIntervals(100, 20, 10, false)).toEqual([
      { startDistance: 0, endDistance: 20 },
      { startDistance: 30, endDistance: 50 },
      { startDistance: 60, endDistance: 80 },
      { startDistance: 90, endDistance: 100 }
    ])

    expect(
      helpers.buildDashedStrokeIntervals(openPath, {
        dash: 20,
        gap: 10
      })
    ).toEqual(helpers.buildDashIntervals(100, 20, 10, false, 0))

    const closedAllocation = buildDashIntervalAllocation(closedPath, {
      dash: 18,
      gap: 8
    })
    expect(closedAllocation.dashIntervals[0].previousDashIndex).toBe(
      closedAllocation.dashIntervals.length - 1
    )
    expect(getLast(closedAllocation.dashIntervals)?.nextDashIndex).toBe(0)
    expect(
      closedAllocation.gapIntervals.every(
        (interval) => interval.leadingDashIndex !== null
      )
    ).toBe(true)
  })

  it('touched-segment and path-interval samplers keep correct segment coverage across wraps', () => {
    const path = buildPolylineGeometryModelPath(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 }
      ],
      false
    )

    expect(helpers.getTouchedSegmentIndices(path, 8, 12)).toEqual([0, 1])
    expect(helpers.samplePathIntervalFramesNoWrap(path, 8, 12, 0.5)).toEqual([
      {
        point: { x: 8, y: 0 },
        tangent: { x: 1, y: 0 },
        segmentIndex: 0
      },
      expect.objectContaining({
        point: { x: 10, y: 0 },
        tangent: { x: 1, y: 0 },
        segmentIndex: 0,
        joinAnchorType: 'sharp',
        joinIncomingTangent: { x: 1, y: 0 },
        joinOutgoingTangent: { x: 0, y: 1 }
      }),
      {
        point: { x: 10, y: 2 },
        tangent: { x: 0, y: 1 },
        segmentIndex: 1
      }
    ])

    const closedPath = buildPolylineGeometryModelPath(
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 20 },
        { x: 0, y: 20 }
      ],
      true
    )
    const wrapped = helpers.samplePathIntervalFrames(
      closedPath,
      closedPath.totalLength - 5,
      closedPath.totalLength + 5,
      0.5
    )
    expect(wrapped.length).toBeGreaterThanOrEqual(3)
    expect(wrapped[0].point).toEqual({ x: 0, y: 5 })
    expect(getLast(wrapped)?.point).toEqual({ x: 5, y: 0 })
  })

  it('offset construction helpers reject degenerate segments and keep joined offsets finite', () => {
    expect(helpers.createUnitLeftNormal({ x: 0, y: 0 }, { x: 0, y: 0 })).toBe(
      null
    )
    const leftNormal = helpers.createUnitLeftNormal(
      { x: 0, y: 0 },
      { x: 2, y: 0 }
    )
    expect(leftNormal?.x ?? 0).toBeCloseTo(0, 6)
    expect(leftNormal?.y ?? 0).toBeCloseTo(1, 6)
    expect(
      helpers.intersectLines(
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 5, y: -5 },
        { x: 5, y: 5 }
      )
    ).toEqual({ x: 5, y: 0 })
    expect(
      helpers.intersectLines(
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 0, y: 1 },
        { x: 10, y: 1 }
      )
    ).toBeNull()

    const shifted = helpers.createShiftedSegment(
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      2
    )
    expect(shifted?.start).toEqual({ x: 0, y: 2 })
    expect(shifted?.end).toEqual({ x: 10, y: 2 })

    expect(
      helpers.getJoinedOffsetPoint(
        shifted ?? null,
        helpers.createShiftedSegment({ x: 10, y: 0 }, { x: 10, y: 10 }, 2) ??
          null,
        { x: 10, y: 0 }
      )
    ).toEqual({ x: 8, y: 2 })

    const offset = helpers.offsetPolyline(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 }
      ],
      2,
      false
    )
    expect(offset).toEqual([
      { x: 0, y: 2 },
      { x: 8, y: 2 },
      { x: 8, y: 10 }
    ])
  })

  it('centerline offset helper respects closed-path orientation and ignores open paths', () => {
    const ccw = buildPolylineGeometryModelPath(
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 20 },
        { x: 0, y: 20 }
      ],
      true
    )
    const cw = buildPolylineGeometryModelPath(
      [
        { x: 0, y: 0 },
        { x: 0, y: 20 },
        { x: 20, y: 20 },
        { x: 20, y: 0 }
      ],
      true
    )
    const stroke = { position: 'inside', width: 10 } as const

    expect(helpers.getStrokeCenterlineOffset(ccw, stroke)).toBe(5)
    expect(helpers.getStrokeCenterlineOffset(cw, stroke)).toBe(-5)
    expect(
      helpers.getStrokeCenterlineOffset(
        buildPolylineGeometryModelPath(
          [
            { x: 0, y: 0 },
            { x: 20, y: 0 }
          ],
          false
        ),
        stroke
      )
    ).toBe(0)
  })

  it('polygon guard helpers classify point-on-segment, segment intersection, and polygon simplicity correctly', () => {
    expect(
      helpers.pointOnSegment({ x: 5, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 0 })
    ).toBe(true)
    expect(
      helpers.orientation({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 })
    ).toBeGreaterThan(0)
    expect(
      helpers.segmentsTouchOrIntersect(
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
        { x: 10, y: 0 }
      )
    ).toBe(true)
    expect(
      helpers.isSimplePolygon([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 }
      ])
    ).toBe(true)
    expect(
      helpers.isSimplePolygon([
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
        { x: 10, y: 0 }
      ])
    ).toBe(false)
  })

  it('arc helpers choose bounded step sizes, correct sweep direction, and cap orientation', () => {
    expect(helpers.getArcStepAngle(0)).toBeCloseTo(Math.PI / 32, 6)
    expect(helpers.getArcSweep(0, Math.PI, false)).toBeCloseTo(Math.PI, 6)
    expect(helpers.getArcSweep(0, Math.PI, true)).toBeCloseTo(-Math.PI, 6)

    const ccwArc = helpers.buildArcPoints(
      { x: 0, y: 0 },
      0,
      Math.PI / 2,
      10,
      false
    )
    expect(ccwArc[0].x).toBeLessThan(10)
    expect(getLast(ccwArc)?.y ?? 0).toBeCloseTo(10, 6)

    expect(
      helpers.chooseStrokeCapArcClockwise(
        { x: 0, y: 0 },
        { x: 0, y: -5 },
        { x: 0, y: 5 },
        { x: -1, y: 0 }
      )
    ).toBe(true)
    expect(
      helpers.getBoundaryCapDirection(
        [
          { x: 0, y: 0 },
          { x: 10, y: 0 }
        ],
        { x: 1, y: 0 },
        true
      )
    ).toEqual({ x: -10, y: 0 })

    const capArc = helpers.buildStrokeCapArcPoints(
      { x: 0, y: 0 },
      { x: 0, y: -5 },
      { x: 0, y: 5 },
      5,
      true
    )
    expect(capArc.length).toBeGreaterThan(2)
    expect(capArc.every((point) => point.x <= 1e-6)).toBe(true)
  })

  it('boundary and cap helpers emit bounded fallback polygons and respect join and cap modes', () => {
    const centerline = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 }
    ]
    const roundStroke = createRenderableStroke(
      {},
      { join: 'round', cap: 'round' }
    )
    const bevelStroke = createRenderableStroke(
      {},
      { join: 'bevel', cap: 'round' }
    )
    const miterStroke = createRenderableStroke(
      {},
      { join: 'miter', miterLimit: 1, cap: 'round' }
    )

    const roundBoundary = helpers.buildOffsetBoundary(
      centerline,
      5,
      roundStroke
    )
    const bevelBoundary = helpers.buildOffsetBoundary(
      centerline,
      5,
      bevelStroke
    )
    const miterBoundary = helpers.buildOffsetBoundary(
      centerline,
      5,
      miterStroke
    )

    expect(roundBoundary.length).toBeGreaterThan(bevelBoundary.length)
    expect(bevelBoundary).toContainEqual({ x: 10, y: 5 })
    expect(miterBoundary.length).toBeGreaterThanOrEqual(3)

    const innerBoundary = helpers.buildOffsetBoundary(
      centerline,
      -5,
      roundStroke
    )
    const strip = helpers.buildStrokeStripPolygon(roundBoundary, innerBoundary)
    expect(strip).not.toBeNull()

    const startCap = helpers.buildStrokeStartCapPolygon(
      roundBoundary,
      innerBoundary,
      centerline,
      roundStroke
    )
    const endCap = helpers.buildStrokeEndCapPolygon(
      roundBoundary,
      innerBoundary,
      centerline,
      roundStroke
    )
    expect(startCap?.length ?? 0).toBeGreaterThanOrEqual(3)
    expect(endCap?.length ?? 0).toBeGreaterThanOrEqual(3)

    const squareCenterline = helpers.applySquareCapsToCenterline(
      [
        { x: 0, y: 0 },
        { x: 20, y: 0 }
      ],
      { x: 1, y: 0 },
      { x: 1, y: 0 },
      createRenderableStroke({}, { cap: 'square', width: 10 })
    )
    expect(squareCenterline).toEqual([
      { x: -5, y: 0 },
      { x: 25, y: 0 }
    ])
  })

  it('high-level dash subpath and outline helpers reject degenerate inputs and return simple candidate polygons for valid dashes', () => {
    const path = buildPath(
      [
        { id: 'a', x: 0, y: 0 },
        { id: 'b', x: 10, y: 0 },
        { id: 'c', x: 10, y: 10 }
      ],
      false
    )
    const stroke = createRenderableStroke({
      width: 10,
      dash: 12,
      gap: 100
    })
    const allocation = buildStrokeDashAllocation(path, stroke)
    const subpath = helpers.buildDashSubpathGeometry(
      path,
      allocation.dashIntervals[0],
      stroke
    )

    expect(subpath).not.toBeNull()
    expect(
      helpers.buildDashSubpathGeometry(
        path,
        {
          ...allocation.dashIntervals[0],
          startDistance: 5,
          endDistance: 5,
          intervalLength: 0
        },
        stroke
      )
    ).toBeNull()

    if (!subpath) {
      return
    }

    const polygons = helpers.buildOpenStrokeOutlinePolygons(subpath, stroke)
    expect(polygons.length).toBeGreaterThan(0)
    expect(polygons.every((polygon) => polygon.length >= 3)).toBe(true)
  })

  it('reported round-join inside-dashed star builds a stable closed path from authored segments', () => {
    const path = buildReportedRoundInsideDashedStarPath()

    expect(path.closed).toBe(true)
    expect(path.segments).toHaveLength(5)
    expect(path.segments.map((segment) => segment.type)).toEqual([
      'cubic',
      'cubic',
      'line',
      'cubic',
      'cubic'
    ])
    expect(path.sampledPoints.length).toBeGreaterThan(path.segments.length)
    expect(path.totalLength).toBeGreaterThan(0)
    path.segments.forEach((segment) => {
      expect(segment.length).toBeGreaterThan(0)
      expect(Number.isFinite(segment.length)).toBe(true)
      expect(Number.isFinite(segment.start.x)).toBe(true)
      expect(Number.isFinite(segment.start.y)).toBe(true)
      expect(Number.isFinite(segment.end.x)).toBe(true)
      expect(Number.isFinite(segment.end.y)).toBe(true)
    })
  })

  it('reported round-join inside-dashed star stroke-centerline allocation covers every segment and records cross-segment dash ownership', () => {
    const path = buildReportedRoundInsideDashedStarPath()
    const allocation = buildStrokeDashAllocation(
      path,
      createRenderableStroke({
        position: StrokePositions.INSIDE,
        width: 10,
        dash: 20,
        gap: 20,
        joinType: 'round'
      })
    )
    const touchedSegments = new Set(
      allocation.dashIntervals.flatMap(
        (interval) => interval.touchedSegmentIndices
      )
    )

    expect(allocation.closed).toBe(true)
    expect(allocation.dashIntervals.length).toBeGreaterThan(0)
    expect(allocation.gapIntervals.length).toBeGreaterThan(0)
    expect([...touchedSegments].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4])
    expect(
      allocation.dashIntervals.some(
        (interval) => interval.touchedSegmentIndices.length > 1
      )
    ).toBe(true)
    allocation.dashIntervals.forEach((interval, index) => {
      expect(interval.dashIndex).toBe(index)
      expect(interval.intervalLength).toBeGreaterThan(0)
      expect(
        interval.touchedSegmentIndices.every(
          (segmentIndex) =>
            segmentIndex >= 0 && segmentIndex < path.segments.length
        )
      ).toBe(true)
    })
  })

  it('reported round-join inside-dashed star uses authored dash length to force deterministic cross-segment subpath extraction', () => {
    const path = buildReportedRoundInsideDashedStarPath()
    const crossSegmentDashLength = Math.ceil(path.segments[0].length + 10)
    const stroke = createRenderableStroke({
      position: StrokePositions.INSIDE,
      width: 10,
      dash: crossSegmentDashLength,
      gap: 20,
      joinType: 'round'
    })
    const allocation = buildStrokeDashAllocation(path, stroke)
    const firstInterval = allocation.dashIntervals[0]
    const subpath = helpers.buildDashSubpathGeometry(
      path,
      firstInterval,
      stroke
    )

    expect(firstInterval.touchedSegmentIndices).toEqual([0, 1])
    expect(subpath).not.toBeNull()
    if (!subpath) {
      return
    }

    expect(subpath.sourcePoints.length).toBeGreaterThan(2)
    expect(subpath.centerlinePoints.length).toBeGreaterThan(2)
    expect(Number.isFinite(subpath.startTangent.x)).toBe(true)
    expect(Number.isFinite(subpath.startTangent.y)).toBe(true)
    expect(Number.isFinite(subpath.endTangent.x)).toBe(true)
    expect(Number.isFinite(subpath.endTangent.y)).toBe(true)
    expect(
      Math.hypot(subpath.startTangent.x, subpath.startTangent.y)
    ).toBeCloseTo(1, 3)
    expect(Math.hypot(subpath.endTangent.x, subpath.endTangent.y)).toBeCloseTo(
      1,
      3
    )
  })

  it('reported round-join inside-dashed star stamps authored segment ownership onto sampled subpath frames', () => {
    const path = buildReportedRoundInsideDashedStarPath()
    const stroke = createRenderableStroke({
      position: StrokePositions.INSIDE,
      width: 10,
      dash: 20,
      gap: 20,
      joinType: 'round'
    })
    const allocation = buildStrokeDashAllocation(path, stroke)
    const interval = allocation.dashIntervals.find(
      (candidate) => candidate.touchedSegmentIndices.length > 1
    )

    expect(interval).toBeDefined()
    if (!interval) {
      return
    }

    const subpath = helpers.buildDashSubpathGeometry(path, interval, stroke)
    expect(subpath).not.toBeNull()
    if (!subpath) {
      return
    }

    expect(
      subpath.centerlineFrames.every(
        (frame) =>
          frame.segmentIndex !== undefined &&
          interval.touchedSegmentIndices.includes(frame.segmentIndex)
      )
    ).toBe(true)
  })

  it('reported round-join inside-dashed star splits sharp cross-segment dashes into seam-owned frame pieces', () => {
    const path = buildReportedRoundInsideDashedStarPath()
    const stroke = createRenderableStroke({
      position: StrokePositions.INSIDE,
      width: 10,
      dash: 20,
      gap: 20,
      joinType: 'round'
    })
    const allocation = buildStrokeDashAllocation(path, stroke)

    allocation.dashIntervals
      .filter((interval) => interval.touchedSegmentIndices.length > 1)
      .forEach((interval) => {
        const subpath = helpers.buildDashSubpathGeometry(path, interval, stroke)
        expect(subpath).not.toBeNull()
        if (!subpath) {
          return
        }

        const pieces = helpers.splitFramesAtSegmentSeams(subpath.sourceFrames)
        const hasSharpJoin = helpers.subpathHasSharpJoin(subpath.sourceFrames)

        if (!hasSharpJoin) {
          expect(pieces).toHaveLength(1)
          return
        }

        expect(pieces.length).toBe(interval.touchedSegmentIndices.length)
        expect(
          pieces.every(
            (piece) =>
              piece.length >= 2 &&
              piece.every(
                (frame) => frame.segmentIndex === piece[0].segmentIndex
              )
          )
        ).toBe(true)
        for (let index = 0; index < pieces.length - 1; index += 1) {
          expect(getLast(pieces[index])?.point).toEqual(
            pieces[index + 1][0].point
          )
        }
      })
  })

  it('reported round-join inside-dashed star smooth high-curvature cross-segment dashes stay on one continuous piece', () => {
    const path = buildReportedRoundInsideDashedStarPath()
    const stroke = createRenderableStroke({
      position: StrokePositions.INSIDE,
      width: 10,
      dash: 20,
      gap: 20,
      joinType: 'round'
    })
    const allocation = buildStrokeDashAllocation(path, stroke)
    const smoothCrossSegmentInterval = allocation.dashIntervals.find(
      (interval) => {
        if (interval.touchedSegmentIndices.length <= 1) {
          return false
        }

        const subpath = helpers.buildDashSubpathGeometry(path, interval, stroke)
        return (
          subpath !== null && !helpers.subpathHasSharpJoin(subpath.sourceFrames)
        )
      }
    )

    expect(smoothCrossSegmentInterval).toBeDefined()
    if (!smoothCrossSegmentInterval) {
      return
    }

    const subpath = helpers.buildDashSubpathGeometry(
      path,
      smoothCrossSegmentInterval,
      stroke
    )
    expect(subpath).not.toBeNull()
    if (!subpath) {
      return
    }

    expect(
      helpers.splitFramesAtSegmentSeams(subpath.sourceFrames)
    ).toHaveLength(1)
  })

  it('reported round-join inside-dashed star smooth high-curvature ending corner still renders when primary centerline outline is unavailable', () => {
    const path = buildReportedRoundInsideDashedStarPath()
    const vector = createReportedRoundInsideDashedStarVectorData()
    const endingAnchor = vector.points['tp-52']
    const stroke = createRenderableStroke({
      position: StrokePositions.INSIDE,
      width: 10,
      dash: 20,
      gap: 20,
      joinType: 'round'
    })
    const allocation = buildStrokeDashAllocation(path, stroke)
    const smoothCrossSegmentInterval = allocation.dashIntervals
      .map((interval) => {
        const subpath = helpers.buildDashSubpathGeometry(path, interval, stroke)
        if (
          !subpath ||
          interval.touchedSegmentIndices.length <= 1 ||
          helpers.subpathHasSharpJoin(subpath.sourceFrames)
        ) {
          return null
        }

        const startPoint = subpath.sourcePoints[0]
        const endPoint = subpath.sourcePoints[subpath.sourcePoints.length - 1]
        return {
          interval,
          subpath,
          distanceToAnchor: Math.min(
            helpers.distance(startPoint, endingAnchor),
            helpers.distance(endPoint, endingAnchor)
          )
        }
      })
      .filter((candidate) => candidate !== null)
      .sort((left, right) => left.distanceToAnchor - right.distanceToAnchor)[0]

    expect(smoothCrossSegmentInterval).toBeDefined()
    if (!smoothCrossSegmentInterval) {
      return
    }

    const { interval, subpath } = smoothCrossSegmentInterval

    const primaryFrames = helpers.simplifyFramesForStrokeOutline(
      subpath.centerlineFrames,
      stroke.width,
      { profile: 'primary' }
    )
    const capBoundarySource = helpers.buildSmoothStrokeCapBoundarySource(
      primaryFrames,
      stroke
    )

    expect(capBoundarySource).not.toBeNull()
    if (!capBoundarySource) {
      return
    }

    const primaryPolygons =
      helpers.buildOpenStrokeOutlinePolygonsFromCenterline(
        subpath.centerlinePoints,
        subpath,
        stroke,
        false,
        capBoundarySource
      )
    const finalPolygons = helpers.buildOpenStrokeOutlinePolygons(
      subpath,
      stroke
    )

    expect(interval.dashIndex).toBe(54)
    expect(primaryPolygons.length).toBe(0)
    expect(finalPolygons.length).toBeGreaterThan(0)
  })

  it('reported round-join inside-dashed star keeps extracted authored subpath lengths aligned with dash intervals', () => {
    const path = buildReportedRoundInsideDashedStarPath()
    const stroke = createRenderableStroke({
      position: StrokePositions.INSIDE,
      width: 10,
      dash: 20,
      gap: 20,
      joinType: 'round'
    })
    const allocation = buildStrokeDashAllocation(path, stroke)
    const mismatches: {
      dashIndex: number
      intervalLength: number
      sourceLength: number
      touchedSegmentIndices: number[]
      wrapsSeam: boolean
      startDistance: number
      endDistance: number
    }[] = []

    allocation.dashIntervals.forEach((interval) => {
      const subpath = helpers.buildDashSubpathGeometry(path, interval, stroke)
      expect(subpath).not.toBeNull()
      if (!subpath) {
        return
      }

      const sourceLength = subpath.sourcePoints
        .slice(1)
        .reduce(
          (total, point, index) =>
            total + helpers.distance(subpath.sourcePoints[index], point),
          0
        )

      const mismatch = Math.abs(sourceLength - interval.intervalLength)
      if (mismatch > 0.01) {
        mismatches.push({
          dashIndex: interval.dashIndex,
          intervalLength: interval.intervalLength,
          sourceLength,
          touchedSegmentIndices: interval.touchedSegmentIndices,
          wrapsSeam: interval.wrapsSeam,
          startDistance: interval.startDistance,
          endDistance: interval.endDistance
        })
      }
    })

    expect(mismatches).toEqual([])
  })

  it('reported round-join inside-dashed star uses authored-corner sharp joins only on cross-corner dashes', () => {
    const path = buildReportedRoundInsideDashedStarPath()
    const stroke = createRenderableStroke({
      position: StrokePositions.INSIDE,
      width: 10,
      dash: 20,
      gap: 20,
      joinType: 'round'
    })
    const allocation = buildStrokeDashAllocation(path, stroke)

    const sharpIntervals = allocation.dashIntervals.filter((interval) => {
      const subpath = helpers.buildDashSubpathGeometry(path, interval, stroke)
      return (
        subpath !== null &&
        helpers.subpathHasSharpJoin(subpath.centerlineFrames)
      )
    })

    expect(
      sharpIntervals.map((interval) => interval.touchedSegmentIndices)
    ).toEqual([
      [1, 2],
      [2, 3]
    ])
  })

  it('reported round-join inside-dashed star keeps smooth near-corner dashes on a curve instead of collapsing them to a chord', () => {
    const path = buildReportedRoundInsideDashedStarPath()
    const stroke = createRenderableStroke({
      position: StrokePositions.INSIDE,
      width: 10,
      dash: 20,
      gap: 20,
      joinType: 'round'
    })
    const allocation = buildStrokeDashAllocation(path, stroke)
    const diagnostics = [0, 54].map((dashIndex) => {
      const interval = allocation.dashIntervals.find(
        (candidate) => candidate.dashIndex === dashIndex
      )
      expect(interval).toBeDefined()
      if (!interval) {
        return null
      }

      const subpath = helpers.buildDashSubpathGeometry(path, interval, stroke)
      expect(subpath).not.toBeNull()
      if (!subpath) {
        return null
      }

      return {
        dashIndex,
        pointCount: subpath.centerlinePoints.length
      }
    })

    expect(diagnostics).toEqual([
      expect.objectContaining({ dashIndex: 0, pointCount: expect.any(Number) }),
      expect.objectContaining({
        dashIndex: 54,
        pointCount: expect.any(Number)
      })
    ])
    diagnostics.forEach((diagnostic) => {
      if (!diagnostic) {
        return
      }
      expect(diagnostic.pointCount).toBeGreaterThan(10)
    })
  })

  it('simplifyFramesForStrokeOutline removes redundant gentle frames but preserves endpoints and turning frames', () => {
    const straightFrames = [
      { point: { x: 0, y: 0 }, tangent: { x: 1, y: 0 } },
      { point: { x: 12, y: 0 }, tangent: { x: 1, y: 0 } },
      { point: { x: 14, y: 0 }, tangent: { x: 1, y: 0 } },
      { point: { x: 40, y: 0 }, tangent: { x: 1, y: 0 } }
    ]
    const simplifiedStraight = helpers.simplifyFramesForStrokeOutline(
      straightFrames,
      10,
      { profile: 'fallback' }
    )

    expect(simplifiedStraight[0].point).toEqual({ x: 0, y: 0 })
    expect(getLast(simplifiedStraight)?.point).toEqual({ x: 40, y: 0 })
    expect(simplifiedStraight.length).toBeLessThan(straightFrames.length)

    const turningFrames = [
      { point: { x: 0, y: 0 }, tangent: { x: 1, y: 0 } },
      {
        point: { x: 2, y: 0.5 },
        tangent: {
          x: Math.cos(Math.PI / 3),
          y: Math.sin(Math.PI / 3)
        }
      },
      {
        point: { x: 4, y: 2 },
        tangent: {
          x: Math.cos(Math.PI / 3),
          y: Math.sin(Math.PI / 3)
        }
      },
      { point: { x: 6, y: 5 }, tangent: { x: 0, y: 1 } }
    ]
    const simplifiedTurning = helpers.simplifyFramesForStrokeOutline(
      turningFrames,
      10
    )

    expect(simplifiedTurning[0].point).toEqual(turningFrames[0].point)
    expect(getLast(simplifiedTurning)?.point).toEqual(
      getLast(turningFrames)?.point
    )
    expect(
      simplifiedTurning.some(
        (frame) => frame.point.x === turningFrames[1].point.x
      )
    ).toBe(true)
  })

  it('simplifyFramesForStrokeOutline preserves sharp seam neighbors in the primary profile', () => {
    const frames = [
      { point: { x: 0, y: 0 }, tangent: { x: 1, y: 0 } },
      { point: { x: 4, y: 0 }, tangent: { x: 1, y: 0 } },
      {
        point: { x: 8, y: 0 },
        tangent: { x: 0, y: 1 },
        joinAnchorType: 'sharp' as const
      },
      { point: { x: 8, y: 4 }, tangent: { x: 0, y: 1 } },
      { point: { x: 8, y: 8 }, tangent: { x: 0, y: 1 } }
    ]

    const simplified = helpers.simplifyFramesForStrokeOutline(frames, 10, {
      profile: 'primary'
    })

    expect(
      simplified.map((frame) => `${frame.point.x},${frame.point.y}`)
    ).toEqual(['0,0', '4,0', '8,0', '8,4', '8,8'])
  })

  it('collapseSharpNeighborhoodFramesForOutline collapses dense local sharp clusters to representative arm points', () => {
    const frames = [
      { point: { x: 0, y: 0 }, tangent: { x: 1, y: 0 } },
      { point: { x: 3, y: 0 }, tangent: { x: 1, y: 0 } },
      { point: { x: 6, y: 0 }, tangent: { x: 1, y: 0 } },
      {
        point: { x: 8, y: 0 },
        tangent: { x: 0, y: 1 },
        joinAnchorType: 'sharp' as const
      },
      { point: { x: 8, y: 2 }, tangent: { x: 0, y: 1 } },
      { point: { x: 8, y: 5 }, tangent: { x: 0, y: 1 } },
      { point: { x: 8, y: 10 }, tangent: { x: 0, y: 1 } }
    ]

    const collapsed = helpers.collapseSharpNeighborhoodFramesForOutline(
      frames,
      10
    )

    expect(
      collapsed.map((frame) => `${frame.point.x},${frame.point.y}`)
    ).toEqual(['0,0', '8,0', '8,10'])
  })

  it('buildOffsetBoundary avoids emitting explicit round joins for gentle sampled turns', () => {
    const smoothCenterline = [
      { x: 0, y: 0 },
      { x: 8, y: 1 },
      { x: 16, y: 3 },
      { x: 24, y: 6 }
    ]
    const stroke = createRenderableStroke({}, { join: 'round' })

    const boundary = helpers.buildOffsetBoundary(smoothCenterline, 5, stroke)

    expect(boundary.length).toBeLessThanOrEqual(smoothCenterline.length + 2)
  })

  it('buildSmoothOffsetBoundaryFromFrames preserves explicit joins at sharp sampled seams', () => {
    const frames = [
      { point: { x: 0, y: 0 }, tangent: { x: 1, y: 0 } },
      {
        point: { x: 10, y: 0 },
        tangent: { x: 0, y: 1 },
        joinAnchorType: 'sharp' as const
      },
      { point: { x: 10, y: 10 }, tangent: { x: 0, y: 1 } }
    ]
    const stroke = createRenderableStroke({}, { join: 'round' })

    const boundary = helpers.buildSmoothOffsetBoundaryFromFrames(
      frames,
      5,
      stroke
    )

    expect(boundary.length).toBeGreaterThan(frames.length)
    expect(boundary).toContainEqual({ x: 10, y: 5 })
    expect(
      boundary.some(
        (point) => Math.abs(point.x - 5) <= 1e-6 && Math.abs(point.y) <= 1e-6
      )
    ).toBe(true)
  })

  it('offsetFramesForStrokeCenterline expands a sharp round join into arc-following centerline frames', () => {
    const frames = [
      { point: { x: 0, y: 0 }, tangent: { x: 1, y: 0 } },
      {
        point: { x: 10, y: 0 },
        tangent: { x: 0, y: 1 },
        joinAnchorType: 'sharp' as const,
        joinSourcePoint: { x: 10, y: 0 },
        joinIncomingTangent: { x: 1, y: 0 },
        joinOutgoingTangent: { x: 0, y: 1 }
      },
      { point: { x: 10, y: 10 }, tangent: { x: 0, y: 1 } }
    ]
    const stroke = createRenderableStroke({}, { join: 'round' })

    const offsetFrames = helpers.offsetFramesForStrokeCenterline(
      frames,
      5,
      stroke
    )

    expect(offsetFrames.length).toBeGreaterThan(frames.length)
    expect(offsetFrames.some((frame) => frame.joinAnchorType === 'sharp')).toBe(
      true
    )
    expect(
      offsetFrames.some(
        (frame) =>
          Math.abs(frame.point.x - 5) <= 1e-6 && Math.abs(frame.point.y) <= 1e-6
      )
    ).toBe(true)
    expect(
      offsetFrames.some(
        (frame) =>
          Math.abs(frame.point.x - 10) <= 1e-6 &&
          Math.abs(frame.point.y - 5) <= 1e-6
      )
    ).toBe(true)
  })

  it('buildDecomposedStrokeOutlinePolygons decomposes a round sharp corner into simple quads and a join sector without shard pairing', () => {
    const stroke = createRenderableStroke({}, { join: 'round', cap: 'none' })
    const polygons = helpers.buildDecomposedStrokeOutlinePolygons(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 }
      ],
      stroke
    )

    expect(polygons).toHaveLength(3)
    expect(polygons.every((polygon) => helpers.isSimplePolygon(polygon))).toBe(
      true
    )
    expect(
      polygons.some(
        (polygon) =>
          polygon.length > 3 &&
          pointCoveredByPolygons({ x: 6.5, y: 3.5 }, [polygon]) &&
          !pointCoveredByPolygons({ x: 8.5, y: -1.5 }, [polygon])
      )
    ).toBe(true)
  })

  it('reported round-join inside-dashed star dashes do not emit overlapping polygons within a single dash outline', () => {
    const path = buildReportedRoundInsideDashedStarPath()
    const stroke = createRenderableStroke({
      position: StrokePositions.INSIDE,
      width: 10,
      dash: 20,
      gap: 20,
      joinType: 'round'
    })
    const allocation = buildStrokeDashAllocation(path, stroke)
    const interval = allocation.dashIntervals.find(
      (candidate) => candidate.touchedSegmentIndices.length === 1
    )

    expect(interval).toBeDefined()
    if (!interval) {
      return
    }

    const subpath = helpers.buildDashSubpathGeometry(path, interval, stroke)
    expect(subpath).not.toBeNull()
    if (!subpath) {
      return
    }

    const polygons = helpers.buildOpenStrokeOutlinePolygons(subpath, stroke)
    expect(polygons.length).toBeGreaterThan(0)
    expect(estimatePolygonOverlapPixels(polygons)).toBe(0)
  })

  it('reported round-join inside-dashed star keeps per-dash fallback polygon counts bounded after outline simplification', () => {
    const path = buildReportedRoundInsideDashedStarPath()
    const stroke = createRenderableStroke({
      position: StrokePositions.INSIDE,
      width: 10,
      dash: 20,
      gap: 20,
      joinType: 'round'
    })
    const allocation = buildStrokeDashAllocation(path, stroke)

    allocation.dashIntervals.forEach((interval) => {
      const subpath = helpers.buildDashSubpathGeometry(path, interval, stroke)
      expect(subpath).not.toBeNull()
      if (!subpath) {
        return
      }

      const polygons = helpers.buildOpenStrokeOutlinePolygons(subpath, stroke)
      expect(polygons.length).toBeGreaterThan(0)
      if (polygons.length > 8) {
        throw new Error(
          `dash ${interval.dashIndex} fallback polygons ${polygons.length}`
        )
      }
    })
  })

  it('reported round-join inside-dashed star keeps terminal centerline endpoints covered on problematic dashes', () => {
    const path = buildReportedRoundInsideDashedStarPath()
    const stroke = createRenderableStroke({
      position: StrokePositions.INSIDE,
      width: 10,
      dash: 20,
      gap: 20,
      joinType: 'round'
    })
    const allocation = buildStrokeDashAllocation(path, stroke)

    allocation.dashIntervals
      .filter((interval) => interval.touchedSegmentIndices.length === 1)
      .forEach((interval) => {
        const subpath = helpers.buildDashSubpathGeometry(path, interval, stroke)
        expect(subpath).not.toBeNull()
        if (!subpath) {
          return
        }

        const capBoundarySource = helpers.buildSmoothStrokeCapBoundarySource(
          subpath.centerlineFrames,
          stroke
        )
        const polygons = helpers.buildOpenStrokeOutlinePolygons(subpath, stroke)

        expect(capBoundarySource).not.toBeNull()
        if (!capBoundarySource) {
          return
        }
        expect(polygons.length).toBeGreaterThan(0)
        if (!pointCoveredByPolygons(subpath.centerlinePoints[0], polygons)) {
          throw new Error(
            `dash ${interval.dashIndex} misses start endpoint polygons=${polygons.length}`
          )
        }
        if (
          !pointCoveredByPolygons(
            subpath.centerlinePoints[subpath.centerlinePoints.length - 1],
            polygons
          )
        ) {
          throw new Error(
            `dash ${interval.dashIndex} misses end endpoint polygons=${polygons.length}`
          )
        }
      })
  })

  it('reported round-join inside-dashed star keeps inside stroke centerline lengths within a bounded offset-driven deviation from authored dash lengths', () => {
    const path = buildReportedRoundInsideDashedStarPath()
    const stroke = createRenderableStroke({
      position: StrokePositions.INSIDE,
      width: 10,
      dash: 20,
      gap: 20,
      joinType: 'round'
    })
    const allocation = buildStrokeDashAllocation(path, stroke)

    const diagnostics = allocation.dashIntervals.map((interval) => {
      const subpath = helpers.buildDashSubpathGeometry(path, interval, stroke)
      expect(subpath).not.toBeNull()
      if (!subpath) {
        return null
      }

      const centerlineLength = subpath.centerlinePoints
        .slice(1)
        .reduce(
          (total, point, index) =>
            total + helpers.distance(subpath.centerlinePoints[index], point),
          0
        )

      return {
        dashIndex: interval.dashIndex,
        touchedSegmentIndices: interval.touchedSegmentIndices,
        authoredLength: interval.intervalLength,
        centerlineLength,
        shrinkage: interval.intervalLength - centerlineLength
      }
    })

    const maxShrinkage = Math.max(
      ...diagnostics
        .filter(
          (diagnostic): diagnostic is NonNullable<typeof diagnostic> =>
            diagnostic !== null
        )
        .map((diagnostic) => diagnostic.shrinkage)
    )

    expect(maxShrinkage).toBeLessThanOrEqual(8.5)
  })

  it.fails(
    'reported round-join inside-dashed star dashes should not overdraw after polygon triangulation',
    () => {
      const path = buildReportedRoundInsideDashedStarPath()
      const stroke = createRenderableStroke({
        position: StrokePositions.INSIDE,
        width: 10,
        dash: 20,
        gap: 20,
        joinType: 'round'
      })
      const allocation = buildStrokeDashAllocation(path, stroke)

      allocation.dashIntervals.forEach((interval) => {
        const subpath = helpers.buildDashSubpathGeometry(path, interval, stroke)
        expect(subpath).not.toBeNull()
        if (!subpath) {
          return
        }

        const polygons = helpers.buildOpenStrokeOutlinePolygons(subpath, stroke)
        expect(polygons.length).toBeGreaterThan(0)
        const overlapPixelCount = estimateTriangleOverdrawPixels(polygons)
        if (overlapPixelCount !== 0) {
          throw new Error(
            `dash ${interval.dashIndex} triangulation overdraw pixels: ${overlapPixelCount} polygons: ${polygons.length}`
          )
        }
      })
    }
  )

  it('reported round-join inside-dashed star should keep acute-angle and high-curvature fallback polygon counts tightly bounded', () => {
    const path = buildReportedRoundInsideDashedStarPath()
    const stroke = createRenderableStroke({
      position: StrokePositions.INSIDE,
      width: 10,
      dash: 20,
      gap: 20,
      joinType: 'round'
    })
    const allocation = buildStrokeDashAllocation(path, stroke)

    const problematicIntervals = allocation.dashIntervals.filter(
      (interval) => interval.touchedSegmentIndices.length > 1
    )
    expect(problematicIntervals.length).toBeGreaterThan(0)

    problematicIntervals.forEach((interval) => {
      const subpath = helpers.buildDashSubpathGeometry(path, interval, stroke)
      expect(subpath).not.toBeNull()
      if (!subpath) {
        return
      }

      const polygons = helpers.buildOpenStrokeOutlinePolygons(subpath, stroke)
      expect(polygons.length).toBeLessThanOrEqual(6)
    })
  })

  it.fails(
    'reported round-join inside-dashed star seam-adjacent wrap dashes should not overlap once ownership resolution exists',
    () => {
      const path = buildReportedRoundInsideDashedStarPath()
      const stroke = createRenderableStroke({
        position: StrokePositions.INSIDE,
        width: 10,
        dash: 20,
        gap: 20,
        joinType: 'round'
      })
      const allocation = buildStrokeDashAllocation(path, stroke)
      const getPolygons = (dashIndex: number) => {
        const interval = allocation.dashIntervals.find(
          (candidate) => candidate.dashIndex === dashIndex
        )
        expect(interval).toBeDefined()
        if (!interval) {
          return []
        }

        const subpath = helpers.buildDashSubpathGeometry(path, interval, stroke)
        expect(subpath).not.toBeNull()
        if (!subpath) {
          return []
        }

        return helpers.buildOpenStrokeOutlinePolygons(subpath, stroke)
      }

      const overlap = estimatePolygonOverlapPixels([
        ...getPolygons(0),
        ...getPolygons(68)
      ])
      expect(overlap).toBe(0)
    }
  )

  it('high-curvature open dashes emit simple fallback polygons instead of self-intersecting strips', () => {
    const path = buildPath(
      [
        { id: 'a', x: 80, y: 0, outHandle: { x: 40, y: 80 } },
        {
          id: 'b',
          x: 0,
          y: 160,
          inHandle: { x: 0, y: 90 }
        }
      ],
      false
    )
    const stroke = createRenderableStroke({
      width: 24,
      dash: 30,
      gap: 20
    })
    const allocation = buildDashIntervalAllocation(path, {
      dash: stroke.dash,
      gap: stroke.gap
    })
    const subpath = helpers.buildDashSubpathGeometry(
      path,
      allocation.dashIntervals[0],
      stroke
    )

    expect(subpath).not.toBeNull()
    if (!subpath) {
      return
    }

    const polygons = helpers.buildOpenStrokeOutlinePolygons(subpath, stroke)
    expect(polygons.length).toBeGreaterThan(0)
    expect(polygons.every((polygon) => helpers.isSimplePolygon(polygon))).toBe(
      true
    )
  })
})
