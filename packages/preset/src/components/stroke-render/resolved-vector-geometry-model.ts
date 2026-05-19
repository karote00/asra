import {
  buildSelfIntersectingEvenOddResolvedGeometry,
  splitTracedSegmentsByIntersections,
  type EvenOddBoundaryContour,
  type EvenOddLegalFaceBoundary,
  type TracedLineSegment
} from './self-intersecting-legal-domain'
import { slicePathGeometryPoints, type PathGeometry } from './path-geometry'
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
}

export interface ResolvedVectorSourceSplitRange {
  rangeId: string
  sourceSegmentIndex: number
  sourceStartDistance: number
  sourceEndDistance: number
  legalSide: 1 | -1
  sideResolutionStatus: 'resolved' | 'conflict'
  contourIds: string[]
  legalFaceIds: string[]
  oppositeFaceIds: string[]
  edgeIds: string[]
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

const buildResolvedVectorSourceSplitRanges = (
  legalBoundaryContours: EvenOddBoundaryContour[]
): ResolvedVectorSourceSplitRange[] => {
  const rangeByKey = new Map<string, ResolvedVectorSourceSplitRange>()

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
        return
      }

      rangeByKey.set(key, {
        rangeId: `source-split-range:${rangeByKey.size}`,
        sourceSegmentIndex: domain.sourceSegmentIndex,
        sourceStartDistance,
        sourceEndDistance,
        legalSide,
        sideResolutionStatus: 'resolved',
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

  const resolvedGeometry =
    buildSelfIntersectingEvenOddResolvedGeometry(tracedSegments)
  const fallbackResolvedGeometry =
    resolvedGeometry.legalBoundaryContours.length === 0
      ? buildSelfIntersectingEvenOddResolvedGeometry(
          buildClosedTopologyPointTracedSegments(topology.normalizedPoints)
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

  return {
    tracedSegments,
    fillRegions:
      resolvedGeometry.fillRegions.length > 0
        ? resolvedGeometry.fillRegions
        : (fallbackResolvedGeometry?.fillRegions ?? []),
    legalFaceBoundaries:
      resolvedGeometry.legalFaceBoundaries.length > 0
        ? resolvedGeometry.legalFaceBoundaries
        : (fallbackResolvedGeometry?.legalFaceBoundaries ?? []),
    legalBoundaryContours,
    sourceSplitRanges: buildResolvedVectorSourceSplitRanges(
      legalBoundaryContours
    )
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
