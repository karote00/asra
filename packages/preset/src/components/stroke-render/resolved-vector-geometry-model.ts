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
  type PathGeometry
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
  selfIntersectionCache?: SelfIntersectionPairCache
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

const distanceBetween = (a: Vec2, b: Vec2) => Math.hypot(b.x - a.x, b.y - a.y)

const getTracedSegmentSignature = (segment: TracedLineSegment) =>
  [
    segment.start.x.toFixed(4),
    segment.start.y.toFixed(4),
    segment.end.x.toFixed(4),
    segment.end.y.toFixed(4),
    segment.sourceSegmentIndex ?? ''
  ].join(':')

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
      __asyraVectorRenderPhaseSink?: (
        phaseName: string,
        durationMs: number
      ) => void
    }
  ).__asyraVectorRenderPhaseSink
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

const buildPreparedFillPolygons = (
  regions: PolygonRegion[]
): PreparedFillPolygon[] =>
  regions.flatMap((region) =>
    region.polygons.map((polygon) => ({
      polygon,
      bounds: getPolygonBounds(polygon)
    }))
  )

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

  if (
    boundaryRole === 'hole' ||
    boundaryRole === 'outer' ||
    boundaryRole === 'filled-face'
  ) {
    return {
      filledSide: defaultFilledSide,
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
    const sidePoint = (side: 1 | -1, offset: number) => ({
      x: boundaryFrame.point.x - boundaryFrame.tangent.y * offset * side,
      y: boundaryFrame.point.y + boundaryFrame.tangent.x * offset * side
    })
    const votes = [1e-3, 0.01, 0.05, 0.1, 0.35, 0.75, 1, 1.5, 2].reduce(
      (result, offset) => {
        const leftPoint = sidePoint(1, offset)
        const rightPoint = sidePoint(-1, offset)
        const leftFilled = preparedFillPolygons
          ? isPointInPreparedFillPolygons(leftPoint, preparedFillPolygons)
          : isPointInFillRegions(leftPoint, fillRegions)
        const rightFilled = preparedFillPolygons
          ? isPointInPreparedFillPolygons(rightPoint, preparedFillPolygons)
          : isPointInFillRegions(rightPoint, fillRegions)
        if (leftFilled !== rightFilled) {
          if (leftFilled) {
            result.left += 1
          } else {
            result.right += 1
          }
        }
        return result
      },
      { left: 0, right: 0 }
    )

    if (votes.left > votes.right) {
      return {
        filledSide: 1 as const,
        status: 'resolved' as const
      }
    }
    if (votes.right > votes.left) {
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
  const sidePoint = (side: 1 | -1, offset: number) => ({
    x: frame.point.x - frame.tangent.y * offset * side,
    y: frame.point.y + frame.tangent.x * offset * side
  })

  const votes = [1e-3, 0.01, 0.05, 0.1, 0.35, 0.75, 1, 1.5, 2].reduce(
    (result, offset) => {
      const leftPoint = sidePoint(1, offset)
      const rightPoint = sidePoint(-1, offset)
      const leftFilled = preparedFillPolygons
        ? isPointInPreparedFillPolygons(leftPoint, preparedFillPolygons)
        : isPointInFillRegions(leftPoint, fillRegions)
      const rightFilled = preparedFillPolygons
        ? isPointInPreparedFillPolygons(rightPoint, preparedFillPolygons)
        : isPointInFillRegions(rightPoint, fillRegions)
      if (leftFilled !== rightFilled) {
        if (leftFilled) {
          result.left += 1
        } else {
          result.right += 1
        }
      }
      return result
    },
    { left: 0, right: 0 }
  )

  if (votes.left > votes.right) {
    return {
      filledSide: 1 as const,
      status: 'resolved' as const
    }
  }
  if (votes.right > votes.left) {
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

const getMergedBoundaryPoints = (edges: EvenOddLegalFaceBoundaryEdge[]) =>
  edges.length === 0
    ? []
    : [edges[0].start, ...edges.map((edge) => edge.end)].filter(
        (point, index, points) => {
          const previous = points[index - 1]
          return !previous || !areSamePoint(previous, point)
        }
      )

const getMergedBoundaryLength = (points: Vec2[]) =>
  points.reduce(
    (sum, point, index) =>
      index === 0 ? sum : sum + distanceBetween(points[index - 1], point),
    0
  )

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
  const sourceSegmentStartDistances: number[] = []
  let sourceCursor = 0
  path.segments.forEach((segment, segmentIndex) => {
    sourceSegmentStartDistances[segmentIndex] = sourceCursor
    sourceCursor += segment.length
  })
  const getCachedSourceSegmentStartDistance = (segmentIndex: number) => {
    return sourceSegmentStartDistances[segmentIndex] ?? 0
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
  const contourRoleByOppositeFaceId = new Map<
    string,
    ResolvedVectorSourceSplitRange['boundaryRole'] | 'mixed'
  >()
  legalBoundaryContours.forEach((contour) => {
    const role = getBoundaryRole(contour)
    const existing = contourRoleByOppositeFaceId.get(contour.oppositeFaceId)
    contourRoleByOppositeFaceId.set(
      contour.oppositeFaceId,
      existing === undefined || existing === role ? role : 'mixed'
    )
  })
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

  legalFaceBoundaries.forEach((face) => {
    const getFaceEdgeBoundaryRole = (
      edge: EvenOddLegalFaceBoundaryEdge
    ): ResolvedVectorSourceSplitRange['boundaryRole'] =>
      edge.oppositeFaceLegal
        ? 'filled-face'
        : edge.oppositeFaceId === null
          ? 'ambiguous'
          : (() => {
              const role = contourRoleByOppositeFaceId.get(edge.oppositeFaceId)
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
      const previousEdge = previousChain?.edges[previousChain.edges.length - 1]
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
      chains.push({ edges: [record.edge], boundaryRole: record.boundaryRole })
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
      const oppositeFaceIds = new Set<string>()
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
          oppositeFaceIds.add(edge.oppositeFaceId)
        }
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
      const edgeIds = chain.edges.map((edge) => edge.edgeId)
      const key = [
        face.faceId,
        edgeIds.join('+'),
        firstEdge.sourceSegmentIndex,
        sourceStartDistance.toFixed(6),
        sourceEndDistance.toFixed(6),
        legalSide
      ].join(':')
      const resolvedSide = resolveFilledSideFromFillRegions({
        boundaryRole: chain.boundaryRole,
        domain: {
          points: boundaryPoints,
          sourceSegmentIndex: firstEdge.sourceSegmentIndex,
          sourceStartDistance,
          sourceEndDistance,
          legalSide: firstEdge.legalSide
        } as EvenOddBoundaryContour['dashDomains'][number],
        fillRegions,
        preparedFillPolygons:
          chain.boundaryRole === 'ambiguous'
            ? getPreparedFillPolygons()
            : undefined,
        legalSide,
        path,
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
          chain.boundaryRole === 'ambiguous' ? 'conflict' : resolvedSide.status,
        contourIds: [face.faceId],
        legalFaceIds: [face.faceId],
        oppositeFaceIds: Array.from(oppositeFaceIds),
        edgeIds,
        usesImplicitClosingEdge: faceUsesImplicitClosingEdge
      })
    })
  })

  if (rangeByKey.size === 0) {
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
        const resolvedSide = resolveFilledSideFromFillRegions({
          boundaryRole,
          domain,
          fillRegions,
          preparedFillPolygons:
            boundaryRole === 'ambiguous'
              ? getPreparedFillPolygons()
              : undefined,
          legalSide,
          path,
          sourceSegmentStartDistance: getCachedSourceSegmentStartDistance(
            domain.sourceSegmentIndex
          )
        })
        const filledSide = resolvedSide.filledSide
        const key = [
          domain.sourceSegmentIndex,
          sourceStartDistance.toFixed(6),
          sourceEndDistance.toFixed(6),
          legalSide
        ].join(':')
        const existing = rangeByKey.get(key)

        if (existing) {
          existing.contourIds = Array.from(
            new Set([...existing.contourIds, contour.contourId])
          )
          existing.legalFaceIds = Array.from(
            new Set([
              ...existing.legalFaceIds,
              ...domain.edges.map((edge) => edge.legalFaceId)
            ])
          )
          existing.oppositeFaceIds = Array.from(
            new Set([
              ...existing.oppositeFaceIds,
              ...domain.edges.map((edge) => edge.oppositeFaceId)
            ])
          )
          existing.edgeIds = Array.from(
            new Set([
              ...existing.edgeIds,
              ...domain.edges.map((edge) => edge.edgeId)
            ])
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
          legalFaceIds: Array.from(
            new Set(domain.edges.map((edge) => edge.legalFaceId))
          ),
          oppositeFaceIds: Array.from(
            new Set(domain.edges.map((edge) => edge.oppositeFaceId))
          ),
          edgeIds: domain.edges.map((edge) => edge.edgeId),
          usesImplicitClosingEdge: domain.edges.some(
            (edge) => edge.isImplicitClosingEdge === true
          )
        })
      })
    })
  }

  return Array.from(rangeByKey.values())
    .sort((left, right) => {
      if (left.sourceSegmentIndex !== right.sourceSegmentIndex) {
        return left.sourceSegmentIndex - right.sourceSegmentIndex
      }
      if (
        Math.abs(left.sourceStartDistance - right.sourceStartDistance) > EPSILON
      ) {
        return left.sourceStartDistance - right.sourceStartDistance
      }
      return left.sourceEndDistance - right.sourceEndDistance
    })
    .map((range, index) => ({
      ...range,
      rangeId: `split-range:${index}`
    }))
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
): TracedLineSegment[] => {
  const segmentRanges = getSourcePathSegmentDistanceRanges(path)
  const tracedSegments: TracedLineSegment[] = []
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
      tracedSegments.push({
        sourceSegmentIndex: segmentIndex,
        sourceStartDistance:
          segmentRange.startDistance + localStart * distanceScale,
        sourceEndDistance:
          segmentRange.startDistance + localEnd * distanceScale,
        start: previousPoint,
        end: point
      })
      localStart = localEnd
    }
  }
  return tracedSegments
}

const buildSelfIntersectingGeometry = (
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

  const tracedSegments = buildResolvedVectorSourcePathTracedSegments(path)
  if (tracedSegments.length === 0) {
    return { geometry: null, cache: emptyCache }
  }
  const domainTracedSegments = tracedSegments
  const tracedSegmentSignatures = domainTracedSegments.map(
    getTracedSegmentSignature
  )
  const splitResult =
    topology.topologyFamily === 'self-intersecting'
      ? null
      : splitTracedSegmentsByIntersections(domainTracedSegments, {
          previousCache: previousCache?.selfIntersectionCache,
          segmentSignatures: tracedSegmentSignatures,
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
        selfIntersectionCache:
          splitResult?.cache ?? previousCache?.selfIntersectionCache
      }
    }
  }

  const resolvedGeometry = buildSelfIntersectingResolvedGeometry(
    domainTracedSegments,
    topology.fillRule,
    {
      previousCache: splitResult?.cache ?? previousCache?.selfIntersectionCache,
      segmentSignatures: tracedSegmentSignatures,
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
    selfIntersectionCache:
      resolvedGeometry.cache ??
      splitResult?.cache ??
      previousCache?.selfIntersectionCache
  }
  if (detailMode === 'fill-only') {
    if (
      previousCache?.selfIntersectionCache &&
      outputCache.selfIntersectionCache
    ) {
      emitStrokePipelineCounter('resolved-geometry-frame-cache-reused')
    } else {
      emitStrokePipelineCounter('resolved-geometry-frame-cache-primed')
    }

    return {
      geometry: {
        tracedSegments,
        fillRegions,
        legalFaceBoundaries: [],
        unfilledFaceBoundaries: [],
        legalBoundaryContours: [],
        sourceSplitRanges: [],
        strokeBoundaryDomains: []
      },
      cache: outputCache
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
    () =>
      buildResolvedVectorSourceSplitRanges(
        legalFaceBoundaries,
        legalBoundaryContours,
        resolvedGeometry.fillRegions.length > 0
          ? resolvedGeometry.fillRegions
          : (sourceBoundaryResolvedGeometry?.fillRegions ?? []),
        path
      )
  )

  if (
    previousCache?.selfIntersectionCache &&
    outputCache.selfIntersectionCache
  ) {
    emitStrokePipelineCounter('resolved-geometry-frame-cache-reused')
  } else {
    emitStrokePipelineCounter('resolved-geometry-frame-cache-primed')
  }

  return {
    geometry: {
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
    },
    cache: outputCache
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
