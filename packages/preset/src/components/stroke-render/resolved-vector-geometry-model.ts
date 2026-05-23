import {
  buildSelfIntersectingResolvedGeometry,
  splitTracedSegmentsByIntersections,
  type EvenOddBoundaryContour,
  type EvenOddLegalFaceBoundaryEdge,
  type EvenOddLegalFaceBoundary,
  type TracedLineSegment
} from './self-intersecting-legal-domain'
import {
  buildPolylineGeometryModelPath,
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

export interface ResolvedVectorSelfIntersectingGeometry {
  tracedSegments: TracedLineSegment[]
  fillRegions: PolygonRegion[]
  legalFaceBoundaries: EvenOddLegalFaceBoundary[]
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
}

const EPSILON = 1e-6

const distanceBetween = (a: Vec2, b: Vec2) => Math.hypot(b.x - a.x, b.y - a.y)

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

  const boundaryPath = buildPolylineGeometryModelPath(points, false)
  if (boundaryPath.totalLength <= EPSILON) {
    return null
  }

  let remainingDistance = boundaryPath.totalLength / 2
  for (const segment of boundaryPath.segments) {
    if (remainingDistance <= segment.length + EPSILON) {
      return samplePathSegmentFrameAtLength(
        segment,
        Math.max(0, Math.min(segment.length, remainingDistance))
      )
    }
    remainingDistance -= segment.length
  }

  const lastSegment = boundaryPath.segments[boundaryPath.segments.length - 1]
  return lastSegment
    ? samplePathSegmentFrameAtLength(lastSegment, lastSegment.length)
    : null
}

const resolveFilledSideFromFillRegions = ({
  boundaryRole,
  domain,
  fillRegions,
  legalSide,
  path
}: {
  boundaryRole: ResolvedVectorSourceSplitRange['boundaryRole']
  domain: EvenOddBoundaryContour['dashDomains'][number]
  fillRegions: PolygonRegion[]
  legalSide: 1 | -1
  path: Pick<PathGeometry, 'segments'>
}) => {
  const fallbackFilledSide =
    boundaryRole === 'hole' ? (legalSide === 1 ? -1 : 1) : legalSide

  if (boundaryRole === 'hole') {
    return {
      filledSide: fallbackFilledSide,
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
      filledSide: fallbackFilledSide,
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
        const leftFilled = isPointInFillRegions(
          sidePoint(1, offset),
          fillRegions
        )
        const rightFilled = isPointInFillRegions(
          sidePoint(-1, offset),
          fillRegions
        )
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

  const segmentStartDistance = getSegmentStartDistance(
    path,
    domain.sourceSegmentIndex
  )
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
      const leftFilled = isPointInFillRegions(sidePoint(1, offset), fillRegions)
      const rightFilled = isPointInFillRegions(
        sidePoint(-1, offset),
        fillRegions
      )
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
    filledSide: fallbackFilledSide,
    status: 'resolved' as const
  }
}

const getSourcePathSegmentDistanceRanges = (
  path: Pick<PathGeometry, 'segments'>
) => {
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
  return points.flatMap((start, index) => {
    const end = points[(index + 1) % points.length]
    const length = distanceBetween(start, end)
    if (length <= EPSILON) {
      return []
    }

    const sourceStartDistance = cursor
    cursor += length

    return [
      {
        sourceSegmentIndex: index,
        sourceStartDistance,
        sourceEndDistance: cursor,
        start,
        end
      }
    ]
  })
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

const buildFallbackBoundaryContourFromTracedSegments = (
  segments: TracedLineSegment[]
): EvenOddBoundaryContour[] => {
  if (segments.length < 3) {
    return []
  }

  const contourId = 'fallback-source-boundary:0'
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
  points
    .slice(1)
    .reduce(
      (sum, point, index) => sum + distanceBetween(points[index], point),
      0
    )

const buildResolvedVectorSourceSplitRanges = (
  legalFaceBoundaries: EvenOddLegalFaceBoundary[],
  legalBoundaryContours: EvenOddBoundaryContour[],
  fillRegions: PolygonRegion[],
  path: Pick<PathGeometry, 'segments'>
): ResolvedVectorSourceSplitRange[] => {
  const rangeByKey = new Map<string, ResolvedVectorSourceSplitRange>()
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
  const contourRoleByEdgeKey = new Map<
    string,
    ResolvedVectorSourceSplitRange['boundaryRole']
  >()

  legalBoundaryContours.forEach((contour) => {
    const role = getBoundaryRole(contour)
    contour.edges.forEach((edge) => {
      contourRoleByEdgeKey.set(edgeKey(edge.start, edge.end), role)
      contourRoleByEdgeKey.set(edgeKey(edge.end, edge.start), role)
    })
  })

  legalFaceBoundaries.forEach((face) => {
    const getFaceEdgeBoundaryRole = (
      edge: EvenOddLegalFaceBoundaryEdge
    ): ResolvedVectorSourceSplitRange['boundaryRole'] =>
      edge.oppositeFaceLegal
        ? 'filled-face'
        : (contourRoleByEdgeKey.get(edgeKey(edge.start, edge.end)) ??
          'ambiguous')

    const edgeRecords = face.edges.flatMap((edge) => {
      if (
        edge.sourceSegmentIndex === undefined ||
        edge.sourceStartDistance === undefined ||
        edge.sourceEndDistance === undefined
      ) {
        return []
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
        return []
      }
      return [
        {
          edge,
          boundaryRole: getFaceEdgeBoundaryRole(edge)
        }
      ]
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

      const sourceDistances = chain.edges.flatMap((edge) =>
        edge.sourceStartDistance !== undefined &&
        edge.sourceEndDistance !== undefined
          ? [edge.sourceStartDistance, edge.sourceEndDistance]
          : []
      )
      const sourceStartDistance = Math.min(...sourceDistances)
      const sourceEndDistance = Math.max(...sourceDistances)
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
        legalSide,
        path
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
        oppositeFaceIds: Array.from(
          new Set(
            chain.edges.flatMap((edge) =>
              edge.oppositeFaceId ? [edge.oppositeFaceId] : []
            )
          )
        ),
        edgeIds
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
          legalSide,
          path
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
          edgeIds: domain.edges.map((edge) => edge.edgeId)
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
  path: Pick<PathGeometry, 'segments' | 'closed' | 'totalLength'>
): TracedLineSegment[] => {
  const segmentRanges = getSourcePathSegmentDistanceRanges(path)
  return path.segments.flatMap((segment, segmentIndex) => {
    const segmentRange = segmentRanges[segmentIndex]
    if (!segmentRange || segment.length <= EPSILON) {
      return []
    }

    const points = slicePathGeometryPoints(
      {
        segments: [segment],
        closed: false,
        totalLength: segment.length
      },
      0,
      segment.length,
      false
    )
    const sampledPoints =
      points.length >= 2 ? points : [segment.start, segment.end]
    const localDistances = [0]
    for (let index = 1; index < sampledPoints.length; index += 1) {
      localDistances.push(
        localDistances[localDistances.length - 1] +
          distanceBetween(sampledPoints[index - 1], sampledPoints[index])
      )
    }
    const sampledLength = localDistances[localDistances.length - 1] ?? 0
    const distanceScale =
      sampledLength > EPSILON ? segment.length / sampledLength : 1

    return sampledPoints.flatMap((point, index) => {
      if (index === 0) {
        return []
      }
      const previousPoint = sampledPoints[index - 1]
      if (distanceBetween(previousPoint, point) <= EPSILON) {
        return []
      }
      const localStart = localDistances[index - 1] * distanceScale
      const localEnd = localDistances[index] * distanceScale
      return [
        {
          sourceSegmentIndex: segmentIndex,
          sourceStartDistance: segmentRange.startDistance + localStart,
          sourceEndDistance: segmentRange.startDistance + localEnd,
          start: previousPoint,
          end: point
        }
      ]
    })
  })
}

const buildSelfIntersectingGeometry = (
  path: PathGeometry,
  topology: PathTopologyModel
): ResolvedVectorSelfIntersectingGeometry | null => {
  if (!path.closed || path.segments.length < 2) {
    return null
  }

  const tracedSegments = buildResolvedVectorSourcePathTracedSegments(path)
  if (tracedSegments.length === 0) {
    return null
  }
  const sourceSplitSegments = splitTracedSegmentsByIntersections(tracedSegments)
  const hasSourceIntersections =
    sourceSplitSegments.length > tracedSegments.length
  if (
    topology.topologyFamily !== 'self-intersecting' &&
    !hasSourceIntersections
  ) {
    return null
  }

  const resolvedGeometry = buildSelfIntersectingResolvedGeometry(
    tracedSegments,
    topology.fillRule
  )
  const fallbackResolvedGeometry =
    resolvedGeometry.legalBoundaryContours.length === 0
      ? buildSelfIntersectingResolvedGeometry(
          buildClosedTopologyPointTracedSegments(topology.normalizedPoints),
          topology.fillRule
        )
      : null
  const fallbackLegalBoundaryContours =
    resolvedGeometry.legalBoundaryContours.length > 0
      ? resolvedGeometry.legalBoundaryContours
      : (fallbackResolvedGeometry?.legalBoundaryContours ?? [])
  const legalBoundaryContours =
    fallbackLegalBoundaryContours.length > 0
      ? fallbackLegalBoundaryContours
      : buildFallbackBoundaryContourFromTracedSegments(tracedSegments)

  const legalFaceBoundaries =
    resolvedGeometry.legalFaceBoundaries.length > 0
      ? resolvedGeometry.legalFaceBoundaries
      : (fallbackResolvedGeometry?.legalFaceBoundaries ?? [])

  const sourceSplitRanges = buildResolvedVectorSourceSplitRanges(
    legalFaceBoundaries,
    legalBoundaryContours,
    resolvedGeometry.fillRegions.length > 0
      ? resolvedGeometry.fillRegions
      : (fallbackResolvedGeometry?.fillRegions ?? []),
    path
  )

  return {
    tracedSegments,
    fillRegions:
      resolvedGeometry.fillRegions.length > 0
        ? resolvedGeometry.fillRegions
        : (fallbackResolvedGeometry?.fillRegions ?? []),
    legalFaceBoundaries: legalFaceBoundaries,
    legalBoundaryContours,
    sourceSplitRanges,
    strokeBoundaryDomains:
      buildResolvedVectorStrokeBoundaryDomains(sourceSplitRanges)
  }
}

export const buildResolvedVectorGeometryModel = ({
  fillRule,
  modelId,
  networks
}: {
  fillRule: PathTopologyModel['fillRule']
  modelId: string
  networks: ResolvedVectorGeometryNetworkInput[]
}): ResolvedVectorGeometryModel => ({
  modelId,
  fillRule,
  networks: networks.map((network) => ({
    ...network,
    selfIntersecting: buildSelfIntersectingGeometry(
      network.path,
      network.topology
    )
  }))
})
