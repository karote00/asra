import {
  buildSelfIntersectingResolvedGeometry,
  splitTracedSegmentsByIntersections,
  type SelfIntersectionPairCache,
  type EvenOddBoundaryContour,
  type EvenOddLegalFaceBoundaryEdge,
  type EvenOddLegalFaceBoundary,
  type TracedLineSegment
} from './self-intersecting-legal-domain'
import {
  samplePathSegmentFrameAtLength,
  slicePathGeometryPoints,
  type PathGeometry,
  type PathSegment
} from './path-geometry'
import type { PathTopologyModel } from './path-topology-model'
import type { PolygonRegion } from './geometry-backend'
import type { Vec2 } from './solid-stroke-geometry-core'

interface ResolvedVectorGeometryNetworkInput {
  networkId: string
  path: PathGeometry
  topology: PathTopologyModel
}

export interface ResolvedVectorGeometryNetworkFrameCache {
  tracedSegmentSignatures: string[]
  tracedPathSegmentCache?: ResolvedVectorPathSegmentTraceFrameCache
  selfIntersectionCache?: SelfIntersectionPairCache
  pairCacheTranslationOffset?: Vec2
  detailMode?: IncrementalResolvedGeometryOptions['detailMode']
  geometry?: ResolvedVectorSelfIntersectingGeometry | null
}

interface ResolvedVectorLocalTracedSegment {
  localStartDistance: number
  localEndDistance: number
  startPointIndex: number
  start: Vec2
  end: Vec2
}

interface ResolvedVectorPathSegmentTraceCacheEntry {
  key: string
  origin: Vec2
  localSegments: ResolvedVectorLocalTracedSegment[]
}

interface ResolvedVectorPathSegmentTraceFrameCache {
  entries: Map<string, ResolvedVectorPathSegmentTraceCacheEntry>
}

export interface ResolvedVectorGeometryFrameCache {
  networks: Map<string, ResolvedVectorGeometryNetworkFrameCache>
}

export interface IncrementalResolvedGeometryOptions {
  previousCache?: ResolvedVectorGeometryFrameCache
  detailMode?: 'full' | 'fill-only'
}

export interface ResolvedVectorSelfIntersectingGeometry {
  tracedSegments: TracedLineSegment[]
  fillRegions: PolygonRegion[]
  legalFaceBoundaries: EvenOddLegalFaceBoundary[]
  unfilledFaceBoundaries: EvenOddLegalFaceBoundary[]
  legalBoundaryContours: EvenOddBoundaryContour[]
  sourceSplitRanges: ResolvedVectorSourceSplitRange[]
  strokeBoundaryDomains: ResolvedVectorStrokeBoundaryDomain[]
}

export interface ResolvedVectorSourceSplitRange {
  rangeId: string
  boundaryDomainSourceId: string
  boundaryPoints: Vec2[]
  boundaryStartDistance: number
  boundaryEndDistance: number
  boundaryTotalLength: number
  sourceSegmentIndex: number
  sourceStartDistance: number
  sourceEndDistance: number
  legalSide: 1 | -1
  filledSide: 1 | -1
  unfilledSide: 1 | -1
  boundaryRole: 'outer' | 'hole' | 'filled-face' | 'ambiguous'
  sideResolutionStatus: 'resolved' | 'conflict'
  contourIds: string[]
  legalFaceIds: string[]
  oppositeFaceIds: string[]
  edgeIds: string[]
  usesImplicitClosingEdge?: boolean
}

export interface ResolvedVectorStrokeBoundaryDomain
  extends ResolvedVectorSourceSplitRange {
  boundaryDomainId: string
  insideEligible: boolean
  outsideEligible: boolean
  insideSelectedSide: 1 | -1
  outsideSelectedSide: 1 | -1 | null
  adjacentFilledFaceIds: string[]
  adjacentUnfilledFaceIds: string[]
}

export interface ResolvedVectorGeometryNetworkModel
  extends ResolvedVectorGeometryNetworkInput {
  selfIntersecting: ResolvedVectorSelfIntersectingGeometry | null
}

export interface ResolvedVectorGeometryModel {
  modelId: string
  fillRule: PathTopologyModel['fillRule']
  networks: ResolvedVectorGeometryNetworkModel[]
  cache?: ResolvedVectorGeometryFrameCache
}

const EPSILON = 1e-6
const SOURCE_SPLIT_RANGE_CACHE_LIMIT = 1024

const distanceBetween = (a: Vec2, b: Vec2) => Math.hypot(b.x - a.x, b.y - a.y)

const getTracedSegmentSignature = (
  segment: TracedLineSegment,
  translationOffset: Vec2 = { x: 0, y: 0 }
) =>
  [
    (segment.start.x - translationOffset.x).toFixed(4),
    (segment.start.y - translationOffset.y).toFixed(4),
    (segment.end.x - translationOffset.x).toFixed(4),
    (segment.end.y - translationOffset.y).toFixed(4),
    segment.sourceSegmentIndex ?? ''
  ].join(':')

const formatResolvedGeometryCacheNumber = (value: number) =>
  Number.isFinite(value) ? value.toFixed(6) : 'nan'

const getPathTranslationCacheOrigin = (
  path: Pick<PathGeometry, 'segments'>
): Vec2 | null => path.segments[0]?.start ?? null

const buildTranslationInvariantPointKey = (point: Vec2, origin: Vec2) =>
  `${formatResolvedGeometryCacheNumber(
    point.x - origin.x
  )},${formatResolvedGeometryCacheNumber(point.y - origin.y)}`

const buildTranslationInvariantPathSegmentKey = (
  segment: PathSegment,
  index: number,
  origin: Vec2
) =>
  segment.type === 'line'
    ? [
        index,
        'line',
        buildTranslationInvariantPointKey(segment.start, origin),
        buildTranslationInvariantPointKey(segment.end, origin),
        formatResolvedGeometryCacheNumber(segment.length),
        segment.startAnchorType ?? 'none',
        segment.endAnchorType ?? 'none'
      ].join(':')
    : [
        index,
        'cubic',
        buildTranslationInvariantPointKey(segment.start, origin),
        buildTranslationInvariantPointKey(segment.control1, origin),
        buildTranslationInvariantPointKey(segment.control2, origin),
        buildTranslationInvariantPointKey(segment.end, origin),
        formatResolvedGeometryCacheNumber(segment.length),
        segment.startAnchorType ?? 'none',
        segment.endAnchorType ?? 'none'
      ].join(':')

const buildTranslationInvariantPathCacheKey = (
  path: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  origin: Vec2
) =>
  [
    path.closed ? 'closed' : 'open',
    formatResolvedGeometryCacheNumber(path.totalLength),
    ...path.segments.map((segment, index) =>
      buildTranslationInvariantPathSegmentKey(segment, index, origin)
    )
  ].join('|')

const getPolygonRegionBounds = (regions: PolygonRegion[]) => {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const region of regions) {
    for (const polygon of region.polygons) {
      for (const point of polygon) {
        if (point.x < minX) {
          minX = point.x
        }
        if (point.y < minY) {
          minY = point.y
        }
        if (point.x > maxX) {
          maxX = point.x
        }
        if (point.y > maxY) {
          maxY = point.y
        }
      }
    }
  }

  return {
    minX: Number.isFinite(minX) ? minX : 0,
    minY: Number.isFinite(minY) ? minY : 0,
    maxX: Number.isFinite(maxX) ? maxX : 0,
    maxY: Number.isFinite(maxY) ? maxY : 0
  }
}

const getPolygonRegionAbsoluteArea = (regions: PolygonRegion[]) =>
  regions.reduce(
    (total, region) =>
      total +
      region.polygons.reduce(
        (regionTotal, polygon) =>
          regionTotal + Math.abs(getPolylineArea(polygon)),
        0
      ),
    0
  )

const buildTranslationInvariantPolygonRegionSignature = (
  regions: PolygonRegion[],
  origin: Vec2
) => {
  const bounds = getPolygonRegionBounds(regions)
  return [
    regions.length,
    regions.reduce((total, region) => total + region.polygons.length, 0),
    formatResolvedGeometryCacheNumber(getPolygonRegionAbsoluteArea(regions)),
    formatResolvedGeometryCacheNumber(bounds.minX - origin.x),
    formatResolvedGeometryCacheNumber(bounds.minY - origin.y),
    formatResolvedGeometryCacheNumber(bounds.maxX - origin.x),
    formatResolvedGeometryCacheNumber(bounds.maxY - origin.y)
  ].join(':')
}

const sourceSplitRangeCache = new Map<
  string,
  ResolvedVectorSourceSplitRange[]
>()

const translateSourceSplitRangeBoundaryPoints = (
  range: ResolvedVectorSourceSplitRange,
  dx: number,
  dy: number
): ResolvedVectorSourceSplitRange => ({
  ...range,
  boundaryPoints: range.boundaryPoints.map((point) => ({
    x: point.x + dx,
    y: point.y + dy
  }))
})

const toRelativeSourceSplitRanges = (
  ranges: ResolvedVectorSourceSplitRange[],
  origin: Vec2
) =>
  ranges.map((range) =>
    translateSourceSplitRangeBoundaryPoints(range, -origin.x, -origin.y)
  )

const fromRelativeSourceSplitRanges = (
  ranges: ResolvedVectorSourceSplitRange[],
  origin: Vec2
) =>
  ranges.map((range) =>
    translateSourceSplitRangeBoundaryPoints(range, origin.x, origin.y)
  )

const buildSourceSplitRangeCacheKey = (
  cacheScopeId: string,
  path: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>,
  origin: Vec2,
  topology: Pick<PathTopologyModel, 'pathId' | 'sourceId' | 'networkId'>,
  fillRule: PathTopologyModel['fillRule'],
  legalFaceBoundaries: EvenOddLegalFaceBoundary[],
  legalBoundaryContours: EvenOddBoundaryContour[],
  fillRegions: PolygonRegion[]
) =>
  [
    cacheScopeId,
    topology.pathId,
    topology.sourceId,
    topology.networkId,
    fillRule,
    buildTranslationInvariantPathCacheKey(path, origin),
    legalFaceBoundaries.length,
    legalBoundaryContours.length,
    buildTranslationInvariantPolygonRegionSignature(fillRegions, origin)
  ].join('|')

const getCachedSourceSplitRanges = (cacheKey: string, origin: Vec2) => {
  const cached = sourceSplitRangeCache.get(cacheKey)
  if (!cached) {
    emitStrokePipelineCounter('resolved-source-split-range-cache-miss')
    return null
  }

  emitStrokePipelineCounter('resolved-source-split-range-cache-hit')
  return fromRelativeSourceSplitRanges(cached, origin)
}

const setCachedSourceSplitRanges = (
  cacheKey: string,
  origin: Vec2,
  ranges: ResolvedVectorSourceSplitRange[]
) => {
  sourceSplitRangeCache.set(
    cacheKey,
    toRelativeSourceSplitRanges(ranges, origin)
  )
  if (sourceSplitRangeCache.size > SOURCE_SPLIT_RANGE_CACHE_LIMIT) {
    const [oldestKey] = sourceSplitRangeCache.keys()
    if (oldestKey) {
      sourceSplitRangeCache.delete(oldestKey)
    }
  }
}

const areTraceSignaturesEqual = (left: string[], right: string[]) =>
  left.length === right.length &&
  left.every((signature, index) => signature === right[index])

const getPathSegmentTraceCacheKey = (
  segment: PathSegment,
  segmentIndex: number,
  path: Pick<PathGeometry, 'traceSampleTolerance' | 'traceSampleOptions'>
) => {
  const samplingKey = [
    path.traceSampleTolerance ?? '',
    path.traceSampleOptions?.minCubicSamples ?? '',
    path.traceSampleOptions?.maxCubicSamples ?? '',
    path.traceSampleOptions?.useRangeLengthForSampleCount ?? ''
  ].join(':')
  const relativePointKey = (point: Vec2) =>
    [
      formatResolvedGeometryCacheNumber(point.x - segment.start.x),
      formatResolvedGeometryCacheNumber(point.y - segment.start.y)
    ].join(',')
  const geometryKey =
    segment.type === 'line'
      ? [
          segmentIndex,
          segment.type,
          relativePointKey(segment.end),
          formatResolvedGeometryCacheNumber(segment.length),
          segment.startAnchorType ?? '',
          segment.endAnchorType ?? ''
        ].join(':')
      : [
          segmentIndex,
          segment.type,
          relativePointKey(segment.control1),
          relativePointKey(segment.control2),
          relativePointKey(segment.end),
          formatResolvedGeometryCacheNumber(segment.length),
          segment.startAnchorType ?? '',
          segment.endAnchorType ?? ''
        ].join(':')

  return [geometryKey, samplingKey].join('|trace:')
}

const emitStrokePipelineCounter = (counterName: string, value = 1) => {
  ;(
    globalThis as typeof globalThis & {
      __asyraStrokePipelineCounterSink?: (
        counterName: string,
        value: number
      ) => void
    }
  ).__asyraStrokePipelineCounterSink?.(counterName, value)
}

const measureResolvedVectorGeometryPhase = <T>(
  phaseName: string,
  run: () => T
): T => {
  const sink = (
    globalThis as typeof globalThis & {
      __asyraVectorRenderDetailPhaseSink?: (
        phaseName: string,
        durationMs: number
      ) => void
    }
  ).__asyraVectorRenderDetailPhaseSink
  if (!sink) {
    return run()
  }

  const start = performance.now()
  try {
    return run()
  } finally {
    sink(phaseName, performance.now() - start)
  }
}

const isPointInPolygonEvenOdd = (point: Vec2, polygon: Vec2[]) => {
  let inside = false
  for (
    let index = 0, previousIndex = polygon.length - 1;
    index < polygon.length;
    previousIndex = index, index += 1
  ) {
    const current = polygon[index]
    const previous = polygon[previousIndex]
    const crosses =
      current.y > point.y !== previous.y > point.y &&
      point.x <
        ((previous.x - current.x) * (point.y - current.y)) /
          (previous.y - current.y) +
          current.x
    if (crosses) {
      inside = !inside
    }
  }
  return inside
}

const isPointInFillRegions = (point: Vec2, regions: PolygonRegion[]) =>
  regions.some((region) =>
    region.polygons.some((polygon) => isPointInPolygonEvenOdd(point, polygon))
  )

interface PolygonBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

interface PreparedFillPolygon {
  polygon: Vec2[]
  bounds: PolygonBounds
}

const getPolygonBounds = (polygon: Vec2[]): PolygonBounds => {
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

const FILL_SIDE_SAMPLE_OFFSETS = [1e-3, 0.01, 0.05, 0.1, 0.35, 0.75, 1, 1.5, 2]

const buildPreparedFillPolygons = (
  regions: PolygonRegion[]
): PreparedFillPolygon[] => {
  const prepared: PreparedFillPolygon[] = []
  for (const region of regions) {
    for (const polygon of region.polygons) {
      prepared.push({
        polygon,
        bounds: getPolygonBounds(polygon)
      })
    }
  }
  return prepared
}

const boundsContainPoint = (bounds: PolygonBounds, point: Vec2) =>
  point.x >= bounds.minX - EPSILON &&
  point.x <= bounds.maxX + EPSILON &&
  point.y >= bounds.minY - EPSILON &&
  point.y <= bounds.maxY + EPSILON

const isPointInPreparedFillPolygons = (
  point: Vec2,
  preparedPolygons: PreparedFillPolygon[]
) =>
  preparedPolygons.some(
    ({ polygon, bounds }) =>
      boundsContainPoint(bounds, point) &&
      isPointInPolygonEvenOdd(point, polygon)
  )

const isPointInResolvedFill = (
  point: Vec2,
  fillRegions: PolygonRegion[],
  preparedFillPolygons: PreparedFillPolygon[] | undefined
) =>
  preparedFillPolygons
    ? isPointInPreparedFillPolygons(point, preparedFillPolygons)
    : isPointInFillRegions(point, fillRegions)

const resolveFilledSideFromFrame = (
  frame: { point: Vec2; tangent: Vec2 },
  fillRegions: PolygonRegion[],
  preparedFillPolygons: PreparedFillPolygon[] | undefined
) => {
  let leftVotes = 0
  let rightVotes = 0
  const probePoint = { x: 0, y: 0 }

  for (const offset of FILL_SIDE_SAMPLE_OFFSETS) {
    const offsetX = frame.tangent.y * offset
    const offsetY = frame.tangent.x * offset
    probePoint.x = frame.point.x - offsetX
    probePoint.y = frame.point.y + offsetY
    const leftFilled = isPointInResolvedFill(
      probePoint,
      fillRegions,
      preparedFillPolygons
    )
    probePoint.x = frame.point.x + offsetX
    probePoint.y = frame.point.y - offsetY
    const rightFilled = isPointInResolvedFill(
      probePoint,
      fillRegions,
      preparedFillPolygons
    )
    if (leftFilled === rightFilled) {
      continue
    }
    if (leftFilled) {
      leftVotes += 1
    } else {
      rightVotes += 1
    }
  }

  if (leftVotes > rightVotes) {
    return 1 as const
  }
  if (rightVotes > leftVotes) {
    return -1 as const
  }
  return null
}

const getSegmentStartDistance = (
  path: Pick<PathGeometry, 'segments'>,
  sourceSegmentIndex: number
) =>
  path.segments
    .slice(0, sourceSegmentIndex)
    .reduce((sum, segment) => sum + segment.length, 0)

const sampleBoundaryDomainFrame = (points: Vec2[]) => {
  if (points.length < 2) {
    return null
  }

  let totalLength = 0
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1]
    const end = points[index]
    if (!start || !end) {
      continue
    }
    totalLength += distanceBetween(start, end)
  }
  if (totalLength <= EPSILON) {
    return null
  }

  let remainingDistance = totalLength / 2
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1]
    const end = points[index]
    if (!start || !end) {
      continue
    }
    const length = distanceBetween(start, end)
    if (length <= EPSILON) {
      continue
    }
    if (remainingDistance > length + EPSILON) {
      remainingDistance -= length
      continue
    }

    const t = Math.max(0, Math.min(1, remainingDistance / length))
    return {
      point: {
        x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t
      },
      tangent: {
        x: (end.x - start.x) / length,
        y: (end.y - start.y) / length
      }
    }
  }

  return null
}

const resolveFilledSideFromFillRegions = ({
  boundaryRole,
  domain,
  fillRegions,
  preparedFillPolygons,
  legalSide,
  path,
  sourceSegmentStartDistance
}: {
  boundaryRole: ResolvedVectorSourceSplitRange['boundaryRole']
  domain: EvenOddBoundaryContour['dashDomains'][number]
  fillRegions: PolygonRegion[]
  preparedFillPolygons?: PreparedFillPolygon[]
  legalSide: 1 | -1
  path: Pick<PathGeometry, 'segments'>
  sourceSegmentStartDistance?: number
}) => {
  const defaultFilledSide =
    boundaryRole === 'hole' ? (legalSide === 1 ? -1 : 1) : legalSide

  if (boundaryRole === 'filled-face') {
    return {
      filledSide: legalSide,
      status: 'resolved' as const
    }
  }

  if (
    fillRegions.length === 0 ||
    domain.sourceSegmentIndex === undefined ||
    domain.sourceStartDistance === undefined ||
    domain.sourceEndDistance === undefined
  ) {
    return {
      filledSide: defaultFilledSide,
      status: 'resolved' as const
    }
  }

  const boundaryFrame = sampleBoundaryDomainFrame(domain.points)
  if (boundaryFrame) {
    const filledSide = resolveFilledSideFromFrame(
      boundaryFrame,
      fillRegions,
      preparedFillPolygons
    )

    if (filledSide === 1) {
      return {
        filledSide: 1 as const,
        status: 'resolved' as const
      }
    }
    if (filledSide === -1) {
      return {
        filledSide: -1 as const,
        status: 'resolved' as const
      }
    }
  }

  const segment = path.segments[domain.sourceSegmentIndex]
  if (!segment) {
    return {
      filledSide: legalSide,
      status: 'conflict' as const
    }
  }

  const segmentStartDistance =
    sourceSegmentStartDistance ??
    getSegmentStartDistance(path, domain.sourceSegmentIndex)
  const localMidDistance =
    (Math.min(domain.sourceStartDistance, domain.sourceEndDistance) +
      Math.max(domain.sourceStartDistance, domain.sourceEndDistance)) /
      2 -
    segmentStartDistance
  const frame = samplePathSegmentFrameAtLength(segment, localMidDistance)
  const filledSide = resolveFilledSideFromFrame(
    frame,
    fillRegions,
    preparedFillPolygons
  )

  if (filledSide === 1) {
    return {
      filledSide: 1 as const,
      status: 'resolved' as const
    }
  }
  if (filledSide === -1) {
    return {
      filledSide: -1 as const,
      status: 'resolved' as const
    }
  }

  return {
    filledSide: defaultFilledSide,
    status: 'resolved' as const
  }
}

const getSourcePathSegmentDistanceRanges = (
  path: Pick<PathGeometry, 'segments'> &
    Partial<Pick<PathGeometry, 'segmentDistanceRanges'>>
) => {
  if (path.segmentDistanceRanges?.length === path.segments.length) {
    return path.segmentDistanceRanges
  }

  let cursor = 0
  return path.segments.map((segment, index) => {
    const range = {
      index,
      startDistance: cursor,
      endDistance: cursor + segment.length
    }
    cursor = range.endDistance
    return range
  })
}

const buildClosedTopologyPointTracedSegments = (
  points: Vec2[]
): TracedLineSegment[] => {
  if (points.length < 3) {
    return []
  }

  let cursor = 0
  const tracedSegments: TracedLineSegment[] = []
  points.forEach((start, index) => {
    const end = points[(index + 1) % points.length]
    const length = distanceBetween(start, end)
    if (length <= EPSILON) {
      return
    }

    const sourceStartDistance = cursor
    cursor += length

    tracedSegments.push({
      sourceSegmentIndex: index,
      sourceStartDistance,
      sourceEndDistance: cursor,
      start,
      end
    })
  })
  return tracedSegments
}

const getPolylineArea = (points: Vec2[]) => {
  let area = 0
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]
    const next = points[(index + 1) % points.length]
    area += current.x * next.y - next.x * current.y
  }
  return area / 2
}

const buildSourceBoundaryContourFromTracedSegments = (
  segments: TracedLineSegment[]
): EvenOddBoundaryContour[] => {
  if (segments.length < 3) {
    return []
  }

  const contourId = 'source-boundary:0'
  const points = [
    ...segments.map((segment) => segment.start),
    segments[segments.length - 1].end
  ]
  const totalLength = segments.reduce(
    (sum, segment) => sum + distanceBetween(segment.start, segment.end),
    0
  )
  if (totalLength <= EPSILON) {
    return []
  }

  const edges = segments.map((segment, index) => ({
    edgeId: `${contourId}:edge:${index}`,
    contourId,
    legalFaceId: `${contourId}:face`,
    oppositeFaceId: `${contourId}:outside`,
    start: segment.start,
    end: segment.end,
    sourceSegmentIndex: segment.sourceSegmentIndex,
    sourceStartDistance: segment.sourceStartDistance,
    sourceEndDistance: segment.sourceEndDistance,
    reversed: false,
    legalSide: 'left' as const
  }))

  return [
    {
      contourId,
      points,
      edges,
      dashDomains: [
        {
          domainId: `${contourId}:domain:0`,
          contourId,
          edges,
          points,
          legalSide: 'left',
          sourceStartDistance: 0,
          sourceEndDistance: totalLength,
          reversed: false,
          startBreakKind: 'contour-seam',
          endBreakKind: 'contour-seam',
          totalLength
        }
      ],
      legalSide: 'left',
      legalFaceIds: [`${contourId}:face`],
      oppositeFaceId: `${contourId}:outside`,
      area: getPolylineArea(points)
    }
  ]
}

const areSamePoint = (left: Vec2, right: Vec2) =>
  distanceBetween(left, right) <= 1e-4

const areSourceDistancesContinuous = (
  previous: EvenOddLegalFaceBoundaryEdge,
  next: EvenOddLegalFaceBoundaryEdge
) =>
  previous.sourceEndDistance !== undefined &&
  next.sourceStartDistance !== undefined &&
  Math.abs(previous.sourceEndDistance - next.sourceStartDistance) <= 1e-4

const canMergeLegalFaceBoundaryEdges = (
  previous: EvenOddLegalFaceBoundaryEdge,
  next: EvenOddLegalFaceBoundaryEdge,
  previousBoundaryRole: ResolvedVectorSourceSplitRange['boundaryRole'],
  nextBoundaryRole: ResolvedVectorSourceSplitRange['boundaryRole']
) =>
  previous.sourceSegmentIndex !== undefined &&
  previous.sourceSegmentIndex === next.sourceSegmentIndex &&
  previous.legalSide === next.legalSide &&
  previousBoundaryRole === nextBoundaryRole &&
  previous.endNodeDegree <= 2 &&
  next.startNodeDegree <= 2 &&
  areSamePoint(previous.end, next.start) &&
  areSourceDistancesContinuous(previous, next)

const getMergedBoundaryPoints = (edges: EvenOddLegalFaceBoundaryEdge[]) => {
  const firstEdge = edges[0]
  if (!firstEdge) {
    return []
  }

  const points: Vec2[] = [firstEdge.start]
  let previousPoint = firstEdge.start
  for (const edge of edges) {
    if (!areSamePoint(previousPoint, edge.end)) {
      points.push(edge.end)
      previousPoint = edge.end
    }
  }
  return points
}

const getMergedBoundaryLength = (points: Vec2[]) => {
  let sum = 0
  let previous = points[0]
  if (!previous) {
    return sum
  }
  for (let index = 1; index < points.length; index += 1) {
    const point = points[index]
    sum += distanceBetween(previous, point)
    previous = point
  }
  return sum
}

const formatBoundaryDomainSignaturePoint = (point: Vec2 | undefined) =>
  point ? `${point.x.toFixed(4)},${point.y.toFixed(4)}` : 'none'

const getBoundaryDomainPointSignature = (points: Vec2[]) => {
  const first = points[0]
  const middle = points[Math.floor(points.length / 2)]
  const last = points[points.length - 1]
  return `${formatBoundaryDomainSignaturePoint(first)}|${formatBoundaryDomainSignaturePoint(middle)}|${formatBoundaryDomainSignaturePoint(last)}`
}

const pushUniqueString = (items: string[], value: string) => {
  if (!items.includes(value)) {
    items.push(value)
  }
}

const getUniqueEdgeValues = (
  edges: EvenOddBoundaryContour['dashDomains'][number]['edges'],
  getValue: (
    edge: EvenOddBoundaryContour['dashDomains'][number]['edges'][number]
  ) => string
) => {
  const values: string[] = []
  for (const edge of edges) {
    pushUniqueString(values, getValue(edge))
  }
  return values
}

const appendUniqueEdgeValues = (
  target: string[],
  edges: EvenOddBoundaryContour['dashDomains'][number]['edges'],
  getValue: (
    edge: EvenOddBoundaryContour['dashDomains'][number]['edges'][number]
  ) => string
) => {
  for (const edge of edges) {
    pushUniqueString(target, getValue(edge))
  }
}

const buildResolvedVectorSourceSplitRanges = (
  legalFaceBoundaries: EvenOddLegalFaceBoundary[],
  legalBoundaryContours: EvenOddBoundaryContour[],
  fillRegions: PolygonRegion[],
  path: Pick<PathGeometry, 'segments'>
): ResolvedVectorSourceSplitRange[] => {
  const rangeByKey = new Map<string, ResolvedVectorSourceSplitRange>()
  let preparedFillPolygons: PreparedFillPolygon[] | undefined
  const getPreparedFillPolygons = () => {
    preparedFillPolygons ??= buildPreparedFillPolygons(fillRegions)
    return preparedFillPolygons
  }
  const sourceSegmentStartDistances = measureResolvedVectorGeometryPhase(
    'resolved self-intersecting geometry: source split range setup',
    () => {
      const startDistances: number[] = []
      let sourceCursor = 0
      path.segments.forEach((segment, segmentIndex) => {
        startDistances[segmentIndex] = sourceCursor
        sourceCursor += segment.length
      })
      return startDistances
    }
  )
  const getCachedSourceSegmentStartDistance = (segmentIndex: number) => {
    return sourceSegmentStartDistances[segmentIndex] ?? 0
  }
  const resolvedFilledSideByDomainKey = new Map<
    string,
    ReturnType<typeof resolveFilledSideFromFillRegions>
  >()
  const getResolvedFilledSide = ({
    boundaryRole,
    domain,
    legalSide,
    sourceSegmentStartDistance
  }: {
    boundaryRole: ResolvedVectorSourceSplitRange['boundaryRole']
    domain: EvenOddBoundaryContour['dashDomains'][number]
    legalSide: 1 | -1
    sourceSegmentStartDistance?: number
  }) => {
    if (boundaryRole === 'filled-face') {
      return {
        filledSide: legalSide,
        status: 'resolved' as const
      }
    }

    const sourceSegmentIndex = domain.sourceSegmentIndex ?? -1
    const sourceStartDistance =
      domain.sourceStartDistance === undefined
        ? 'none'
        : domain.sourceStartDistance.toFixed(6)
    const sourceEndDistance =
      domain.sourceEndDistance === undefined
        ? 'none'
        : domain.sourceEndDistance.toFixed(6)
    const key = [
      boundaryRole,
      legalSide,
      sourceSegmentIndex,
      sourceStartDistance,
      sourceEndDistance,
      domain.legalSide ?? 'none',
      domain.points.length,
      getBoundaryDomainPointSignature(domain.points)
    ].join(':')
    const cached = resolvedFilledSideByDomainKey.get(key)
    if (cached) {
      return cached
    }
    const resolvedSide = resolveFilledSideFromFillRegions({
      boundaryRole,
      domain,
      fillRegions,
      preparedFillPolygons: getPreparedFillPolygons(),
      legalSide,
      path,
      sourceSegmentStartDistance
    })
    resolvedFilledSideByDomainKey.set(key, resolvedSide)
    return resolvedSide
  }
  const getBoundaryRole = (
    contour: EvenOddBoundaryContour
  ): ResolvedVectorSourceSplitRange['boundaryRole'] => {
    if (contour.area > EPSILON) {
      return 'hole'
    }
    if (contour.area < -EPSILON) {
      return 'outer'
    }
    return 'ambiguous'
  }
  const edgeKey = (start: Vec2, end: Vec2) =>
    [
      start.x.toFixed(4),
      start.y.toFixed(4),
      end.x.toFixed(4),
      end.y.toFixed(4)
    ].join(':')
  let contourRoleByEdgeKey:
    | Map<string, ResolvedVectorSourceSplitRange['boundaryRole']>
    | undefined
  const contourRoleByOppositeFaceId = measureResolvedVectorGeometryPhase(
    'resolved self-intersecting geometry: source split range boundary role index',
    () => {
      const roleByOppositeFaceId = new Map<
        string,
        ResolvedVectorSourceSplitRange['boundaryRole'] | 'mixed'
      >()
      legalBoundaryContours.forEach((contour) => {
        const role = getBoundaryRole(contour)
        const existing = roleByOppositeFaceId.get(contour.oppositeFaceId)
        roleByOppositeFaceId.set(
          contour.oppositeFaceId,
          existing === undefined || existing === role ? role : 'mixed'
        )
      })
      return roleByOppositeFaceId
    }
  )
  const getContourRoleByEdgeKey = (
    edge: EvenOddLegalFaceBoundaryEdge
  ): ResolvedVectorSourceSplitRange['boundaryRole'] | undefined => {
    contourRoleByEdgeKey ??= (() => {
      const roleByEdgeKey = new Map<
        string,
        ResolvedVectorSourceSplitRange['boundaryRole']
      >()
      legalBoundaryContours.forEach((contour) => {
        const role = getBoundaryRole(contour)
        contour.edges.forEach((contourEdge) => {
          roleByEdgeKey.set(edgeKey(contourEdge.start, contourEdge.end), role)
          roleByEdgeKey.set(edgeKey(contourEdge.end, contourEdge.start), role)
        })
      })
      return roleByEdgeKey
    })()
    return contourRoleByEdgeKey.get(edgeKey(edge.start, edge.end))
  }

  measureResolvedVectorGeometryPhase(
    'resolved self-intersecting geometry: source split range legal face materialization',
    () => {
      legalFaceBoundaries.forEach((face) => {
        const getFaceEdgeBoundaryRole = (
          edge: EvenOddLegalFaceBoundaryEdge
        ): ResolvedVectorSourceSplitRange['boundaryRole'] =>
          edge.oppositeFaceLegal
            ? 'filled-face'
            : edge.oppositeFaceId === null
              ? 'ambiguous'
              : (() => {
                  const role = contourRoleByOppositeFaceId.get(
                    edge.oppositeFaceId
                  )
                  return role && role !== 'mixed'
                    ? role
                    : (getContourRoleByEdgeKey(edge) ?? 'ambiguous')
                })()

        const faceUsesImplicitClosingEdge = face.edges.some(
          (edge) => edge.isImplicitClosingEdge === true
        )
        const edgeRecords: {
          edge: EvenOddLegalFaceBoundaryEdge
          boundaryRole: ResolvedVectorSourceSplitRange['boundaryRole']
        }[] = []
        face.edges.forEach((edge) => {
          if (
            edge.sourceSegmentIndex === undefined ||
            edge.sourceStartDistance === undefined ||
            edge.sourceEndDistance === undefined
          ) {
            return
          }
          const sourceStartDistance = Math.min(
            edge.sourceStartDistance,
            edge.sourceEndDistance
          )
          const sourceEndDistance = Math.max(
            edge.sourceStartDistance,
            edge.sourceEndDistance
          )
          if (
            sourceEndDistance - sourceStartDistance <= EPSILON ||
            distanceBetween(edge.start, edge.end) <= EPSILON
          ) {
            return
          }
          edgeRecords.push({
            edge,
            boundaryRole: getFaceEdgeBoundaryRole(edge)
          })
        })

        const chains: {
          edges: EvenOddLegalFaceBoundaryEdge[]
          boundaryRole: ResolvedVectorSourceSplitRange['boundaryRole']
        }[] = []
        edgeRecords.forEach((record) => {
          const previousChain = chains[chains.length - 1]
          const previousEdge =
            previousChain?.edges[previousChain.edges.length - 1]
          if (
            previousChain &&
            previousEdge &&
            canMergeLegalFaceBoundaryEdges(
              previousEdge,
              record.edge,
              previousChain.boundaryRole,
              record.boundaryRole
            )
          ) {
            previousChain.edges.push(record.edge)
            return
          }
          chains.push({
            edges: [record.edge],
            boundaryRole: record.boundaryRole
          })
        })

        if (chains.length > 1) {
          const firstChain = chains[0]
          const lastChain = chains[chains.length - 1]
          const firstEdge = firstChain.edges[0]
          const lastEdge = lastChain.edges[lastChain.edges.length - 1]
          if (
            firstEdge &&
            lastEdge &&
            canMergeLegalFaceBoundaryEdges(
              lastEdge,
              firstEdge,
              lastChain.boundaryRole,
              firstChain.boundaryRole
            )
          ) {
            firstChain.edges = [...lastChain.edges, ...firstChain.edges]
            chains.pop()
          }
        }

        chains.forEach((chain) => {
          const firstEdge = chain.edges[0]
          const lastEdge = chain.edges[chain.edges.length - 1]
          if (
            !firstEdge ||
            !lastEdge ||
            firstEdge.sourceSegmentIndex === undefined
          ) {
            return
          }

          let sourceStartDistance = Infinity
          let sourceEndDistance = -Infinity
          const oppositeFaceIds: string[] = []
          const edgeIds: string[] = []
          chain.edges.forEach((edge) => {
            if (
              edge.sourceStartDistance !== undefined &&
              edge.sourceEndDistance !== undefined
            ) {
              sourceStartDistance = Math.min(
                sourceStartDistance,
                edge.sourceStartDistance,
                edge.sourceEndDistance
              )
              sourceEndDistance = Math.max(
                sourceEndDistance,
                edge.sourceStartDistance,
                edge.sourceEndDistance
              )
            }
            if (edge.oppositeFaceId) {
              pushUniqueString(oppositeFaceIds, edge.oppositeFaceId)
            }
            edgeIds.push(edge.edgeId)
          })
          if (
            !Number.isFinite(sourceStartDistance) ||
            !Number.isFinite(sourceEndDistance) ||
            sourceEndDistance - sourceStartDistance <= EPSILON
          ) {
            return
          }

          const boundaryPoints = getMergedBoundaryPoints(chain.edges)
          const boundaryLength = getMergedBoundaryLength(boundaryPoints)
          if (boundaryLength <= EPSILON) {
            return
          }

          const legalSide = firstEdge.legalSide === 'left' ? 1 : -1
          const key = [
            face.faceId,
            edgeIds.join('+'),
            firstEdge.sourceSegmentIndex,
            sourceStartDistance.toFixed(6),
            sourceEndDistance.toFixed(6),
            legalSide
          ].join(':')
          const resolvedSide = getResolvedFilledSide({
            boundaryRole: chain.boundaryRole,
            domain: {
              points: boundaryPoints,
              sourceSegmentIndex: firstEdge.sourceSegmentIndex,
              sourceStartDistance,
              sourceEndDistance,
              legalSide: firstEdge.legalSide
            } as EvenOddBoundaryContour['dashDomains'][number],
            legalSide,
            sourceSegmentStartDistance: getCachedSourceSegmentStartDistance(
              firstEdge.sourceSegmentIndex
            )
          })
          const filledSide = resolvedSide.filledSide

          rangeByKey.set(key, {
            rangeId: `source-split-range:${rangeByKey.size}`,
            boundaryDomainSourceId: `${face.faceId}:boundary-domain:${edgeIds.join('+')}`,
            boundaryPoints,
            boundaryStartDistance: 0,
            boundaryEndDistance: boundaryLength,
            boundaryTotalLength: boundaryLength,
            sourceSegmentIndex: firstEdge.sourceSegmentIndex,
            sourceStartDistance,
            sourceEndDistance,
            legalSide,
            filledSide,
            unfilledSide: filledSide === 1 ? -1 : 1,
            boundaryRole: chain.boundaryRole,
            sideResolutionStatus:
              chain.boundaryRole === 'ambiguous'
                ? 'conflict'
                : resolvedSide.status,
            contourIds: [face.faceId],
            legalFaceIds: [face.faceId],
            oppositeFaceIds,
            edgeIds,
            usesImplicitClosingEdge: faceUsesImplicitClosingEdge
          })
        })
      })
    }
  )

  measureResolvedVectorGeometryPhase(
    'resolved self-intersecting geometry: source split range contour merge',
    () => {
      if (legalBoundaryContours.length > 0) {
        legalBoundaryContours.forEach((contour) => {
          contour.dashDomains.forEach((domain) => {
            if (
              domain.sourceSegmentIndex === undefined ||
              domain.sourceStartDistance === undefined ||
              domain.sourceEndDistance === undefined
            ) {
              return
            }

            const sourceStartDistance = Math.min(
              domain.sourceStartDistance,
              domain.sourceEndDistance
            )
            const sourceEndDistance = Math.max(
              domain.sourceStartDistance,
              domain.sourceEndDistance
            )
            if (sourceEndDistance - sourceStartDistance <= EPSILON) {
              return
            }

            const edgeDirectionLegalSide = domain.legalSide === 'left' ? 1 : -1
            const legalSide =
              domain.sourceEndDistance < domain.sourceStartDistance
                ? edgeDirectionLegalSide === 1
                  ? -1
                  : 1
                : edgeDirectionLegalSide
            const boundaryRole = getBoundaryRole(contour)
            const key = [
              domain.sourceSegmentIndex,
              sourceStartDistance.toFixed(6),
              sourceEndDistance.toFixed(6),
              legalSide
            ].join(':')
            const existing = rangeByKey.get(key)

            if (existing) {
              pushUniqueString(existing.contourIds, contour.contourId)
              appendUniqueEdgeValues(
                existing.legalFaceIds,
                domain.edges,
                (edge) => edge.legalFaceId
              )
              appendUniqueEdgeValues(
                existing.oppositeFaceIds,
                domain.edges,
                (edge) => edge.oppositeFaceId
              )
              appendUniqueEdgeValues(
                existing.edgeIds,
                domain.edges,
                (edge) => edge.edgeId
              )
              if (existing.legalSide !== legalSide) {
                existing.sideResolutionStatus = 'conflict'
              }
              if (existing.boundaryRole !== boundaryRole) {
                existing.boundaryRole = 'ambiguous'
                existing.sideResolutionStatus = 'conflict'
              }
              existing.usesImplicitClosingEdge =
                existing.usesImplicitClosingEdge === true ||
                domain.edges.some((edge) => edge.isImplicitClosingEdge === true)
              return
            }

            const resolvedSide = getResolvedFilledSide({
              boundaryRole,
              domain,
              legalSide,
              sourceSegmentStartDistance: getCachedSourceSegmentStartDistance(
                domain.sourceSegmentIndex
              )
            })
            const filledSide = resolvedSide.filledSide

            rangeByKey.set(key, {
              rangeId: `source-split-range:${rangeByKey.size}`,
              boundaryDomainSourceId: domain.domainId,
              boundaryPoints: domain.points,
              boundaryStartDistance: 0,
              boundaryEndDistance: domain.totalLength,
              boundaryTotalLength: domain.totalLength,
              sourceSegmentIndex: domain.sourceSegmentIndex,
              sourceStartDistance,
              sourceEndDistance,
              legalSide,
              filledSide,
              unfilledSide: filledSide === 1 ? -1 : 1,
              boundaryRole,
              sideResolutionStatus: resolvedSide.status,
              contourIds: [contour.contourId],
              legalFaceIds: getUniqueEdgeValues(
                domain.edges,
                (edge) => edge.legalFaceId
              ),
              oppositeFaceIds: getUniqueEdgeValues(
                domain.edges,
                (edge) => edge.oppositeFaceId
              ),
              edgeIds: getUniqueEdgeValues(domain.edges, (edge) => edge.edgeId),
              usesImplicitClosingEdge: domain.edges.some(
                (edge) => edge.isImplicitClosingEdge === true
              )
            })
          })
        })
      }
    }
  )

  return measureResolvedVectorGeometryPhase(
    'resolved self-intersecting geometry: source split range finalize',
    () =>
      Array.from(rangeByKey.values())
        .sort((left, right) => {
          if (left.sourceSegmentIndex !== right.sourceSegmentIndex) {
            return left.sourceSegmentIndex - right.sourceSegmentIndex
          }
          if (
            Math.abs(left.sourceStartDistance - right.sourceStartDistance) >
            EPSILON
          ) {
            return left.sourceStartDistance - right.sourceStartDistance
          }
          return left.sourceEndDistance - right.sourceEndDistance
        })
        .map((range, index) => ({
          ...range,
          rangeId: `split-range:${index}`
        }))
  )
}

export const buildResolvedVectorStrokeBoundaryDomains = (
  sourceSplitRanges: ResolvedVectorSourceSplitRange[]
): ResolvedVectorStrokeBoundaryDomain[] =>
  sourceSplitRanges.map((range) => {
    const outsideEligible = range.boundaryRole === 'outer'
    return {
      ...range,
      boundaryDomainId: range.boundaryDomainSourceId,
      insideEligible: true,
      outsideEligible,
      insideSelectedSide: range.filledSide,
      outsideSelectedSide: outsideEligible ? range.unfilledSide : null,
      adjacentFilledFaceIds: range.legalFaceIds,
      adjacentUnfilledFaceIds: range.oppositeFaceIds
    }
  })

export const buildResolvedVectorSourcePathTracedSegments = (
  path: Pick<
    PathGeometry,
    | 'segments'
    | 'closed'
    | 'totalLength'
    | 'segmentDistanceRanges'
    | 'sampledSegmentPoints'
    | 'sampledSegmentDistances'
    | 'traceSampleTolerance'
    | 'traceSampleOptions'
  >
): TracedLineSegment[] =>
  buildResolvedVectorSourcePathTraceFrame(path).tracedSegments

const buildResolvedVectorSourcePathTraceFrame = (
  path: Pick<
    PathGeometry,
    | 'segments'
    | 'closed'
    | 'totalLength'
    | 'segmentDistanceRanges'
    | 'sampledSegmentPoints'
    | 'sampledSegmentDistances'
    | 'traceSampleTolerance'
    | 'traceSampleOptions'
  >,
  previousCache?: ResolvedVectorPathSegmentTraceFrameCache
): {
  tracedSegments: TracedLineSegment[]
  cache: ResolvedVectorPathSegmentTraceFrameCache
  reusedPathSegmentCount: number
  rebuiltPathSegmentCount: number
  translationDelta: Vec2 | null
} => {
  const segmentRanges = getSourcePathSegmentDistanceRanges(path)
  const tracedSegments: TracedLineSegment[] = []
  const cache: ResolvedVectorPathSegmentTraceFrameCache = {
    entries: new Map()
  }
  let reusedPathSegmentCount = 0
  let rebuiltPathSegmentCount = 0
  const translationDeltaCounts = new Map<
    string,
    { delta: Vec2; count: number }
  >()
  for (
    let segmentIndex = 0;
    segmentIndex < path.segments.length;
    segmentIndex += 1
  ) {
    const segment = path.segments[segmentIndex]
    const segmentRange = segmentRanges[segmentIndex]
    if (!segmentRange || segment.length <= EPSILON) {
      continue
    }

    const cacheKey = getPathSegmentTraceCacheKey(segment, segmentIndex, path)
    const cached = previousCache?.entries.get(cacheKey)
    if (cached) {
      reusedPathSegmentCount += 1
      const delta = {
        x: segment.start.x - cached.origin.x,
        y: segment.start.y - cached.origin.y
      }
      const deltaKey = `${delta.x.toFixed(6)}:${delta.y.toFixed(6)}`
      const deltaCount = translationDeltaCounts.get(deltaKey)
      translationDeltaCounts.set(deltaKey, {
        delta,
        count: (deltaCount?.count ?? 0) + 1
      })
      cache.entries.set(cacheKey, {
        ...cached,
        origin: { ...segment.start }
      })
      cached.localSegments.forEach((localSegment) => {
        const currentSampledPoints = path.sampledSegmentPoints?.[segmentIndex]
        const currentStart =
          currentSampledPoints?.[localSegment.startPointIndex]
        const currentEnd =
          currentSampledPoints?.[localSegment.startPointIndex + 1]
        tracedSegments.push({
          sourceSegmentIndex: segmentIndex,
          sourceStartDistance:
            segmentRange.startDistance + localSegment.localStartDistance,
          sourceEndDistance:
            segmentRange.startDistance + localSegment.localEndDistance,
          start:
            currentStart ??
            ({
              x: localSegment.start.x + segment.start.x,
              y: localSegment.start.y + segment.start.y
            } satisfies Vec2),
          end:
            currentEnd ??
            ({
              x: localSegment.end.x + segment.start.x,
              y: localSegment.end.y + segment.start.y
            } satisfies Vec2)
        })
      })
      continue
    }

    rebuiltPathSegmentCount += 1
    const points =
      path.sampledSegmentPoints?.[segmentIndex] ??
      slicePathGeometryPoints(
        {
          segments: [segment],
          closed: false,
          totalLength: segment.length
        },
        0,
        segment.length,
        false,
        path.traceSampleTolerance,
        path.traceSampleOptions
      )
    const sampledPoints =
      points.length >= 2 ? points : [segment.start, segment.end]
    const sampledDistances = path.sampledSegmentDistances?.[segmentIndex]
    const hasSampledDistances =
      sampledDistances && sampledDistances.length === sampledPoints.length
    const sampledLength = hasSampledDistances
      ? (sampledDistances[sampledDistances.length - 1] ?? 0)
      : sampledPoints.reduce(
          (sum, point, index) =>
            index === 0
              ? sum
              : sum + distanceBetween(sampledPoints[index - 1], point),
          0
        )
    const distanceScale =
      sampledLength > EPSILON ? segment.length / sampledLength : 1

    let localStart = 0
    const localSegments: ResolvedVectorLocalTracedSegment[] = []
    for (let index = 1; index < sampledPoints.length; index += 1) {
      const point = sampledPoints[index]
      const previousPoint = sampledPoints[index - 1]
      const localEnd = hasSampledDistances
        ? (sampledDistances[index] ?? localStart)
        : localStart + distanceBetween(previousPoint, point)
      const sampledSegmentLength = localEnd - localStart
      if (sampledSegmentLength <= EPSILON) {
        localStart = localEnd
        continue
      }
      const localSourceStartDistance = localStart * distanceScale
      const localSourceEndDistance = localEnd * distanceScale
      localSegments.push({
        localStartDistance: localSourceStartDistance,
        localEndDistance: localSourceEndDistance,
        startPointIndex: index - 1,
        start: {
          x: previousPoint.x - segment.start.x,
          y: previousPoint.y - segment.start.y
        },
        end: {
          x: point.x - segment.start.x,
          y: point.y - segment.start.y
        }
      })
      tracedSegments.push({
        sourceSegmentIndex: segmentIndex,
        sourceStartDistance:
          segmentRange.startDistance + localSourceStartDistance,
        sourceEndDistance: segmentRange.startDistance + localSourceEndDistance,
        start: previousPoint,
        end: point
      })
      localStart = localEnd
    }
    cache.entries.set(cacheKey, {
      key: cacheKey,
      origin: { ...segment.start },
      localSegments
    })
  }
  const rankedTranslationDeltas = [...translationDeltaCounts.values()].sort(
    (left, right) => right.count - left.count
  )
  const strongestTranslationDelta = rankedTranslationDeltas[0]
  const competingTranslationDelta = rankedTranslationDeltas[1]
  const translationDelta =
    strongestTranslationDelta &&
    strongestTranslationDelta.count >= 2 &&
    strongestTranslationDelta.count > (competingTranslationDelta?.count ?? 0)
      ? strongestTranslationDelta.delta
      : null
  return {
    tracedSegments,
    cache,
    reusedPathSegmentCount,
    rebuiltPathSegmentCount,
    translationDelta
  }
}

const buildSelfIntersectingGeometry = (
  cacheScopeId: string,
  path: PathGeometry,
  topology: PathTopologyModel,
  previousCache?: ResolvedVectorGeometryNetworkFrameCache,
  detailMode: IncrementalResolvedGeometryOptions['detailMode'] = 'full'
): {
  geometry: ResolvedVectorSelfIntersectingGeometry | null
  cache: ResolvedVectorGeometryNetworkFrameCache
} => {
  const emptyCache: ResolvedVectorGeometryNetworkFrameCache = {
    tracedSegmentSignatures: []
  }
  if ((!path.closed && topology.isSimpleOpen) || path.segments.length < 2) {
    return { geometry: null, cache: emptyCache }
  }

  const tracedPathFrame = buildResolvedVectorSourcePathTraceFrame(
    path,
    previousCache?.tracedPathSegmentCache
  )
  const tracedSegments = tracedPathFrame.tracedSegments
  if (previousCache?.tracedPathSegmentCache) {
    emitStrokePipelineCounter(
      'resolved-geometry-source-segment-trace-cache-hit',
      tracedPathFrame.reusedPathSegmentCount
    )
    emitStrokePipelineCounter(
      'resolved-geometry-source-segment-trace-cache-miss',
      tracedPathFrame.rebuiltPathSegmentCount
    )
  }
  if (tracedSegments.length === 0) {
    return { geometry: null, cache: emptyCache }
  }
  const domainTracedSegments = tracedSegments
  const tracedSegmentSignatures = domainTracedSegments.map((segment) =>
    getTracedSegmentSignature(segment)
  )
  const previousPairCacheTranslationOffset =
    previousCache?.pairCacheTranslationOffset ?? { x: 0, y: 0 }
  const pairCacheTranslationOffset = {
    x:
      previousPairCacheTranslationOffset.x +
      (tracedPathFrame.translationDelta?.x ?? 0),
    y:
      previousPairCacheTranslationOffset.y +
      (tracedPathFrame.translationDelta?.y ?? 0)
  }
  const pairCacheSegmentSignatures = domainTracedSegments.map((segment) =>
    getTracedSegmentSignature(segment, pairCacheTranslationOffset)
  )
  if (previousCache?.tracedSegmentSignatures) {
    const dirtyTracedSegmentCount = tracedSegmentSignatures.reduce(
      (count, signature, index) =>
        previousCache.tracedSegmentSignatures[index] === signature
          ? count
          : count + 1,
      0
    )
    emitStrokePipelineCounter(
      'resolved-geometry-traced-segment-count',
      tracedSegmentSignatures.length
    )
    emitStrokePipelineCounter(
      'resolved-geometry-dirty-traced-segment-count',
      dirtyTracedSegmentCount
    )
  }
  if (
    previousCache?.geometry !== undefined &&
    previousCache.detailMode === detailMode &&
    areTraceSignaturesEqual(
      tracedSegmentSignatures,
      previousCache.tracedSegmentSignatures
    )
  ) {
    emitStrokePipelineCounter('resolved-geometry-model-cache-hit')
    return {
      geometry: previousCache.geometry,
      cache: {
        tracedSegmentSignatures,
        tracedPathSegmentCache: tracedPathFrame.cache,
        selfIntersectionCache: previousCache.selfIntersectionCache,
        pairCacheTranslationOffset,
        detailMode,
        geometry: previousCache.geometry
      }
    }
  }
  const splitResult =
    topology.topologyFamily === 'self-intersecting'
      ? null
      : splitTracedSegmentsByIntersections(domainTracedSegments, {
          previousCache: previousCache?.selfIntersectionCache,
          segmentSignatures: pairCacheSegmentSignatures,
          legalFacePolicy: path.closed ? 'fill-rule' : 'bounded-faces',
          returnCache: true
        })
  const sourceSplitSegments = splitResult?.splitSegments ?? domainTracedSegments
  const hasSourceIntersections =
    sourceSplitSegments.length > domainTracedSegments.length
  if (
    topology.topologyFamily !== 'self-intersecting' &&
    !hasSourceIntersections
  ) {
    return {
      geometry: null,
      cache: {
        tracedSegmentSignatures,
        tracedPathSegmentCache: tracedPathFrame.cache,
        selfIntersectionCache:
          splitResult?.cache ?? previousCache?.selfIntersectionCache,
        pairCacheTranslationOffset,
        detailMode,
        geometry: null
      }
    }
  }

  const resolvedGeometry = buildSelfIntersectingResolvedGeometry(
    domainTracedSegments,
    topology.fillRule,
    {
      previousCache: splitResult?.cache ?? previousCache?.selfIntersectionCache,
      segmentSignatures: pairCacheSegmentSignatures,
      legalFacePolicy: path.closed ? 'fill-rule' : 'bounded-faces',
      preSplitResult: splitResult ?? undefined
    }
  )
  const sourceBoundaryResolvedGeometry =
    path.closed && resolvedGeometry.legalBoundaryContours.length === 0
      ? buildSelfIntersectingResolvedGeometry(
          buildClosedTopologyPointTracedSegments(topology.normalizedPoints),
          topology.fillRule
        )
      : null
  const fillRegions =
    resolvedGeometry.fillRegions.length > 0
      ? resolvedGeometry.fillRegions
      : (sourceBoundaryResolvedGeometry?.fillRegions ?? [])
  const outputCache = {
    tracedSegmentSignatures,
    tracedPathSegmentCache: tracedPathFrame.cache,
    selfIntersectionCache:
      resolvedGeometry.cache ??
      splitResult?.cache ??
      previousCache?.selfIntersectionCache,
    pairCacheTranslationOffset,
    detailMode
  }
  if (detailMode === 'fill-only') {
    const fillOnlyGeometry = {
      tracedSegments,
      fillRegions,
      legalFaceBoundaries: [],
      unfilledFaceBoundaries: [],
      legalBoundaryContours: [],
      sourceSplitRanges: [],
      strokeBoundaryDomains: []
    }
    if (
      previousCache?.selfIntersectionCache &&
      outputCache.selfIntersectionCache
    ) {
      emitStrokePipelineCounter('resolved-geometry-frame-cache-reused')
    } else {
      emitStrokePipelineCounter('resolved-geometry-frame-cache-primed')
    }

    return {
      geometry: fillOnlyGeometry,
      cache: {
        ...outputCache,
        geometry: fillOnlyGeometry
      }
    }
  }

  const resolvedLegalBoundaryContours =
    resolvedGeometry.legalBoundaryContours.length > 0
      ? resolvedGeometry.legalBoundaryContours
      : (sourceBoundaryResolvedGeometry?.legalBoundaryContours ?? [])
  const legalBoundaryContours =
    resolvedLegalBoundaryContours.length > 0
      ? resolvedLegalBoundaryContours
      : path.closed
        ? buildSourceBoundaryContourFromTracedSegments(tracedSegments)
        : []

  const legalFaceBoundaries =
    resolvedGeometry.legalFaceBoundaries.length > 0
      ? resolvedGeometry.legalFaceBoundaries
      : (sourceBoundaryResolvedGeometry?.legalFaceBoundaries ?? [])
  const unfilledFaceBoundaries =
    resolvedGeometry.unfilledFaceBoundaries.length > 0
      ? resolvedGeometry.unfilledFaceBoundaries
      : (sourceBoundaryResolvedGeometry?.unfilledFaceBoundaries ?? [])

  const sourceSplitRanges = measureResolvedVectorGeometryPhase(
    'resolved self-intersecting geometry: source split ranges',
    () => {
      const { cacheKey, cacheOrigin } = measureResolvedVectorGeometryPhase(
        'resolved self-intersecting geometry: source split range cache key',
        () => {
          const nextCacheOrigin = getPathTranslationCacheOrigin(path)
          return {
            cacheOrigin: nextCacheOrigin,
            cacheKey: nextCacheOrigin
              ? buildSourceSplitRangeCacheKey(
                  cacheScopeId,
                  path,
                  nextCacheOrigin,
                  topology,
                  topology.fillRule,
                  legalFaceBoundaries,
                  legalBoundaryContours,
                  fillRegions
                )
              : null
          }
        }
      )

      return measureResolvedVectorGeometryPhase(
        'resolved self-intersecting geometry: source split range materialization',
        () => {
          if (cacheKey && cacheOrigin) {
            const cachedRanges = measureResolvedVectorGeometryPhase(
              'resolved self-intersecting geometry: source split range cache lookup',
              () => getCachedSourceSplitRanges(cacheKey, cacheOrigin)
            )
            if (cachedRanges) {
              return cachedRanges
            }
          }

          const ranges = buildResolvedVectorSourceSplitRanges(
            legalFaceBoundaries,
            legalBoundaryContours,
            fillRegions,
            path
          )
          if (cacheKey && cacheOrigin) {
            measureResolvedVectorGeometryPhase(
              'resolved self-intersecting geometry: source split range cache store',
              () => setCachedSourceSplitRanges(cacheKey, cacheOrigin, ranges)
            )
          }
          return ranges
        }
      )
    }
  )

  if (
    previousCache?.selfIntersectionCache &&
    outputCache.selfIntersectionCache
  ) {
    emitStrokePipelineCounter('resolved-geometry-frame-cache-reused')
  } else {
    emitStrokePipelineCounter('resolved-geometry-frame-cache-primed')
  }

  const fullGeometry = {
    tracedSegments,
    fillRegions,
    legalFaceBoundaries: legalFaceBoundaries,
    unfilledFaceBoundaries,
    legalBoundaryContours,
    sourceSplitRanges,
    strokeBoundaryDomains: measureResolvedVectorGeometryPhase(
      'resolved self-intersecting geometry: stroke boundary domains',
      () => buildResolvedVectorStrokeBoundaryDomains(sourceSplitRanges)
    )
  }

  return {
    geometry: fullGeometry,
    cache: {
      ...outputCache,
      geometry: fullGeometry
    }
  }
}

export const buildResolvedVectorGeometryModel = ({
  fillRule,
  modelId,
  networks,
  resolveSelfIntersecting = true,
  previousCache,
  detailMode = 'full'
}: {
  fillRule: PathTopologyModel['fillRule']
  modelId: string
  networks: ResolvedVectorGeometryNetworkInput[]
  resolveSelfIntersecting?: boolean
} & IncrementalResolvedGeometryOptions): ResolvedVectorGeometryModel => {
  const nextCache: ResolvedVectorGeometryFrameCache = { networks: new Map() }
  return {
    modelId,
    fillRule,
    networks: networks.map((network) => {
      if (!resolveSelfIntersecting) {
        return {
          ...network,
          selfIntersecting: null
        }
      }

      const result = buildSelfIntersectingGeometry(
        modelId,
        network.path,
        network.topology,
        previousCache?.networks.get(network.networkId),
        detailMode
      )
      nextCache.networks.set(network.networkId, result.cache)
      return {
        ...network,
        selfIntersecting: result.geometry
      }
    }),
    cache: nextCache
  }
}
