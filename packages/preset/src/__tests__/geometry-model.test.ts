import { describe, expect, it } from 'vitest'
import type { VectorNetwork, VectorPointNode, VectorSegment } from '@asyra/core'
import { StrokePositions, createDefaultStroke } from '@asyra/utils'
import {
  __dashedGeometryModelTestUtils,
  applyDashedGeometryPhase6ToPipelineState,
  applyDashedGeometryPhase5OwnershipResolutions,
  applyDashedGeometryPhase5ToPipelineState,
  applyInitialDashedGeometryPhase5Rules,
  analyzeDashedGeometryCandidates,
  buildDashedGeometryPhase1,
  buildDashedGeometryPhase5DecisionContract,
  buildDashedGeometryPhase5RuleEvaluationResult,
  buildDashedGeometryPhase5RuleInputs,
  buildDashedGeometryPhase6AssemblyInput,
  buildDashedGeometryPhase6ResultContract,
  buildDashIntervalAllocation,
  buildVectorGeometryModelPath,
  computeDashedGeometryPipelineToPhase4,
  computeDashedGeometryPipelineState,
  createDashedGeometryModel,
  evaluateDashedGeometryPhase5CenterlineProximityRule,
  evaluateDashedGeometryPhase5ContinuityRule,
  finalizeDashedGeometryPhase6,
  materializeDashedGeometryPhase2Model,
  selectDashedGeometryModelFromPipelineState,
  selectDashedGeometryModelForRender,
  resolveDashedGeometryPhase5ByCenterlineProximityRule,
  resolveDashedGeometryPhase5ByContinuityRule,
  resolveDashedGeometryForRender
} from '../components/geometry-model'
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

const createDashedStroke = (
  overrides: Partial<ReturnType<typeof createDefaultStroke>> = {}
) =>
  createDefaultStroke({
    style: 'dashed',
    position: StrokePositions.CENTER,
    width: 10,
    dash: 20,
    gap: 10,
    joinType: 'round',
    ...overrides
  })

const createRenderableDashedStroke = (
  overrides: Partial<ReturnType<typeof createDefaultStroke>> = {},
  renderOverrides: Partial<RenderableStroke> = {}
): RenderableStroke => {
  const stroke = createDashedStroke(overrides)

  return {
    style: stroke.style,
    position: stroke.position,
    width: stroke.width,
    dash: stroke.dash,
    gap: stroke.gap,
    join: stroke.joinType,
    miterLimit: 1,
    cap: 'round',
    color: 0,
    alpha: stroke.opacity,
    ...renderOverrides
  }
}

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

const getPointsNear = (
  polygons: { x: number; y: number }[][],
  center: { x: number; y: number },
  radius: number
) =>
  polygons.flatMap((polygon) =>
    polygon.filter(
      (point) => Math.hypot(point.x - center.x, point.y - center.y) <= radius
    )
  )

const pointOnSegment = (
  point: { x: number; y: number },
  start: { x: number; y: number },
  end: { x: number; y: number },
  tolerance = 1e-6
) => {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared <= tolerance * tolerance) {
    return Math.hypot(point.x - start.x, point.y - start.y) <= tolerance
  }

  const t =
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared
  if (t < -tolerance || t > 1 + tolerance) {
    return false
  }

  const projected = {
    x: start.x + dx * Math.max(0, Math.min(1, t)),
    y: start.y + dy * Math.max(0, Math.min(1, t))
  }
  return Math.hypot(point.x - projected.x, point.y - projected.y) <= tolerance
}

const pointInPolygon = (
  point: { x: number; y: number },
  polygon: { x: number; y: number }[]
) => {
  let inside = false

  for (
    let index = 0, previous = polygon.length - 1;
    index < polygon.length;
    previous = index, index += 1
  ) {
    const current = polygon[index]
    const prior = polygon[previous]

    if (pointOnSegment(point, prior, current)) {
      return true
    }

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

const getCombinedPolygonBounds = (
  left: { x: number; y: number }[][],
  right: { x: number; y: number }[][]
) => {
  const bounds = getPolygonBounds(left.concat(right))

  return {
    minX: Math.floor(bounds.minX),
    minY: Math.floor(bounds.minY),
    maxX: Math.ceil(bounds.maxX),
    maxY: Math.ceil(bounds.maxY)
  }
}

const polygonSetCoversPoint = (
  polygons: { x: number; y: number }[][],
  point: { x: number; y: number }
) => polygons.some((polygon) => pointInPolygon(point, polygon))

const getUnionCoverageMismatchRatio = (
  left: { x: number; y: number }[][],
  right: { x: number; y: number }[][],
  step = 6
) => {
  const bounds = getCombinedPolygonBounds(left, right)
  let unionSamples = 0
  let mismatchSamples = 0

  for (let y = bounds.minY + step / 2; y < bounds.maxY; y += step) {
    for (let x = bounds.minX + step / 2; x < bounds.maxX; x += step) {
      const point = { x, y }
      const leftCovers = polygonSetCoversPoint(left, point)
      const rightCovers = polygonSetCoversPoint(right, point)

      if (!leftCovers && !rightCovers) {
        continue
      }

      unionSamples += 1
      if (leftCovers !== rightCovers) {
        mismatchSamples += 1
      }
    }
  }

  return unionSamples === 0 ? 0 : mismatchSamples / unionSamples
}

const getSelfOverlapCoverageRatio = (
  polygons: { x: number; y: number }[][],
  step = 6
) => {
  if (polygons.length < 2) {
    return 0
  }

  const bounds = getPolygonBounds(polygons)
  let coveredSamples = 0
  let overlapSamples = 0

  for (let y = bounds.minY + step / 2; y < bounds.maxY; y += step) {
    for (let x = bounds.minX + step / 2; x < bounds.maxX; x += step) {
      const point = { x, y }
      const coveringCount = polygons.reduce(
        (count, polygon) => count + (pointInPolygon(point, polygon) ? 1 : 0),
        0
      )

      if (coveringCount === 0) {
        continue
      }

      coveredSamples += 1
      if (coveringCount > 1) {
        overlapSamples += 1
      }
    }
  }

  return coveredSamples === 0 ? 0 : overlapSamples / coveredSamples
}

const getSelfOverlapCoverageRatioWithinBounds = (
  polygons: { x: number; y: number }[][],
  bounds: {
    minX: number
    minY: number
    maxX: number
    maxY: number
  },
  step = 4
) => {
  if (polygons.length < 2) {
    return 0
  }

  let coveredSamples = 0
  let overlapSamples = 0

  for (let y = bounds.minY + step / 2; y < bounds.maxY; y += step) {
    for (let x = bounds.minX + step / 2; x < bounds.maxX; x += step) {
      const point = { x, y }
      const coveringCount = polygons.reduce(
        (count, polygon) => count + (pointInPolygon(point, polygon) ? 1 : 0),
        0
      )

      if (coveringCount === 0) {
        continue
      }

      coveredSamples += 1
      if (coveringCount > 1) {
        overlapSamples += 1
      }
    }
  }

  return coveredSamples === 0 ? 0 : overlapSamples / coveredSamples
}

const getUnionCoverageMismatchRatioWithinBounds = (
  left: { x: number; y: number }[][],
  right: { x: number; y: number }[][],
  bounds: {
    minX: number
    minY: number
    maxX: number
    maxY: number
  },
  step = 4
) => {
  let unionSamples = 0
  let mismatchSamples = 0

  for (let y = bounds.minY + step / 2; y < bounds.maxY; y += step) {
    for (let x = bounds.minX + step / 2; x < bounds.maxX; x += step) {
      const point = { x, y }
      const leftCovers = polygonSetCoversPoint(left, point)
      const rightCovers = polygonSetCoversPoint(right, point)

      if (!leftCovers && !rightCovers) {
        continue
      }

      unionSamples += 1
      if (leftCovers !== rightCovers) {
        mismatchSamples += 1
      }
    }
  }

  return unionSamples === 0 ? 0 : mismatchSamples / unionSamples
}

const polygonIntersectsBounds = (
  polygon: { x: number; y: number }[],
  bounds: {
    minX: number
    minY: number
    maxX: number
    maxY: number
  }
) =>
  polygon.some(
    (point) =>
      point.x >= bounds.minX &&
      point.x <= bounds.maxX &&
      point.y >= bounds.minY &&
      point.y <= bounds.maxY
  )

const measureMedianDuration = (
  fn: () => void,
  options: {
    iterations?: number
    warmupIterations?: number
  } = {}
) => {
  const iterations = options.iterations ?? 3
  const warmupIterations = options.warmupIterations ?? 1

  for (let index = 0; index < warmupIterations; index += 1) {
    fn()
  }

  const durations: number[] = []
  for (let index = 0; index < iterations; index += 1) {
    const start = performance.now()
    fn()
    durations.push(performance.now() - start)
  }

  const sorted = [...durations].sort((left, right) => left - right)

  return {
    durations,
    median: sorted[Math.floor(sorted.length / 2)] ?? 0,
    min: sorted[0] ?? 0,
    max: sorted[sorted.length - 1] ?? 0
  }
}

const getLast = <T>(items: readonly T[]) => items[items.length - 1]

describe('geometry model', () => {
  it('phase1: open-path dash/gap allocation keeps authored lengths and ordering', () => {
    const path = buildPath(
      [
        { id: 'a', x: 0, y: 0 },
        { id: 'b', x: 100, y: 0 }
      ],
      false
    )
    const stroke = createRenderableDashedStroke({ dash: 20, gap: 10 })
    const result = createDashedGeometryModel(path, stroke)

    expect(result).not.toBeNull()
    if (!result) {
      return
    }

    const allocation = result.dashIntervalAllocation
    expect(allocation.closed).toBe(false)
    expect(allocation.dashIntervals.length).toBe(4)
    expect(allocation.gapIntervals.length).toBe(3)
    expect(
      allocation.dashIntervals.map((interval) => interval.intervalLength)
    ).toEqual([20, 20, 20, 10])
    expect(
      allocation.gapIntervals.map((interval) => interval.intervalLength)
    ).toEqual([10, 10, 10])
    expect(allocation.dashIntervals[0].previousDashIndex).toBeNull()
    expect(getLast(allocation.dashIntervals)?.nextDashIndex ?? null).toBeNull()
  })

  it('phase1: pipeline input normalization returns dash context for valid dashed strokes only', () => {
    const path = buildPath(
      [
        { id: 'a', x: 0, y: 0 },
        { id: 'b', x: 100, y: 0 }
      ],
      false
    )
    const dashedStroke = createRenderableDashedStroke({ dash: 24, gap: 12 })
    const phase1 = buildDashedGeometryPhase1(path, dashedStroke)

    expect(phase1).not.toBeNull()
    expect(phase1?.path).toBe(path)
    expect(phase1?.stroke).toBe(dashedStroke)
    expect(phase1?.dashContext).toEqual({
      dash: 24,
      gap: 12
    })

    expect(
      buildDashedGeometryPhase1(path, {
        ...dashedStroke,
        style: 'solid'
      } as never)
    ).toBeNull()
  })

  it('phase1: closed-path allocation preserves seam adjacency and wrapping dash records', () => {
    const path = buildPath(
      [
        { id: 'a', x: 0, y: 0 },
        { id: 'b', x: 40, y: 0 },
        { id: 'c', x: 40, y: 40 },
        { id: 'd', x: 0, y: 40 }
      ],
      true
    )
    const stroke = createDashedStroke({ dash: 18, gap: 8 })
    const allocation = buildDashIntervalAllocation(path, {
      dash: stroke.dash,
      gap: stroke.gap
    })

    expect(allocation.closed).toBe(true)
    expect(allocation.dashIntervals.length).toBeGreaterThan(0)
    expect(allocation.dashIntervals[0].previousDashIndex).toBe(
      allocation.dashIntervals.length - 1
    )
    expect(getLast(allocation.dashIntervals)?.nextDashIndex).toBe(0)
    expect(
      allocation.gapIntervals.every(
        (interval) => interval.leadingDashIndex !== null
      )
    ).toBe(true)
    expect(
      allocation.gapIntervals.every(
        (interval) => interval.trailingDashIndex !== null
      )
    ).toBe(true)
  })

  it('phase2: straight dashed geometry renders candidate outline polygons with half-circle round caps', () => {
    const path = buildPath(
      [
        { id: 'a', x: 0, y: 0 },
        { id: 'b', x: 100, y: 0 }
      ],
      false
    )
    const stroke = createRenderableDashedStroke({
      width: 10,
      dash: 20,
      gap: 10
    })
    const result = createDashedGeometryModel(path, stroke)

    expect(result).not.toBeNull()
    if (!result) {
      return
    }

    expect(result.dashIntervalAllocation.dashIntervals).toHaveLength(4)
    expect(result.model.polygons).toHaveLength(4)

    const bounds = getPolygonBounds(result.model.polygons)
    expect(bounds.minX).toBeCloseTo(-5, 3)
    expect(bounds.maxX).toBeCloseTo(105, 3)
    expect(bounds.minY).toBeCloseTo(-5, 3)
    expect(bounds.maxY).toBeCloseTo(5, 3)

    const startCapPoints = getPointsNear(
      result.model.polygons,
      { x: 0, y: 0 },
      5.05
    )
    expect(startCapPoints.length).toBeGreaterThan(0)
    expect(startCapPoints.every((point) => point.x <= 1e-3)).toBe(true)

    const endCapPoints = getPointsNear(
      result.model.polygons,
      { x: 20, y: 0 },
      5.05
    )
    expect(endCapPoints.length).toBeGreaterThan(0)
    expect(endCapPoints.every((point) => point.x >= 20 - 1e-3)).toBe(true)
  })

  it('phase2: dash subpath extraction preserves corner-spanning intervals before outline rendering', () => {
    const path = buildPath(
      [
        { id: 'a', x: 0, y: 0 },
        { id: 'b', x: 10, y: 0 },
        { id: 'c', x: 10, y: 10 }
      ],
      false
    )
    const stroke = createRenderableDashedStroke({
      width: 2,
      dash: 12,
      gap: 100
    })
    const result = createDashedGeometryModel(path, stroke)

    expect(result).not.toBeNull()
    if (!result) {
      return
    }

    expect(result.dashIntervalAllocation.dashIntervals).toHaveLength(1)
    expect(
      result.dashIntervalAllocation.dashIntervals[0].touchedSegmentIndices
    ).toEqual([0, 1])
    expect(result.model.polygons.length).toBeGreaterThan(0)

    const bounds = getPolygonBounds(result.model.polygons)
    expect(bounds.minX).toBeLessThanOrEqual(-1)
    expect(bounds.maxX).toBeGreaterThanOrEqual(11)
    expect(bounds.minY).toBeLessThanOrEqual(-1)
    expect(bounds.maxY).toBeGreaterThanOrEqual(2.9)
  })

  it('phase2: cap modes switch terminal geometry without changing interval allocation', () => {
    const path = buildPath(
      [
        { id: 'a', x: 0, y: 0 },
        { id: 'b', x: 100, y: 0 }
      ],
      false
    )

    const noCap = createDashedGeometryModel(
      path,
      createRenderableDashedStroke(
        {
          width: 10,
          dash: 20,
          gap: 80
        },
        { cap: 'none' }
      )
    )
    const squareCap = createDashedGeometryModel(
      path,
      createRenderableDashedStroke(
        {
          width: 10,
          dash: 20,
          gap: 80
        },
        { cap: 'square' }
      )
    )

    expect(noCap).not.toBeNull()
    expect(squareCap).not.toBeNull()
    if (!noCap || !squareCap) {
      return
    }

    expect(noCap.dashIntervalAllocation).toEqual(
      squareCap.dashIntervalAllocation
    )

    const noCapBounds = getPolygonBounds(noCap.model.polygons)
    const squareCapBounds = getPolygonBounds(squareCap.model.polygons)

    expect(noCapBounds.minX).toBeCloseTo(0, 3)
    expect(noCapBounds.maxX).toBeCloseTo(20, 3)
    expect(squareCapBounds.minX).toBeCloseTo(-5, 3)
    expect(squareCapBounds.maxX).toBeCloseTo(25, 3)
  })

  it('phase2: cubic dash candidates follow the true subpath instead of endpoint tangent projection', () => {
    const path = buildPath(
      [
        {
          id: 'a',
          x: 0,
          y: 0,
          outHandle: { x: 30, y: 0 }
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
    const result = createDashedGeometryModel(
      path,
      createRenderableDashedStroke({
        width: 6,
        dash: 40,
        gap: 100
      })
    )

    expect(result).not.toBeNull()
    if (!result) {
      return
    }

    expect(result.model.polygons.length).toBeGreaterThan(0)
    const bounds = getPolygonBounds(result.model.polygons)
    expect(bounds.maxY).toBeGreaterThan(20)
  })

  it('phase2: self-intersecting star dashes stay locally bounded instead of producing runaway miter spikes', () => {
    const path = buildPath(
      [
        { id: '1', x: 50, y: 0 },
        { id: '2', x: 79, y: 90 },
        { id: '3', x: 2, y: 35 },
        { id: '4', x: 98, y: 35 },
        { id: '5', x: 21, y: 90 }
      ],
      true
    )
    const result = createDashedGeometryModel(
      path,
      createRenderableDashedStroke({
        position: StrokePositions.INSIDE,
        width: 12,
        dash: 20,
        gap: 20,
        joinType: 'miter',
        miterAngle: 28.96
      })
    )

    expect(result).not.toBeNull()
    if (!result) {
      return
    }

    expect(result.model.polygons.length).toBeGreaterThan(0)
    const bounds = getPolygonBounds(result.model.polygons)
    expect(bounds.minX).toBeGreaterThanOrEqual(-40)
    expect(bounds.minY).toBeGreaterThanOrEqual(-40)
    expect(bounds.maxX).toBeLessThanOrEqual(140)
    expect(bounds.maxY).toBeLessThanOrEqual(140)
    result.model.polygons.flat().forEach((point) => {
      expect(Number.isFinite(point.x)).toBe(true)
      expect(Number.isFinite(point.y)).toBe(true)
    })
  })

  it('phase2: reported round-join inside-dashed star emits finite locally bounded candidate polygons', () => {
    const vector = createReportedRoundInsideDashedStarVectorData()
    const path = buildVectorGeometryModelPath(
      vector.networks[REPORTED_ROUND_INSIDE_DASHED_STAR_NETWORK_ID],
      vector.points,
      vector.segments
    )
    const expectedStroke = vector.strokes[0]
    const result = createDashedGeometryModel(path, {
      style: expectedStroke.style,
      position: expectedStroke.position,
      width: expectedStroke.width,
      dash: expectedStroke.dash,
      gap: expectedStroke.gap,
      join: expectedStroke.joinType,
      miterLimit: 4,
      cap: 'round',
      color: 0,
      alpha: expectedStroke.opacity
    } as never)

    expect(result).not.toBeNull()
    if (!result) {
      return
    }

    expect(result.model.polygons.length).toBeGreaterThan(0)
    const bounds = getPolygonBounds(result.model.polygons)
    result.model.polygons.flat().forEach((point) => {
      expect(Number.isFinite(point.x)).toBe(true)
      expect(Number.isFinite(point.y)).toBe(true)
    })
    expect(bounds.minX).toBeGreaterThanOrEqual(-100)
    expect(bounds.minY).toBeGreaterThanOrEqual(-100)
    expect(bounds.maxX).toBeLessThanOrEqual(vector.width + 100)
    expect(bounds.maxY).toBeLessThanOrEqual(vector.height + 100)
  })

  it('phase3: non-overlapping dashed candidates produce an empty overlap graph', () => {
    const path = buildPath(
      [
        { id: 'a', x: 0, y: 0 },
        { id: 'b', x: 100, y: 0 }
      ],
      false
    )
    const stroke = createRenderableDashedStroke({
      width: 10,
      dash: 20,
      gap: 10
    })
    const result = createDashedGeometryModel(path, stroke)

    expect(result).not.toBeNull()
    if (!result) {
      return
    }
    const analysis = analyzeDashedGeometryCandidates(result.dashCandidates)

    expect(result.dashCandidates).toHaveLength(
      result.dashIntervalAllocation.dashIntervals.length
    )
    expect(analysis.overlapGraph.candidateCount).toBe(
      result.dashCandidates.length
    )
    expect(analysis.overlapGraph.edges).toHaveLength(0)
    expect(analysis.conflictComponents).toHaveLength(0)
    expect(analysis.atomicRegions).toHaveLength(0)
  })

  it('phase3: reported inside-dashed star builds a global overlap graph and connected conflict components', () => {
    const vector = createReportedRoundInsideDashedStarVectorData()
    const path = buildVectorGeometryModelPath(
      vector.networks[REPORTED_ROUND_INSIDE_DASHED_STAR_NETWORK_ID],
      vector.points,
      vector.segments
    )
    const expectedStroke = vector.strokes[0]
    const result = createDashedGeometryModel(path, {
      style: expectedStroke.style,
      position: expectedStroke.position,
      width: expectedStroke.width,
      dash: expectedStroke.dash,
      gap: expectedStroke.gap,
      join: expectedStroke.joinType,
      miterLimit: 4,
      cap: 'round',
      color: 0,
      alpha: expectedStroke.opacity
    } as never)

    expect(result).not.toBeNull()
    if (!result) {
      return
    }
    const analysis = analyzeDashedGeometryCandidates(result.dashCandidates)

    expect(result.dashCandidates).toHaveLength(
      result.dashIntervalAllocation.dashIntervals.length
    )
    expect(analysis.overlapGraph.candidateCount).toBe(
      result.dashCandidates.length
    )
    expect(analysis.overlapGraph.edges.length).toBeGreaterThan(0)
    expect(
      analysis.conflictComponents.some(
        (component) => component.dashIndices.length > 1
      )
    ).toBe(true)
    expect(analysis.atomicRegions.length).toBeGreaterThan(0)
    expect(
      analysis.atomicRegions.some((region) => region.coverageSet.length > 1)
    ).toBe(true)

    for (
      let leftIndex = 0;
      leftIndex < analysis.atomicRegions.length;
      leftIndex += 1
    ) {
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < analysis.atomicRegions.length;
        rightIndex += 1
      ) {
        expect(
          polygonsHavePositiveAreaOverlap(
            analysis.atomicRegions[leftIndex].regionPolygon,
            analysis.atomicRegions[rightIndex].regionPolygon
          )
        ).toBe(false)
      }
    }
  })

  it('phase4 pipeline: orchestrator separates phase2 render geometry from phase3 and phase4 analysis', () => {
    const vector = createReportedRoundInsideDashedStarVectorData()
    const path = buildVectorGeometryModelPath(
      vector.networks[REPORTED_ROUND_INSIDE_DASHED_STAR_NETWORK_ID],
      vector.points,
      vector.segments
    )
    const expectedStroke = vector.strokes[0]
    const pipeline = computeDashedGeometryPipelineToPhase4(path, {
      style: expectedStroke.style,
      position: expectedStroke.position,
      width: expectedStroke.width,
      dash: expectedStroke.dash,
      gap: expectedStroke.gap,
      join: expectedStroke.joinType,
      miterLimit: 4,
      cap: 'round',
      color: 0,
      alpha: expectedStroke.opacity
    } as never)

    expect(pipeline).not.toBeNull()
    if (!pipeline) {
      return
    }

    expect(pipeline.phase1.path).toBe(path)
    expect(pipeline.phase1.stroke.style).toBe('dashed')
    expect(pipeline.phase1.dashContext).toEqual({
      dash: expectedStroke.dash,
      gap: expectedStroke.gap
    })
    expect(pipeline.phase2.model).toBeNull()
    expect(
      materializeDashedGeometryPhase2Model(pipeline.phase2).polygons.length
    ).toBeGreaterThan(0)
    expect(pipeline.phase2.dashCandidates.length).toBeGreaterThanOrEqual(
      pipeline.phase2.dashIntervalAllocation.dashIntervals.length
    )
    expect(pipeline.phase3.overlapGraph.candidateCount).toBe(
      pipeline.phase2.dashCandidates.length
    )
    expect(pipeline.phase3.overlapGraph.edges.length).toBeGreaterThan(0)
    expect(pipeline.phase3.conflictComponents.length).toBeGreaterThan(0)
    expect(pipeline.phase4.atomicRegions.length).toBeGreaterThan(0)
    expect(
      pipeline.phase4.atomicRegions.some(
        (region) => region.coverageSet.length > 1
      )
    ).toBe(true)
  })

  it('phase5 contract: converts atomic regions into pending ownership decisions without resolving owners yet', () => {
    const phase5 = buildDashedGeometryPhase5DecisionContract({
      atomicRegions: [
        {
          regionKey: 'exclusive-left',
          componentId: 0,
          zoneId: 'zone-0',
          regionPolygon: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 0, y: 1 }
          ],
          coverageSet: [0]
        },
        {
          regionKey: 'shared-center',
          componentId: 0,
          zoneId: 'zone-0',
          regionPolygon: [
            { x: 1, y: 0 },
            { x: 2, y: 0 },
            { x: 1, y: 1 }
          ],
          coverageSet: [0, 1]
        },
        {
          regionKey: 'exclusive-right',
          componentId: 0,
          zoneId: 'zone-0',
          regionPolygon: [
            { x: 2, y: 0 },
            { x: 3, y: 0 },
            { x: 2, y: 1 }
          ],
          coverageSet: [1]
        }
      ]
    })

    expect(phase5.decisions).toHaveLength(1)
    expect(phase5.decisions[0]).toMatchObject({
      regionKey: 'shared-center',
      coverageSet: [0, 1],
      candidateDashIndices: [0, 1],
      ownerDashIndex: null,
      status: 'pending'
    })
    expect(phase5.ownership).toEqual([
      {
        regionKey: 'exclusive-left',
        componentId: 0,
        zoneId: 'zone-0',
        coverageSet: [0],
        ownerDashIndex: 0,
        regionPolygon: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 0, y: 1 }
        ]
      },
      {
        regionKey: 'exclusive-right',
        componentId: 0,
        zoneId: 'zone-0',
        coverageSet: [1],
        ownerDashIndex: 1,
        regionPolygon: [
          { x: 2, y: 0 },
          { x: 3, y: 0 },
          { x: 2, y: 1 }
        ]
      }
    ])
    expect(phase5.resolvedDecisionCount).toBe(0)
    expect(phase5.pendingDecisionCount).toBe(1)
    expect(
      phase5.decisions.every(
        (decision) =>
          decision.status === 'pending' &&
          decision.ownerDashIndex === null &&
          decision.coverageSet.join(',') ===
            decision.candidateDashIndices.join(',')
      )
    ).toBe(true)
  })

  it('phase5 contract: keeps distinct region identity when multiple atomic regions share the same coverage set', () => {
    const phase5 = buildDashedGeometryPhase5DecisionContract({
      atomicRegions: [
        {
          regionKey: 'shared-a',
          componentId: 0,
          zoneId: 'zone-a',
          regionPolygon: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 0, y: 1 }
          ],
          coverageSet: [0, 1]
        },
        {
          regionKey: 'shared-b',
          componentId: 0,
          zoneId: 'zone-b',
          regionPolygon: [
            { x: 2, y: 0 },
            { x: 3, y: 0 },
            { x: 2, y: 1 }
          ],
          coverageSet: [0, 1]
        }
      ]
    })

    const nextPhase5 = applyDashedGeometryPhase5OwnershipResolutions(phase5, [
      {
        regionKey: 'shared-a',
        componentId: 0,
        coverageSet: [0, 1],
        ownerDashIndex: 0
      }
    ])

    expect(nextPhase5.decisions).toHaveLength(2)
    expect(nextPhase5.resolvedDecisionCount).toBe(1)
    expect(nextPhase5.pendingDecisionCount).toBe(1)
    expect(nextPhase5.decisions).toEqual([
      expect.objectContaining({
        regionKey: 'shared-a',
        ownerDashIndex: 0,
        status: 'resolved'
      }),
      expect.objectContaining({
        regionKey: 'shared-b',
        ownerDashIndex: null,
        status: 'pending'
      })
    ])
  })

  it('pipeline state: resolves the reported star through phase5 and phase6', () => {
    const vector = createReportedRoundInsideDashedStarVectorData()
    const path = buildVectorGeometryModelPath(
      vector.networks[REPORTED_ROUND_INSIDE_DASHED_STAR_NETWORK_ID],
      vector.points,
      vector.segments
    )
    const expectedStroke = vector.strokes[0]
    const pipeline = computeDashedGeometryPipelineState(path, {
      style: expectedStroke.style,
      position: expectedStroke.position,
      width: expectedStroke.width,
      dash: expectedStroke.dash,
      gap: expectedStroke.gap,
      join: expectedStroke.joinType,
      miterLimit: 4,
      cap: 'round',
      color: 0,
      alpha: expectedStroke.opacity
    } as never)

    expect(pipeline).not.toBeNull()
    if (!pipeline) {
      return
    }

    expect(pipeline.phase1.path).toBe(path)
    expect(pipeline.phase2.model).toBeNull()
    expect(pipeline.phase3.conflictComponents.length).toBeGreaterThan(0)
    expect(pipeline.phase4.atomicRegions.length).toBeGreaterThan(0)
    expect(pipeline.phase5).not.toBeNull()
    expect(pipeline.phase5?.decisions.length ?? 0).toBeGreaterThan(0)
    expect(pipeline.phase5?.ownership.length ?? 0).toBeGreaterThan(0)
    expect(pipeline.phase5?.pendingDecisionCount).toBe(0)
    expect(pipeline.phase5?.resolvedDecisionCount).toBe(
      pipeline.phase5?.decisions.length ?? 0
    )
    expect(pipeline.completionPhase).toBe('phase6')
    expect(pipeline.phase6).not.toBeNull()
    expect(pipeline.phase6?.assemblyMode).toBe('resolved-conflict')
    expect(pipeline.nextPhase).toBe('complete')
  })

  it('phase5 contract: applying valid ownership resolutions advances pipeline to phase6 pending', () => {
    const vector = createReportedRoundInsideDashedStarVectorData()
    const path = buildVectorGeometryModelPath(
      vector.networks[REPORTED_ROUND_INSIDE_DASHED_STAR_NETWORK_ID],
      vector.points,
      vector.segments
    )
    const expectedStroke = vector.strokes[0]
    const pipeline = computeDashedGeometryPipelineState(path, {
      style: expectedStroke.style,
      position: expectedStroke.position,
      width: expectedStroke.width,
      dash: expectedStroke.dash,
      gap: expectedStroke.gap,
      join: expectedStroke.joinType,
      miterLimit: 4,
      cap: 'round',
      color: 0,
      alpha: expectedStroke.opacity
    } as never)

    expect(pipeline).not.toBeNull()
    if (!pipeline?.phase5) {
      return
    }

    const basePhase5 = buildDashedGeometryPhase5DecisionContract(
      pipeline.phase4
    )
    const resolutions = basePhase5.decisions.map((decision) => ({
      regionKey: decision.regionKey,
      componentId: decision.componentId,
      coverageSet: decision.coverageSet,
      ownerDashIndex: decision.candidateDashIndices[0]
    }))
    const phase5 = applyDashedGeometryPhase5OwnershipResolutions(
      basePhase5,
      resolutions
    )
    const pendingPipeline = {
      ...pipeline,
      phase5: basePhase5,
      phase6: null,
      nextPhase: 'phase5' as const
    }
    const advancedPipeline = applyDashedGeometryPhase5ToPipelineState(
      pendingPipeline,
      phase5
    )

    expect(phase5.pendingDecisionCount).toBe(0)
    expect(phase5.resolvedDecisionCount).toBe(phase5.decisions.length)
    expect(phase5.ownership).toHaveLength(
      phase5.decisions.length + basePhase5.ownership.length
    )
    expect(
      phase5.decisions.every(
        (decision) =>
          decision.status === 'resolved' && decision.ownerDashIndex !== null
      )
    ).toBe(true)
    expect(advancedPipeline.nextPhase).toBe('phase6')
    expect(advancedPipeline.phase6).toBeNull()
  })

  it('phase5 contract: owner rule inputs expose only atomic-region and candidate context', () => {
    const vector = createReportedRoundInsideDashedStarVectorData()
    const path = buildVectorGeometryModelPath(
      vector.networks[REPORTED_ROUND_INSIDE_DASHED_STAR_NETWORK_ID],
      vector.points,
      vector.segments
    )
    const expectedStroke = vector.strokes[0]
    const pipeline = computeDashedGeometryPipelineState(path, {
      style: expectedStroke.style,
      position: expectedStroke.position,
      width: expectedStroke.width,
      dash: expectedStroke.dash,
      gap: expectedStroke.gap,
      join: expectedStroke.joinType,
      miterLimit: 4,
      cap: 'round',
      color: 0,
      alpha: expectedStroke.opacity
    } as never)

    expect(pipeline).not.toBeNull()
    if (!pipeline?.phase5) {
      return
    }

    const phase5 = buildDashedGeometryPhase5DecisionContract(pipeline.phase4)
    const inputs = buildDashedGeometryPhase5RuleInputs(pipeline.phase2, phase5)

    expect(inputs).toHaveLength(phase5.decisions.length)
    expect(
      inputs.every(
        (input) =>
          input.status === 'pending' &&
          input.ownerDashIndex === null &&
          input.candidates.every(
            (candidate) => candidate.centerlinePoints.length >= 2
          ) &&
          input.candidates.length === input.candidateDashIndices.length &&
          input.candidates.every(
            (candidate, index) =>
              candidate.dashIndex === input.candidateDashIndices[index]
          )
      )
    ).toBe(true)
  })

  it('phase5 continuity rule: resolves a shared region when exactly one candidate has stronger cross-segment continuity', () => {
    const phase2 = {
      model: { polygons: [] },
      dashIntervalAllocation: {
        totalLength: 100,
        closed: false,
        dashLength: 20,
        gapLength: 10,
        dashIntervals: [],
        gapIntervals: []
      },
      dashCandidates: [
        {
          dashIndex: 0,
          interval: {
            dashIndex: 0,
            startDistance: 0,
            endDistance: 20,
            intervalLength: 20,
            touchedSegmentIndices: [0, 1],
            previousDashIndex: null,
            nextDashIndex: 1,
            previousGapIndex: null,
            nextGapIndex: 0,
            wrapsSeam: false
          },
          centerlinePoints: [
            { x: 0, y: 0.5 },
            { x: 2, y: 0.5 }
          ],
          polygons: [],
          bounds: null
        },
        {
          dashIndex: 1,
          interval: {
            dashIndex: 1,
            startDistance: 30,
            endDistance: 50,
            intervalLength: 20,
            touchedSegmentIndices: [1],
            previousDashIndex: 0,
            nextDashIndex: null,
            previousGapIndex: 0,
            nextGapIndex: null,
            wrapsSeam: false
          },
          centerlinePoints: [
            { x: 0, y: 1.5 },
            { x: 2, y: 1.5 }
          ],
          polygons: [],
          bounds: null
        }
      ]
    }
    const phase5 = {
      decisions: [
        {
          regionKey: 'shared-region',
          componentId: 0,
          coverageSet: [0, 1],
          candidateDashIndices: [0, 1],
          ownerDashIndex: null,
          regionPolygon: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 0, y: 1 }
          ],
          status: 'pending'
        }
      ],
      ownership: [],
      resolvedDecisionCount: 0,
      pendingDecisionCount: 1
    } as const

    const inputs = buildDashedGeometryPhase5RuleInputs(
      phase2 as never,
      phase5 as never
    )
    const evaluations = evaluateDashedGeometryPhase5ContinuityRule(inputs)
    const result = resolveDashedGeometryPhase5ByContinuityRule(
      phase2 as never,
      phase5 as never
    )

    expect(evaluations).toEqual([
      {
        regionKey: 'shared-region',
        componentId: 0,
        coverageSet: [0, 1],
        status: 'resolved',
        ownerDashIndex: 0,
        reason: 'continuity-unique-cross-segment-owner'
      }
    ])
    expect(result.evaluation.resolvedCount).toBe(1)
    expect(result.phase5.pendingDecisionCount).toBe(0)
    expect(result.phase5.ownership).toEqual([
      {
        regionKey: 'shared-region',
        componentId: 0,
        coverageSet: [0, 1],
        ownerDashIndex: 0,
        regionPolygon: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 0, y: 1 }
        ]
      }
    ])
  })

  it('phase5 continuity rule: defers when continuity strength is tied', () => {
    const inputs = [
      {
        regionKey: 'shared-region',
        componentId: 0,
        coverageSet: [0, 1],
        candidateDashIndices: [0, 1],
        ownerDashIndex: null,
        status: 'pending',
        regionPolygon: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 0, y: 1 }
        ],
        candidates: [
          {
            dashIndex: 0,
            interval: {
              dashIndex: 0,
              startDistance: 0,
              endDistance: 20,
              intervalLength: 20,
              touchedSegmentIndices: [0, 1],
              previousDashIndex: null,
              nextDashIndex: 1,
              previousGapIndex: null,
              nextGapIndex: 0,
              wrapsSeam: false
            },
            centerlinePoints: [
              { x: 0, y: 0.5 },
              { x: 2, y: 0.5 }
            ],
            polygons: [],
            bounds: null
          },
          {
            dashIndex: 1,
            interval: {
              dashIndex: 1,
              startDistance: 30,
              endDistance: 50,
              intervalLength: 20,
              touchedSegmentIndices: [2, 3],
              previousDashIndex: 0,
              nextDashIndex: null,
              previousGapIndex: 0,
              nextGapIndex: null,
              wrapsSeam: false
            },
            centerlinePoints: [
              { x: 0, y: 1.5 },
              { x: 2, y: 1.5 }
            ],
            polygons: [],
            bounds: null
          }
        ]
      }
    ] as const

    expect(evaluateDashedGeometryPhase5ContinuityRule(inputs as never)).toEqual(
      [
        {
          regionKey: 'shared-region',
          componentId: 0,
          coverageSet: [0, 1],
          status: 'deferred',
          ownerDashIndex: null,
          reason: 'continuity-owner-underdetermined'
        }
      ]
    )
  })

  it('phase5 centerline proximity rule: resolves a shared region when continuity ties but one centerline is closer', () => {
    const phase2 = {
      model: { polygons: [] },
      dashIntervalAllocation: {
        totalLength: 100,
        closed: false,
        dashLength: 20,
        gapLength: 10,
        dashIntervals: [],
        gapIntervals: []
      },
      dashCandidates: [
        {
          dashIndex: 0,
          interval: {
            dashIndex: 0,
            startDistance: 0,
            endDistance: 20,
            intervalLength: 20,
            touchedSegmentIndices: [0],
            previousDashIndex: null,
            nextDashIndex: 1,
            previousGapIndex: null,
            nextGapIndex: 0,
            wrapsSeam: false
          },
          centerlinePoints: [
            { x: 0, y: 0.1 },
            { x: 2, y: 0.1 }
          ],
          polygons: [],
          bounds: null
        },
        {
          dashIndex: 1,
          interval: {
            dashIndex: 1,
            startDistance: 30,
            endDistance: 50,
            intervalLength: 20,
            touchedSegmentIndices: [1],
            previousDashIndex: 0,
            nextDashIndex: null,
            previousGapIndex: 0,
            nextGapIndex: null,
            wrapsSeam: false
          },
          centerlinePoints: [
            { x: 0, y: 2 },
            { x: 2, y: 2 }
          ],
          polygons: [],
          bounds: null
        }
      ]
    }
    const phase5 = {
      decisions: [
        {
          regionKey: 'shared-region',
          componentId: 0,
          coverageSet: [0, 1],
          candidateDashIndices: [0, 1],
          ownerDashIndex: null,
          regionPolygon: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 0, y: 1 }
          ],
          status: 'pending'
        }
      ],
      ownership: [],
      resolvedDecisionCount: 0,
      pendingDecisionCount: 1
    } as const

    const inputs = buildDashedGeometryPhase5RuleInputs(
      phase2 as never,
      phase5 as never
    )
    const evaluations =
      evaluateDashedGeometryPhase5CenterlineProximityRule(inputs)
    const result = resolveDashedGeometryPhase5ByCenterlineProximityRule(
      phase2 as never,
      phase5 as never
    )

    expect(evaluations).toEqual([
      {
        regionKey: 'shared-region',
        componentId: 0,
        coverageSet: [0, 1],
        status: 'resolved',
        ownerDashIndex: 0,
        reason: 'centerline-proximity-unique-owner'
      }
    ])
    expect(result.evaluation.resolvedCount).toBe(1)
    expect(result.phase5.pendingDecisionCount).toBe(0)
    expect(result.phase5.ownership).toEqual([
      {
        regionKey: 'shared-region',
        componentId: 0,
        coverageSet: [0, 1],
        ownerDashIndex: 0,
        regionPolygon: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 0, y: 1 }
        ]
      }
    ])
  })

  it('phase5 centerline proximity rule: defers when candidate centerlines are equally close', () => {
    const inputs = [
      {
        regionKey: 'shared-region',
        componentId: 0,
        coverageSet: [0, 1],
        candidateDashIndices: [0, 1],
        ownerDashIndex: null,
        status: 'pending',
        regionPolygon: [
          { x: -1, y: -1 },
          { x: 1, y: -1 },
          { x: 1, y: 1 },
          { x: -1, y: 1 }
        ],
        candidates: [
          {
            dashIndex: 0,
            interval: {
              dashIndex: 0,
              startDistance: 0,
              endDistance: 20,
              intervalLength: 20,
              touchedSegmentIndices: [0],
              previousDashIndex: null,
              nextDashIndex: 1,
              previousGapIndex: null,
              nextGapIndex: 0,
              wrapsSeam: false
            },
            centerlinePoints: [
              { x: 0, y: -1 },
              { x: 2, y: -1 }
            ],
            polygons: [],
            bounds: null
          },
          {
            dashIndex: 1,
            interval: {
              dashIndex: 1,
              startDistance: 30,
              endDistance: 50,
              intervalLength: 20,
              touchedSegmentIndices: [1],
              previousDashIndex: 0,
              nextDashIndex: null,
              previousGapIndex: 0,
              nextGapIndex: null,
              wrapsSeam: false
            },
            centerlinePoints: [
              { x: 0, y: 1 },
              { x: 2, y: 1 }
            ],
            polygons: [],
            bounds: null
          }
        ]
      }
    ] as const

    expect(
      evaluateDashedGeometryPhase5CenterlineProximityRule(inputs as never)
    ).toEqual([
      {
        regionKey: 'shared-region',
        componentId: 0,
        coverageSet: [0, 1],
        status: 'deferred',
        ownerDashIndex: null,
        reason: 'centerline-proximity-owner-underdetermined'
      }
    ])
  })

  it('phase5 initial rules: applies centerline proximity after continuity defers', () => {
    const phase2 = {
      model: { polygons: [] },
      dashIntervalAllocation: {
        totalLength: 100,
        closed: false,
        dashLength: 20,
        gapLength: 10,
        dashIntervals: [],
        gapIntervals: []
      },
      dashCandidates: [
        {
          dashIndex: 0,
          interval: {
            dashIndex: 0,
            startDistance: 0,
            endDistance: 20,
            intervalLength: 20,
            touchedSegmentIndices: [0],
            previousDashIndex: null,
            nextDashIndex: 1,
            previousGapIndex: null,
            nextGapIndex: 0,
            wrapsSeam: false
          },
          centerlinePoints: [
            { x: 0, y: 0.1 },
            { x: 2, y: 0.1 }
          ],
          polygons: [],
          bounds: null
        },
        {
          dashIndex: 1,
          interval: {
            dashIndex: 1,
            startDistance: 30,
            endDistance: 50,
            intervalLength: 20,
            touchedSegmentIndices: [1],
            previousDashIndex: 0,
            nextDashIndex: null,
            previousGapIndex: 0,
            nextGapIndex: null,
            wrapsSeam: false
          },
          centerlinePoints: [
            { x: 0, y: 2 },
            { x: 2, y: 2 }
          ],
          polygons: [],
          bounds: null
        }
      ]
    }
    const phase5 = {
      decisions: [
        {
          regionKey: 'shared-region',
          componentId: 0,
          coverageSet: [0, 1],
          candidateDashIndices: [0, 1],
          ownerDashIndex: null,
          regionPolygon: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 0, y: 1 }
          ],
          status: 'pending'
        }
      ],
      ownership: [],
      resolvedDecisionCount: 0,
      pendingDecisionCount: 1
    } as const

    const nextPhase5 = applyInitialDashedGeometryPhase5Rules(
      phase2 as never,
      phase5 as never
    )

    expect(nextPhase5.pendingDecisionCount).toBe(0)
    expect(nextPhase5.ownership).toEqual([
      {
        regionKey: 'shared-region',
        componentId: 0,
        coverageSet: [0, 1],
        ownerDashIndex: 0,
        regionPolygon: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 0, y: 1 }
        ]
      }
    ])
  })

  it('phase5 continuity rule: leaves the reported star unresolved when continuity strength is indistinguishable', () => {
    const vector = createReportedRoundInsideDashedStarVectorData()
    const path = buildVectorGeometryModelPath(
      vector.networks[REPORTED_ROUND_INSIDE_DASHED_STAR_NETWORK_ID],
      vector.points,
      vector.segments
    )
    const expectedStroke = vector.strokes[0]
    const pipeline = computeDashedGeometryPipelineState(path, {
      style: expectedStroke.style,
      position: expectedStroke.position,
      width: expectedStroke.width,
      dash: expectedStroke.dash,
      gap: expectedStroke.gap,
      join: expectedStroke.joinType,
      miterLimit: 4,
      cap: 'round',
      color: 0,
      alpha: expectedStroke.opacity
    } as never)

    expect(pipeline).not.toBeNull()
    if (!pipeline?.phase5) {
      return
    }

    const basePhase5 = buildDashedGeometryPhase5DecisionContract(
      pipeline.phase4
    )
    const result = resolveDashedGeometryPhase5ByContinuityRule(
      pipeline.phase2,
      basePhase5
    )

    expect(result.inputs.length).toBe(basePhase5.decisions.length)
    expect(result.evaluation.resolvedCount).toBe(0)
    expect(result.evaluation.deferredCount).toBe(basePhase5.decisions.length)
    expect(result.phase5.resolvedDecisionCount).toBe(0)
    expect(result.phase5.pendingDecisionCount).toBe(basePhase5.decisions.length)
  })

  it('phase5 centerline proximity rule: resolves the reported star from the raw phase5 decision contract', () => {
    const vector = createReportedRoundInsideDashedStarVectorData()
    const path = buildVectorGeometryModelPath(
      vector.networks[REPORTED_ROUND_INSIDE_DASHED_STAR_NETWORK_ID],
      vector.points,
      vector.segments
    )
    const expectedStroke = vector.strokes[0]
    const pipeline = computeDashedGeometryPipelineToPhase4(path, {
      style: expectedStroke.style,
      position: expectedStroke.position,
      width: expectedStroke.width,
      dash: expectedStroke.dash,
      gap: expectedStroke.gap,
      join: expectedStroke.joinType,
      miterLimit: 4,
      cap: 'round',
      color: 0,
      alpha: expectedStroke.opacity
    } as never)

    expect(pipeline).not.toBeNull()
    if (!pipeline) {
      return
    }

    const phase5 = buildDashedGeometryPhase5DecisionContract(pipeline.phase4)
    const result = resolveDashedGeometryPhase5ByCenterlineProximityRule(
      pipeline.phase2,
      phase5
    )

    expect(result.inputs.length).toBe(phase5.decisions.length)
    expect(result.evaluation.resolvedCount).toBe(phase5.decisions.length)
    expect(result.evaluation.deferredCount).toBe(0)
    expect(result.phase5.pendingDecisionCount).toBe(0)
    expect(result.phase5.resolvedDecisionCount).toBe(phase5.decisions.length)
  })

  it('phase5 contract: rule evaluation result separates resolved, deferred, and conflict outputs', () => {
    const vector = createReportedRoundInsideDashedStarVectorData()
    const path = buildVectorGeometryModelPath(
      vector.networks[REPORTED_ROUND_INSIDE_DASHED_STAR_NETWORK_ID],
      vector.points,
      vector.segments
    )
    const expectedStroke = vector.strokes[0]
    const pipeline = computeDashedGeometryPipelineState(path, {
      style: expectedStroke.style,
      position: expectedStroke.position,
      width: expectedStroke.width,
      dash: expectedStroke.dash,
      gap: expectedStroke.gap,
      join: expectedStroke.joinType,
      miterLimit: 4,
      cap: 'round',
      color: 0,
      alpha: expectedStroke.opacity
    } as never)

    expect(pipeline).not.toBeNull()
    if (!pipeline?.phase5 || pipeline.phase5.decisions.length < 3) {
      return
    }

    const [resolvedDecision, deferredDecision, conflictDecision] =
      pipeline.phase5.decisions
    const evaluation = buildDashedGeometryPhase5RuleEvaluationResult(
      pipeline.phase5,
      [
        {
          regionKey: resolvedDecision.regionKey,
          componentId: resolvedDecision.componentId,
          zoneId: resolvedDecision.zoneId,
          coverageSet: resolvedDecision.coverageSet,
          status: 'resolved',
          ownerDashIndex: resolvedDecision.candidateDashIndices[0],
          reason: 'selected by future rule engine'
        },
        {
          regionKey: deferredDecision.regionKey,
          componentId: deferredDecision.componentId,
          zoneId: deferredDecision.zoneId,
          coverageSet: deferredDecision.coverageSet,
          status: 'deferred',
          ownerDashIndex: null,
          reason: 'needs more rule inputs'
        },
        {
          regionKey: conflictDecision.regionKey,
          componentId: conflictDecision.componentId,
          zoneId: conflictDecision.zoneId,
          coverageSet: conflictDecision.coverageSet,
          status: 'conflict',
          ownerDashIndex: null,
          reason: 'multiple rules disagree'
        }
      ]
    )

    expect(evaluation.resolvedCount).toBe(1)
    expect(evaluation.deferredCount).toBe(1)
    expect(evaluation.conflictCount).toBe(1)
    expect(evaluation.resolutions).toEqual([
      {
        regionKey: resolvedDecision.regionKey,
        componentId: resolvedDecision.componentId,
        coverageSet: resolvedDecision.coverageSet,
        ownerDashIndex: resolvedDecision.candidateDashIndices[0]
      }
    ])
  })

  it('phase5 contract: rule evaluation rejects invalid resolved owners and invalid unresolved owners', () => {
    const vector = createReportedRoundInsideDashedStarVectorData()
    const path = buildVectorGeometryModelPath(
      vector.networks[REPORTED_ROUND_INSIDE_DASHED_STAR_NETWORK_ID],
      vector.points,
      vector.segments
    )
    const expectedStroke = vector.strokes[0]
    const pipeline = computeDashedGeometryPipelineState(path, {
      style: expectedStroke.style,
      position: expectedStroke.position,
      width: expectedStroke.width,
      dash: expectedStroke.dash,
      gap: expectedStroke.gap,
      join: expectedStroke.joinType,
      miterLimit: 4,
      cap: 'round',
      color: 0,
      alpha: expectedStroke.opacity
    } as never)

    expect(pipeline).not.toBeNull()
    if (!pipeline?.phase5 || pipeline.phase5.decisions.length === 0) {
      return
    }

    const firstDecision = pipeline.phase5.decisions[0]
    const invalidOwnerDashIndex =
      Math.max(...firstDecision.candidateDashIndices) + 1
    const phase5 = pipeline.phase5

    expect(() =>
      buildDashedGeometryPhase5RuleEvaluationResult(phase5, [
        {
          regionKey: firstDecision.regionKey,
          componentId: firstDecision.componentId,
          zoneId: firstDecision.zoneId,
          coverageSet: firstDecision.coverageSet,
          status: 'resolved',
          ownerDashIndex: invalidOwnerDashIndex,
          reason: 'invalid owner'
        }
      ])
    ).toThrow(/Invalid dashed geometry phase5 evaluation owner/)

    expect(() =>
      buildDashedGeometryPhase5RuleEvaluationResult(phase5, [
        {
          regionKey: firstDecision.regionKey,
          componentId: firstDecision.componentId,
          zoneId: firstDecision.zoneId,
          coverageSet: firstDecision.coverageSet,
          status: 'deferred',
          ownerDashIndex: firstDecision.candidateDashIndices[0],
          reason: 'should not carry owner'
        }
      ])
    ).toThrow(/Invalid dashed geometry phase5 non-resolved evaluation/)
  })

  it('phase5 contract: rejects ownership resolutions outside candidate coverage sets', () => {
    const vector = createReportedRoundInsideDashedStarVectorData()
    const path = buildVectorGeometryModelPath(
      vector.networks[REPORTED_ROUND_INSIDE_DASHED_STAR_NETWORK_ID],
      vector.points,
      vector.segments
    )
    const expectedStroke = vector.strokes[0]
    const pipeline = computeDashedGeometryPipelineState(path, {
      style: expectedStroke.style,
      position: expectedStroke.position,
      width: expectedStroke.width,
      dash: expectedStroke.dash,
      gap: expectedStroke.gap,
      join: expectedStroke.joinType,
      miterLimit: 4,
      cap: 'round',
      color: 0,
      alpha: expectedStroke.opacity
    } as never)

    expect(pipeline).not.toBeNull()
    if (!pipeline?.phase5 || pipeline.phase5.decisions.length === 0) {
      return
    }

    const firstDecision = pipeline.phase5.decisions[0]
    const invalidOwnerDashIndex =
      Math.max(...firstDecision.candidateDashIndices) + 1
    const phase5 = pipeline.phase5

    expect(() =>
      applyDashedGeometryPhase5OwnershipResolutions(phase5, [
        {
          regionKey: firstDecision.regionKey,
          componentId: firstDecision.componentId,
          coverageSet: firstDecision.coverageSet,
          ownerDashIndex: invalidOwnerDashIndex
        }
      ])
    ).toThrow(/Invalid dashed geometry phase5 resolution/)
  })

  it('render resolve contract: exposes resolved final geometry once the reported star clears phase5 and phase6', () => {
    const vector = createReportedRoundInsideDashedStarVectorData()
    const path = buildVectorGeometryModelPath(
      vector.networks[REPORTED_ROUND_INSIDE_DASHED_STAR_NETWORK_ID],
      vector.points,
      vector.segments
    )
    const expectedStroke = vector.strokes[0]
    const resolved = resolveDashedGeometryForRender(path, {
      style: expectedStroke.style,
      position: expectedStroke.position,
      width: expectedStroke.width,
      dash: expectedStroke.dash,
      gap: expectedStroke.gap,
      join: expectedStroke.joinType,
      miterLimit: 4,
      cap: 'round',
      color: 0,
      alpha: expectedStroke.opacity
    } as never)

    expect(resolved).not.toBeNull()
    if (!resolved) {
      return
    }

    expect(resolved.status).toBe('resolved')
    expect(resolved.completionPhase).toBe('phase6')
    expect(resolved.pendingPhase).toBeNull()
    expect(resolved.model).not.toBeNull()
    expect(resolved.pipeline.phase4.atomicRegions.length).toBeGreaterThan(0)
    expect(resolved.pipeline.phase5).not.toBeNull()
    expect(resolved.pipeline.phase5?.pendingDecisionCount).toBe(0)
    expect(resolved.pipeline.phase6).not.toBeNull()
  })

  it('render selection contract: keeps pending pipelines pending instead of pretending phase2 is final', () => {
    const pipeline = {
      phase1: {
        path: {
          segments: [],
          closed: false,
          totalLength: 0,
          sampledPoints: []
        },
        stroke: createRenderableDashedStroke({
          width: 10,
          dash: 20,
          gap: 10
        }),
        dashContext: {
          dash: 20,
          gap: 10
        }
      },
      phase2: {
        model: {
          polygons: [
            [
              { x: 0, y: 0 },
              { x: 1, y: 0 },
              { x: 0, y: 1 }
            ]
          ]
        },
        dashIntervalAllocation: {
          totalLength: 100,
          closed: false,
          dashLength: 20,
          gapLength: 10,
          dashIntervals: [],
          gapIntervals: []
        },
        dashCandidates: []
      },
      phase3: {
        overlapGraph: {
          candidateCount: 0,
          edges: []
        },
        conflictComponents: []
      },
      phase4: {
        atomicRegions: []
      },
      phase5: {
        decisions: [
          {
            regionKey: 'shared-region',
            componentId: 0,
            coverageSet: [0, 1],
            candidateDashIndices: [0, 1],
            ownerDashIndex: null,
            regionPolygon: [
              { x: 0, y: 0 },
              { x: 1, y: 0 },
              { x: 0, y: 1 }
            ],
            status: 'pending'
          }
        ],
        ownership: [],
        resolvedDecisionCount: 0,
        pendingDecisionCount: 1
      },
      phase6: null,
      completionPhase: null,
      nextPhase: 'phase5' as const
    }

    const selection = selectDashedGeometryModelFromPipelineState(
      pipeline as never
    )

    expect(selection).toEqual({
      status: 'pending',
      completionPhase: null,
      pendingPhase: 'phase5',
      model: null,
      pipeline
    })
  })

  it('render selection contract: selects the resolved phase6 model for the reported star', () => {
    const vector = createReportedRoundInsideDashedStarVectorData()
    const path = buildVectorGeometryModelPath(
      vector.networks[REPORTED_ROUND_INSIDE_DASHED_STAR_NETWORK_ID],
      vector.points,
      vector.segments
    )
    const expectedStroke = vector.strokes[0]
    const selection = selectDashedGeometryModelForRender(path, {
      style: expectedStroke.style,
      position: expectedStroke.position,
      width: expectedStroke.width,
      dash: expectedStroke.dash,
      gap: expectedStroke.gap,
      join: expectedStroke.joinType,
      miterLimit: 4,
      cap: 'round',
      color: 0,
      alpha: expectedStroke.opacity
    } as never)

    expect(selection).not.toBeNull()
    if (!selection) {
      return
    }

    expect(selection.status).toBe('resolved')
    if (selection.status !== 'resolved' || !selection.model) {
      return
    }
    expect(selection.completionPhase).toBe('phase6')
    expect(selection.pendingPhase).toBeNull()
    expect(selection.pipeline.phase6).not.toBeNull()
    expect(selection.model.polygons).toEqual(
      selection.pipeline.phase6?.finalPolygons
    )
  })

  it('phase6 result: reported star final polygons preserve the phase2 candidate union coverage', () => {
    const vector = createReportedRoundInsideDashedStarVectorData()
    const path = buildVectorGeometryModelPath(
      vector.networks[REPORTED_ROUND_INSIDE_DASHED_STAR_NETWORK_ID],
      vector.points,
      vector.segments
    )
    const expectedStroke = vector.strokes[0]
    const pipeline = computeDashedGeometryPipelineState(path, {
      style: expectedStroke.style,
      position: expectedStroke.position,
      width: expectedStroke.width,
      dash: expectedStroke.dash,
      gap: expectedStroke.gap,
      join: expectedStroke.joinType,
      miterLimit: 4,
      cap: 'round',
      color: 0,
      alpha: expectedStroke.opacity
    } as never)

    expect(pipeline).not.toBeNull()
    expect(pipeline?.phase6).not.toBeNull()
    if (!pipeline?.phase6) {
      return
    }

    const phase2Model = materializeDashedGeometryPhase2Model(pipeline.phase2)
    const phase6MismatchRatio = getUnionCoverageMismatchRatio(
      phase2Model.polygons,
      pipeline.phase6.finalPolygons
    )

    expect(phase6MismatchRatio).toBeLessThan(0.01)
  })

  it('phase6 result: reported star final polygons keep sampled self-overlap within the accepted bound', () => {
    const vector = createReportedRoundInsideDashedStarVectorData()
    const path = buildVectorGeometryModelPath(
      vector.networks[REPORTED_ROUND_INSIDE_DASHED_STAR_NETWORK_ID],
      vector.points,
      vector.segments
    )
    const expectedStroke = vector.strokes[0]
    const pipeline = computeDashedGeometryPipelineState(path, {
      style: expectedStroke.style,
      position: expectedStroke.position,
      width: expectedStroke.width,
      dash: expectedStroke.dash,
      gap: expectedStroke.gap,
      join: expectedStroke.joinType,
      miterLimit: 4,
      cap: 'round',
      color: 0,
      alpha: expectedStroke.opacity
    } as never)

    expect(pipeline).not.toBeNull()
    expect(pipeline?.phase6).not.toBeNull()
    if (!pipeline?.phase6) {
      return
    }

    const selfOverlapRatio = getSelfOverlapCoverageRatio(
      pipeline.phase6.finalPolygons
    )

    expect(selfOverlapRatio).toBeLessThan(0.02)
  })

  it('phase6 hotspot regression: reported star left acute, right high-curvature, and right acute zones resolve without sampled overlap', () => {
    const vector = createReportedRoundInsideDashedStarVectorData()
    const path = buildVectorGeometryModelPath(
      vector.networks[REPORTED_ROUND_INSIDE_DASHED_STAR_NETWORK_ID],
      vector.points,
      vector.segments
    )
    const expectedStroke = vector.strokes[0]
    const pipeline = computeDashedGeometryPipelineState(path, {
      style: expectedStroke.style,
      position: expectedStroke.position,
      width: expectedStroke.width,
      dash: expectedStroke.dash,
      gap: expectedStroke.gap,
      join: expectedStroke.joinType,
      miterLimit: 4,
      cap: 'round',
      color: 0,
      alpha: expectedStroke.opacity
    } as never)

    expect(pipeline).not.toBeNull()
    expect(pipeline?.phase6).not.toBeNull()
    if (!pipeline?.phase6) {
      return
    }
    const phase6 = pipeline.phase6

    const hotspots = [
      {
        name: 'left-acute',
        bounds: { minX: -10, minY: 95, maxX: 90, maxY: 165 }
      },
      {
        name: 'right-high-curvature',
        bounds: { minX: 270, minY: 430, maxX: 360, maxY: 500 }
      },
      {
        name: 'right-acute',
        bounds: { minX: 335, minY: 215, maxX: 460, maxY: 325 }
      }
    ]

    hotspots.forEach((hotspot) => {
      const overlapRatio = getSelfOverlapCoverageRatioWithinBounds(
        phase6.finalPolygons,
        hotspot.bounds
      )
      const ownershipPolygonsInBounds =
        pipeline.phase5?.ownership
          .filter((record) =>
            polygonIntersectsBounds(record.regionPolygon, hotspot.bounds)
          )
          .map((record) => record.regionPolygon) ?? []
      const ownershipOverlapRatio = getSelfOverlapCoverageRatioWithinBounds(
        ownershipPolygonsInBounds,
        hotspot.bounds
      )
      const assembly = buildDashedGeometryPhase6AssemblyInput(
        pipeline.phase2,
        pipeline.phase5 as NonNullable<typeof pipeline.phase5>
      )
      const passthroughDashIndicesInBounds = assembly.passthroughCandidates
        .filter((candidate) =>
          candidate.polygons.some((polygon) =>
            polygonIntersectsBounds(polygon, hotspot.bounds)
          )
        )
        .map((candidate) => candidate.dashIndex)
      const perDashPassthroughOverlapSummary = assembly.passthroughCandidates
        .filter((candidate) =>
          candidate.polygons.some((polygon) =>
            polygonIntersectsBounds(polygon, hotspot.bounds)
          )
        )
        .map((candidate) => ({
          dashIndex: candidate.dashIndex,
          overlapRatio: getSelfOverlapCoverageRatioWithinBounds(
            candidate.polygons.filter((polygon) =>
              polygonIntersectsBounds(polygon, hotspot.bounds)
            ),
            hotspot.bounds
          )
        }))
      const passthroughConflictPairsInBounds =
        pipeline.phase3.overlapGraph.edges
          .filter(
            (edge) =>
              passthroughDashIndicesInBounds.includes(edge.dashIndexA) ||
              passthroughDashIndicesInBounds.includes(edge.dashIndexB)
          )
          .map((edge) => `${edge.dashIndexA}:${edge.dashIndexB}`)
      const passthroughOverlapRatio = getSelfOverlapCoverageRatioWithinBounds(
        assembly.passthroughPolygons.filter((polygon) =>
          polygonIntersectsBounds(polygon, hotspot.bounds)
        ),
        hotspot.bounds
      )
      const rawAssemblyOverlapRatio = getSelfOverlapCoverageRatioWithinBounds(
        assembly.passthroughPolygons
          .concat(ownershipPolygonsInBounds)
          .filter((polygon) =>
            polygonIntersectsBounds(polygon, hotspot.bounds)
          ),
        hotspot.bounds
      )

      expect(
        overlapRatio,
        `${hotspot.name} sampled overlap ratio ${overlapRatio}, ownership overlap ratio ${ownershipOverlapRatio}, passthrough overlap ratio ${passthroughOverlapRatio}, raw assembly overlap ratio ${rawAssemblyOverlapRatio}, passthrough dashes ${passthroughDashIndicesInBounds.join(',')}, passthrough conflict pairs ${passthroughConflictPairsInBounds.join(',')}, per-dash passthrough overlap ${perDashPassthroughOverlapSummary.map((item) => `${item.dashIndex}:${item.overlapRatio}`).join(',')}`
      ).toBe(0)
    })
  })

  it('phase6 hotspot regression: reported star right high-curvature preserves local coverage without a notch', () => {
    const vector = createReportedRoundInsideDashedStarVectorData()
    const path = buildVectorGeometryModelPath(
      vector.networks[REPORTED_ROUND_INSIDE_DASHED_STAR_NETWORK_ID],
      vector.points,
      vector.segments
    )
    const expectedStroke = vector.strokes[0]
    const pipeline = computeDashedGeometryPipelineState(path, {
      style: expectedStroke.style,
      position: expectedStroke.position,
      width: expectedStroke.width,
      dash: expectedStroke.dash,
      gap: expectedStroke.gap,
      join: expectedStroke.joinType,
      miterLimit: 4,
      cap: 'round',
      color: 0,
      alpha: expectedStroke.opacity
    } as never)

    expect(pipeline).not.toBeNull()
    expect(pipeline?.phase6).not.toBeNull()
    if (!pipeline?.phase6) {
      return
    }

    const hotspotBounds = {
      minX: 270,
      minY: 430,
      maxX: 360,
      maxY: 500
    }
    const phase2Model = materializeDashedGeometryPhase2Model(pipeline.phase2)
    const localMismatchRatio = getUnionCoverageMismatchRatioWithinBounds(
      phase2Model.polygons,
      pipeline.phase6.finalPolygons,
      hotspotBounds
    )

    expect(localMismatchRatio).toBe(0)
  })

  it('phase6 hotspot regression: reported star tile-boundary hotspots stay disjoint after ownership assembly', () => {
    const vector = createReportedRoundInsideDashedStarVectorData()
    const path = buildVectorGeometryModelPath(
      vector.networks[REPORTED_ROUND_INSIDE_DASHED_STAR_NETWORK_ID],
      vector.points,
      vector.segments
    )
    const expectedStroke = vector.strokes[0]
    const pipeline = computeDashedGeometryPipelineState(path, {
      style: expectedStroke.style,
      position: expectedStroke.position,
      width: expectedStroke.width,
      dash: expectedStroke.dash,
      gap: expectedStroke.gap,
      join: expectedStroke.joinType,
      miterLimit: 4,
      cap: 'round',
      color: 0,
      alpha: expectedStroke.opacity
    } as never)

    expect(pipeline).not.toBeNull()
    expect(pipeline?.phase6).not.toBeNull()
    if (!pipeline?.phase6) {
      return
    }

    const tileBoundaryHotspots = [
      {
        name: 'top-seam',
        bounds: { minX: 282, minY: 6, maxX: 297, maxY: 24 }
      },
      {
        name: 'right-shoulder-seam',
        bounds: { minX: 360, minY: 326, maxX: 373, maxY: 344 }
      },
      {
        name: 'lower-left-seam',
        bounds: { minX: 263, minY: 412, maxX: 276, maxY: 422 }
      }
    ]

    tileBoundaryHotspots.forEach((hotspot) => {
      expect(
        getSelfOverlapCoverageRatioWithinBounds(
          pipeline.phase6.finalPolygons,
          hotspot.bounds
        ),
        `${hotspot.name} should have zero sampled overlap`
      ).toBe(0)
    })
  })

  it('phase6 performance contract: reported star merges owned atomic regions into substantially fewer final polygons', () => {
    const vector = createReportedRoundInsideDashedStarVectorData()
    const path = buildVectorGeometryModelPath(
      vector.networks[REPORTED_ROUND_INSIDE_DASHED_STAR_NETWORK_ID],
      vector.points,
      vector.segments
    )
    const expectedStroke = vector.strokes[0]
    const pipeline = computeDashedGeometryPipelineState(path, {
      style: expectedStroke.style,
      position: expectedStroke.position,
      width: expectedStroke.width,
      dash: expectedStroke.dash,
      gap: expectedStroke.gap,
      join: expectedStroke.joinType,
      miterLimit: 4,
      cap: 'round',
      color: 0,
      alpha: expectedStroke.opacity
    } as never)

    expect(pipeline).not.toBeNull()
    expect(pipeline?.phase6).not.toBeNull()
    if (!pipeline?.phase6 || !pipeline?.phase5) {
      return
    }

    expect(pipeline.phase6.finalPolygons.length).toBeLessThan(1500)
    expect(pipeline.phase6.finalPolygons.length).toBeLessThan(
      pipeline.phase5.ownership.length / 5
    )
  })

  it('phase4 diagnostics: reported star keeps atomic region and ownership counts bounded after adjacency merging', () => {
    const vector = createReportedRoundInsideDashedStarVectorData()
    const path = buildVectorGeometryModelPath(
      vector.networks[REPORTED_ROUND_INSIDE_DASHED_STAR_NETWORK_ID],
      vector.points,
      vector.segments
    )
    const expectedStroke = vector.strokes[0]
    const pipeline = computeDashedGeometryPipelineState(path, {
      style: expectedStroke.style,
      position: expectedStroke.position,
      width: expectedStroke.width,
      dash: expectedStroke.dash,
      gap: expectedStroke.gap,
      join: expectedStroke.joinType,
      miterLimit: 4,
      cap: 'round',
      color: 0,
      alpha: expectedStroke.opacity
    } as never)

    expect(pipeline).not.toBeNull()
    expect(pipeline?.phase5).not.toBeNull()
    expect(pipeline?.phase6).not.toBeNull()
    if (!pipeline?.phase5 || !pipeline?.phase6) {
      return
    }

    expect(pipeline.phase4.atomicRegions.length).toBeLessThan(4000)
    expect(pipeline.phase5.ownership.length).toBeLessThan(4000)
    expect(pipeline.phase6.finalPolygons.length).toBeLessThan(1200)
  })

  it('phase4 preparation diagnostics: reported star keeps source-zone preparation bounded before region resolve', () => {
    const vector = createReportedRoundInsideDashedStarVectorData()
    const path = buildVectorGeometryModelPath(
      vector.networks[REPORTED_ROUND_INSIDE_DASHED_STAR_NETWORK_ID],
      vector.points,
      vector.segments
    )
    const expectedStroke = vector.strokes[0]
    const phase4Pipeline = computeDashedGeometryPipelineToPhase4(path, {
      style: expectedStroke.style,
      position: expectedStroke.position,
      width: expectedStroke.width,
      dash: expectedStroke.dash,
      gap: expectedStroke.gap,
      join: expectedStroke.joinType,
      miterLimit: 4,
      cap: 'round',
      color: 0,
      alpha: expectedStroke.opacity
    } as never)
    expect(phase4Pipeline).not.toBeNull()
    if (!phase4Pipeline) {
      return
    }
    const diagnostics =
      __dashedGeometryModelTestUtils.buildAtomicRegionPreparationDiagnostics(
        phase4Pipeline.phase2.dashCandidates,
        phase4Pipeline.phase3.conflictComponents,
        phase4Pipeline.phase3.overlapGraph
      )

    expect(diagnostics.length).toBeGreaterThan(0)

    const totals = diagnostics.reduce(
      (summary, diagnostic) => ({
        primitiveCount: summary.primitiveCount + diagnostic.primitiveCount,
        contestedPrimitiveCount:
          summary.contestedPrimitiveCount + diagnostic.contestedPrimitiveCount,
        triangleCount: summary.triangleCount + diagnostic.triangleCount,
        overlapZoneCount:
          summary.overlapZoneCount + diagnostic.overlapZoneCount,
        zonedTriangleCount:
          summary.zonedTriangleCount + diagnostic.zonedTriangleCount,
        exclusivePrimitiveCount:
          summary.exclusivePrimitiveCount + diagnostic.exclusivePrimitiveCount,
        maxZoneTriangleCount: Math.max(
          summary.maxZoneTriangleCount,
          diagnostic.maxZoneTriangleCount
        ),
        maxZoneClipTriangleCount: Math.max(
          summary.maxZoneClipTriangleCount,
          diagnostic.maxZoneClipTriangleCount
        )
      }),
      {
        primitiveCount: 0,
        contestedPrimitiveCount: 0,
        triangleCount: 0,
        overlapZoneCount: 0,
        zonedTriangleCount: 0,
        exclusivePrimitiveCount: 0,
        maxZoneTriangleCount: 0,
        maxZoneClipTriangleCount: 0
      }
    )

    expect(totals.primitiveCount).toBeLessThan(1400)
    expect(totals.contestedPrimitiveCount).toBeLessThan(800)
    expect(totals.triangleCount).toBeLessThan(1000)
    expect(totals.overlapZoneCount).toBeLessThan(40)
    expect(totals.zonedTriangleCount).toBeLessThan(1000)
    expect(totals.exclusivePrimitiveCount).toBeLessThan(500)
    expect(totals.maxZoneTriangleCount).toBeLessThan(220)
    expect(totals.maxZoneClipTriangleCount).toBeLessThan(220)
  })

  it('phase4 timing regression ceiling: reported star pipeline state stays below the current local median budget', () => {
    const vector = createReportedRoundInsideDashedStarVectorData()
    const path = buildVectorGeometryModelPath(
      vector.networks[REPORTED_ROUND_INSIDE_DASHED_STAR_NETWORK_ID],
      vector.points,
      vector.segments
    )
    const expectedStroke = vector.strokes[0]
    const renderableStroke = {
      style: expectedStroke.style,
      position: expectedStroke.position,
      width: expectedStroke.width,
      dash: expectedStroke.dash,
      gap: expectedStroke.gap,
      join: expectedStroke.joinType,
      miterLimit: 4,
      cap: 'round',
      color: 0,
      alpha: expectedStroke.opacity
    } as never

    const timing = measureMedianDuration(() => {
      computeDashedGeometryPipelineState(path, renderableStroke)
    })

    expect(timing.median).toBeLessThan(5500)
  })

  it('phase6 contract: raw conflict phase5 still exposes pending assembly input before rules run', () => {
    const vector = createReportedRoundInsideDashedStarVectorData()
    const path = buildVectorGeometryModelPath(
      vector.networks[REPORTED_ROUND_INSIDE_DASHED_STAR_NETWORK_ID],
      vector.points,
      vector.segments
    )
    const expectedStroke = vector.strokes[0]
    const pipeline = computeDashedGeometryPipelineState(path, {
      style: expectedStroke.style,
      position: expectedStroke.position,
      width: expectedStroke.width,
      dash: expectedStroke.dash,
      gap: expectedStroke.gap,
      join: expectedStroke.joinType,
      miterLimit: 4,
      cap: 'round',
      color: 0,
      alpha: expectedStroke.opacity
    } as never)

    expect(pipeline).not.toBeNull()
    if (!pipeline?.phase5) {
      return
    }

    const phase5 = buildDashedGeometryPhase5DecisionContract(pipeline.phase4)
    const assembly = buildDashedGeometryPhase6AssemblyInput(
      pipeline.phase2,
      phase5
    )

    expect(assembly.assemblyMode).toBe('incomplete-conflict')
    expect(assembly.status).toBe('pending')
    expect(assembly.unresolvedDecisions.length).toBeGreaterThan(0)
    expect(assembly.ownedRegions.length).toBeGreaterThan(0)
    expect(
      assembly.passthroughDashIndices.every(
        (dashIndex) =>
          !phase5.decisions.some((decision) =>
            decision.candidateDashIndices.includes(dashIndex)
          )
      )
    ).toBe(true)

    expect(() =>
      buildDashedGeometryPhase6ResultContract(
        assembly,
        assembly.passthroughPolygons
      )
    ).toThrow(/pending assembly input/)
  })

  it('phase6 contract: resolved conflict assembly can be finalized and written back to pipeline state', () => {
    const vector = createReportedRoundInsideDashedStarVectorData()
    const path = buildVectorGeometryModelPath(
      vector.networks[REPORTED_ROUND_INSIDE_DASHED_STAR_NETWORK_ID],
      vector.points,
      vector.segments
    )
    const expectedStroke = vector.strokes[0]
    const pipeline = computeDashedGeometryPipelineState(path, {
      style: expectedStroke.style,
      position: expectedStroke.position,
      width: expectedStroke.width,
      dash: expectedStroke.dash,
      gap: expectedStroke.gap,
      join: expectedStroke.joinType,
      miterLimit: 4,
      cap: 'round',
      color: 0,
      alpha: expectedStroke.opacity
    } as never)

    expect(pipeline).not.toBeNull()
    if (!pipeline?.phase5) {
      return
    }

    const resolutions = pipeline.phase5.decisions.map((decision) => ({
      regionKey: decision.regionKey,
      componentId: decision.componentId,
      coverageSet: decision.coverageSet,
      ownerDashIndex: decision.candidateDashIndices[0]
    }))
    const resolvedPhase5 = applyDashedGeometryPhase5OwnershipResolutions(
      pipeline.phase5,
      resolutions
    )
    const phase5Pipeline = applyDashedGeometryPhase5ToPipelineState(
      pipeline,
      resolvedPhase5
    )
    const assembly = buildDashedGeometryPhase6AssemblyInput(
      phase5Pipeline.phase2,
      resolvedPhase5
    )
    const finalPolygons = assembly.passthroughPolygons.concat(
      assembly.ownedRegions.map((region) => region.regionPolygon)
    )
    const phase6 = buildDashedGeometryPhase6ResultContract(
      assembly,
      finalPolygons
    )
    const completedPipeline = applyDashedGeometryPhase6ToPipelineState(
      phase5Pipeline,
      phase6
    )

    expect(assembly.assemblyMode).toBe('resolved-conflict')
    expect(assembly.status).toBe('ready')
    expect(phase6.assemblyMode).toBe('resolved-conflict')
    expect(phase6.finalPolygons).toEqual(finalPolygons)
    expect(phase6.sourcePolygonCount).toBe(finalPolygons.length)
    expect(completedPipeline.phase6).toEqual(phase6)
    expect(completedPipeline.nextPhase).toBe('complete')
  })

  it('phase6 assembly: excludes conflict dashes that only appear in ownership records from passthrough', () => {
    const phase2 = {
      model: { polygons: [] },
      dashIntervalAllocation: {
        totalLength: 100,
        closed: false,
        dashLength: 20,
        gapLength: 10,
        dashIntervals: [],
        gapIntervals: []
      },
      dashCandidates: [
        {
          dashIndex: 0,
          interval: {
            dashIndex: 0,
            startDistance: 0,
            endDistance: 20,
            intervalLength: 20,
            touchedSegmentIndices: [0],
            previousDashIndex: null,
            nextDashIndex: 1,
            previousGapIndex: null,
            nextGapIndex: 0,
            wrapsSeam: false
          },
          centerlinePoints: [],
          polygons: [
            [
              { x: 0, y: 0 },
              { x: 10, y: 0 },
              { x: 10, y: 4 },
              { x: 0, y: 4 }
            ]
          ],
          bounds: null
        },
        {
          dashIndex: 1,
          interval: {
            dashIndex: 1,
            startDistance: 30,
            endDistance: 50,
            intervalLength: 20,
            touchedSegmentIndices: [0],
            previousDashIndex: 0,
            nextDashIndex: null,
            previousGapIndex: 0,
            nextGapIndex: null,
            wrapsSeam: false
          },
          centerlinePoints: [],
          polygons: [
            [
              { x: 20, y: 0 },
              { x: 30, y: 0 },
              { x: 30, y: 4 },
              { x: 20, y: 4 }
            ]
          ],
          bounds: null
        }
      ]
    }
    const phase5 = {
      decisions: [],
      ownership: [
        {
          regionKey: 'exclusive-conflict-region',
          componentId: 0,
          zoneId: 'zone-0',
          coverageSet: [1],
          ownerDashIndex: 1,
          regionPolygon: [
            { x: 21, y: 0 },
            { x: 29, y: 0 },
            { x: 29, y: 4 },
            { x: 21, y: 4 }
          ]
        }
      ],
      resolvedDecisionCount: 0,
      pendingDecisionCount: 0
    }

    const assembly = buildDashedGeometryPhase6AssemblyInput(
      phase2 as never,
      phase5 as never
    )

    expect(assembly.passthroughDashIndices).toEqual([0])
    expect(assembly.passthroughPolygons).toEqual(
      phase2.dashCandidates[0].polygons
    )
  })

  it('phase6 implementation: finalized resolved conflict assembly combines passthrough and owned polygons', () => {
    const phase2 = {
      model: {
        polygons: [
          [
            { x: 10, y: 10 },
            { x: 12, y: 10 },
            { x: 12, y: 12 },
            { x: 10, y: 12 }
          ]
        ]
      },
      dashIntervalAllocation: {
        totalLength: 100,
        closed: false,
        dashLength: 20,
        gapLength: 10,
        dashIntervals: [],
        gapIntervals: []
      },
      dashCandidates: [
        {
          dashIndex: 0,
          interval: {
            dashIndex: 0,
            startDistance: 0,
            endDistance: 20,
            intervalLength: 20,
            touchedSegmentIndices: [0],
            previousDashIndex: null,
            nextDashIndex: 1,
            previousGapIndex: null,
            nextGapIndex: 0,
            wrapsSeam: false
          },
          polygons: [
            [
              { x: 10, y: 10 },
              { x: 12, y: 10 },
              { x: 12, y: 12 },
              { x: 10, y: 12 }
            ]
          ],
          centerlinePoints: [
            { x: 10, y: 11 },
            { x: 12, y: 11 }
          ],
          bounds: null
        }
      ]
    }
    const phase5 = {
      decisions: [
        {
          regionKey: 'shared-right',
          componentId: 0,
          coverageSet: [1, 2],
          candidateDashIndices: [1, 2],
          ownerDashIndex: 2,
          regionPolygon: [
            { x: 2, y: 0 },
            { x: 4, y: 0 },
            { x: 3, y: 1 }
          ],
          status: 'resolved'
        }
      ],
      ownership: [
        {
          regionKey: 'exclusive-center',
          componentId: 0,
          coverageSet: [1],
          ownerDashIndex: 1,
          regionPolygon: [
            { x: 0, y: 0 },
            { x: 2, y: 0 },
            { x: 1, y: 1 }
          ]
        },
        {
          regionKey: 'shared-right',
          componentId: 0,
          coverageSet: [1, 2],
          ownerDashIndex: 2,
          regionPolygon: [
            { x: 2, y: 0 },
            { x: 4, y: 0 },
            { x: 3, y: 1 }
          ]
        }
      ],
      resolvedDecisionCount: 1,
      pendingDecisionCount: 0
    }

    const phase6 = finalizeDashedGeometryPhase6(
      phase2 as never,
      phase5 as never
    )

    expect(phase6).toEqual({
      assemblyMode: 'resolved-conflict',
      finalPolygons: [
        [
          { x: 10, y: 10 },
          { x: 12, y: 10 },
          { x: 12, y: 12 },
          { x: 10, y: 12 }
        ],
        [
          { x: 0, y: 0 },
          { x: 2, y: 0 },
          { x: 1, y: 1 }
        ],
        [
          { x: 2, y: 0 },
          { x: 4, y: 0 },
          { x: 3, y: 1 }
        ]
      ],
      sourcePolygonCount: 3
    })
  })

  it('phase6 cache: cache hit does not materialize passthrough source-model candidates before returning', () => {
    const vector = createReportedRoundInsideDashedStarVectorData()
    const path = buildVectorGeometryModelPath(
      vector.networks[REPORTED_ROUND_INSIDE_DASHED_STAR_NETWORK_ID],
      vector.points,
      vector.segments
    )
    const expectedStroke = vector.strokes[0]
    const stroke = {
      style: expectedStroke.style,
      position: expectedStroke.position,
      width: expectedStroke.width,
      dash: expectedStroke.dash,
      gap: expectedStroke.gap,
      join: expectedStroke.joinType,
      miterLimit: 4,
      cap: 'round',
      color: 0,
      alpha: expectedStroke.opacity
    } as never

    const firstPipeline = computeDashedGeometryPipelineToPhase4(path, stroke)
    expect(firstPipeline).not.toBeNull()
    if (!firstPipeline) {
      return
    }

    const firstPhase5 = applyInitialDashedGeometryPhase5Rules(
      firstPipeline.phase2,
      buildDashedGeometryPhase5DecisionContract(firstPipeline.phase4)
    )
    const firstPhase6 = finalizeDashedGeometryPhase6(
      firstPipeline.phase2,
      firstPhase5
    )
    expect(firstPhase6).not.toBeNull()

    const secondPipeline = computeDashedGeometryPipelineToPhase4(path, stroke)
    expect(secondPipeline).not.toBeNull()
    if (!secondPipeline) {
      return
    }

    const sourceModelCandidatesBefore =
      secondPipeline.phase2.dashCandidates.filter(
        (candidate) =>
          !candidate.polygonsMaterialized &&
          !candidate.passthroughRenderPolygonsSafe &&
          !(
            candidate.renderBaselinePolygons &&
            candidate.renderSupplementPolygons
          )
      )
    expect(sourceModelCandidatesBefore.length).toBeGreaterThan(0)

    const secondPhase5 = applyInitialDashedGeometryPhase5Rules(
      secondPipeline.phase2,
      buildDashedGeometryPhase5DecisionContract(secondPipeline.phase4)
    )
    const secondPhase6 = finalizeDashedGeometryPhase6(
      secondPipeline.phase2,
      secondPhase5
    )

    expect(secondPhase6).toEqual(firstPhase6)
    expect(
      sourceModelCandidatesBefore.every(
        (candidate) => candidate.polygonsMaterialized !== true
      )
    ).toBe(true)
  })

  it('phase6 implementation: does not finalize incomplete conflict assembly', () => {
    const phase2 = {
      model: { polygons: [] },
      dashIntervalAllocation: {
        totalLength: 100,
        closed: false,
        dashLength: 20,
        gapLength: 10,
        dashIntervals: [],
        gapIntervals: []
      },
      dashCandidates: [
        {
          dashIndex: 0,
          interval: {
            dashIndex: 0,
            startDistance: 0,
            endDistance: 20,
            intervalLength: 20,
            touchedSegmentIndices: [0],
            previousDashIndex: null,
            nextDashIndex: 1,
            previousGapIndex: null,
            nextGapIndex: 0,
            wrapsSeam: false
          },
          centerlinePoints: [
            { x: 0, y: 0 },
            { x: 2, y: 0 }
          ],
          polygons: [],
          bounds: null
        },
        {
          dashIndex: 1,
          interval: {
            dashIndex: 1,
            startDistance: 30,
            endDistance: 50,
            intervalLength: 20,
            touchedSegmentIndices: [0],
            previousDashIndex: 0,
            nextDashIndex: null,
            previousGapIndex: 0,
            nextGapIndex: null,
            wrapsSeam: false
          },
          centerlinePoints: [
            { x: 0, y: 1 },
            { x: 2, y: 1 }
          ],
          polygons: [],
          bounds: null
        }
      ]
    }
    const phase5 = {
      decisions: [
        {
          regionKey: 'shared-region',
          componentId: 0,
          coverageSet: [0, 1],
          candidateDashIndices: [0, 1],
          ownerDashIndex: null,
          regionPolygon: [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 0, y: 1 }
          ],
          status: 'pending'
        }
      ],
      ownership: [],
      resolvedDecisionCount: 0,
      pendingDecisionCount: 1
    }

    expect(finalizeDashedGeometryPhase6(phase2 as never, phase5 as never)).toBe(
      null
    )
  })

  it('no-conflict pipeline state: completes at phase2 and resolves render geometry without phase6', () => {
    const path = buildPath(
      [
        { id: 'a', x: 0, y: 0 },
        { id: 'b', x: 100, y: 0 }
      ],
      false
    )
    const stroke = createRenderableDashedStroke({
      width: 10,
      dash: 20,
      gap: 10
    })
    const pipeline = computeDashedGeometryPipelineState(path, stroke)
    const resolved = resolveDashedGeometryForRender(path, stroke)

    expect(pipeline).not.toBeNull()
    expect(resolved).not.toBeNull()
    if (!pipeline || !resolved || !pipeline.phase5) {
      return
    }

    const assembly = buildDashedGeometryPhase6AssemblyInput(
      pipeline.phase2,
      pipeline.phase5
    )

    expect(pipeline.phase4.atomicRegions).toHaveLength(0)
    expect(pipeline.phase5.decisions).toHaveLength(0)
    expect(pipeline.phase5.pendingDecisionCount).toBe(0)
    expect(assembly.assemblyMode).toBe('passthrough-only')
    expect(assembly.status).toBe('ready')
    expect(assembly.unresolvedDecisions).toHaveLength(0)
    expect(assembly.passthroughDashIndices).toHaveLength(
      pipeline.phase2.dashCandidates.length
    )
    expect(pipeline.completionPhase).toBe('phase2')
    expect(pipeline.phase6).toBeNull()
    expect(pipeline.nextPhase).toBe('complete')
    expect(resolved.status).toBe('resolved')
    expect(resolved.completionPhase).toBe('phase2')
    expect(resolved.pendingPhase).toBeNull()
    expect(resolved.model?.polygons).toEqual(
      materializeDashedGeometryPhase2Model(pipeline.phase2).polygons
    )
  })
})
