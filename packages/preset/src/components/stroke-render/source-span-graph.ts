import type { DashedCenterStrokeIntervalRecord } from './dashed-center-stroke-intervals'
import type { PathTopologyModel } from './path-topology-model'
import { EPS, distance, type Vec2 } from './solid-stroke-geometry-core'

export type SourceSpanCutKind = 'vertex' | 'dash-boundary' | 'self-intersection'

export interface SourceSpanCut {
  cutId: string
  distance: number
  kind: SourceSpanCutKind
  crossingId?: string
}

export interface SourceSpanRecord {
  sourceSpanId: string
  contourId: string
  startDistance: number
  endDistance: number
  cutKinds: SourceSpanCutKind[]
}

export interface SourceSpanGraph {
  topologyRevision: string
  totalLength: number
  closed: boolean
  cuts: SourceSpanCut[]
  spans: SourceSpanRecord[]
}

const clampDistance = (value: number, totalLength: number) =>
  Math.max(0, Math.min(totalLength, value))

const getSegmentDistanceRanges = (topology: PathTopologyModel) => {
  const contour = topology.contours[0]
  if (!contour) {
    return []
  }

  let cursor = 0
  return contour.segments.map((segment) => {
    const startDistance = cursor
    cursor += segment.length
    return {
      contourId: contour.contourId,
      segmentId: segment.segmentId,
      startIndex: segment.startIndex,
      endIndex: segment.endIndex,
      startDistance,
      endDistance: cursor
    }
  })
}

const cross = (a: Vec2, b: Vec2, c: Vec2) =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)

const getSegmentIntersectionRatios = (
  leftStart: Vec2,
  leftEnd: Vec2,
  rightStart: Vec2,
  rightEnd: Vec2
) => {
  const leftDx = leftEnd.x - leftStart.x
  const leftDy = leftEnd.y - leftStart.y
  const rightDx = rightEnd.x - rightStart.x
  const rightDy = rightEnd.y - rightStart.y
  const denominator = leftDx * rightDy - leftDy * rightDx
  if (Math.abs(denominator) <= EPS) {
    return null
  }

  const deltaX = rightStart.x - leftStart.x
  const deltaY = rightStart.y - leftStart.y
  const leftRatio = (deltaX * rightDy - deltaY * rightDx) / denominator
  const rightRatio = (deltaX * leftDy - deltaY * leftDx) / denominator
  if (
    leftRatio <= EPS ||
    leftRatio >= 1 - EPS ||
    rightRatio <= EPS ||
    rightRatio >= 1 - EPS
  ) {
    return null
  }

  return { leftRatio, rightRatio }
}

const areAdjacentClosedSegments = (
  leftIndex: number,
  rightIndex: number,
  segmentCount: number,
  closed: boolean
) => {
  if (Math.abs(leftIndex - rightIndex) <= 1) {
    return true
  }
  return closed && leftIndex === 0 && rightIndex === segmentCount - 1
}

const SELF_INTERSECTION_CUT_CACHE_LIMIT = 64
const selfIntersectionCutCache = new Map<string, SourceSpanCut[]>()

const getSelfIntersectionCuts = (
  topology: PathTopologyModel
): SourceSpanCut[] => {
  const cached = selfIntersectionCutCache.get(topology.revision)
  if (cached) {
    selfIntersectionCutCache.delete(topology.revision)
    selfIntersectionCutCache.set(topology.revision, cached)
    return cached
  }

  const segmentRanges = getSegmentDistanceRanges(topology)
  if (segmentRanges.length < 2) {
    return []
  }

  const cuts: SourceSpanCut[] = []
  const segmentRefs = segmentRanges.flatMap((segment) => {
    const start = topology.normalizedPoints[segment.startIndex]
    const end = topology.normalizedPoints[segment.endIndex]
    if (!start || !end) {
      return []
    }

    return [
      {
        ...segment,
        start,
        end,
        minX: Math.min(start.x, end.x),
        minY: Math.min(start.y, end.y),
        maxX: Math.max(start.x, end.x),
        maxY: Math.max(start.y, end.y)
      }
    ]
  })

  for (let leftIndex = 0; leftIndex < segmentRefs.length - 1; leftIndex += 1) {
    const left = segmentRefs[leftIndex]
    if (!left) {
      continue
    }

    for (
      let rightIndex = leftIndex + 1;
      rightIndex < segmentRefs.length;
      rightIndex += 1
    ) {
      const right = segmentRefs[rightIndex]
      if (!right) {
        continue
      }

      if (
        areAdjacentClosedSegments(
          leftIndex,
          rightIndex,
          segmentRefs.length,
          topology.closed
        )
      ) {
        continue
      }

      if (
        left.maxX < right.minX - EPS ||
        right.maxX < left.minX - EPS ||
        left.maxY < right.minY - EPS ||
        right.maxY < left.minY - EPS
      ) {
        continue
      }

      if (
        cross(left.start, left.end, right.start) *
          cross(left.start, left.end, right.end) >
          EPS ||
        cross(right.start, right.end, left.start) *
          cross(right.start, right.end, left.end) >
          EPS
      ) {
        continue
      }

      const ratios = getSegmentIntersectionRatios(
        left.start,
        left.end,
        right.start,
        right.end
      )
      if (ratios === null) {
        continue
      }

      const crossingId = `self-intersection:${left.segmentId}:${right.segmentId}`
      const distanceAlongLeft =
        left.startDistance + distance(left.start, left.end) * ratios.leftRatio
      const distanceAlongRight =
        right.startDistance +
        distance(right.start, right.end) * ratios.rightRatio
      ;[
        { segmentId: left.segmentId, distance: distanceAlongLeft },
        { segmentId: right.segmentId, distance: distanceAlongRight }
      ].forEach((cut) => {
        cuts.push({
          cutId: `${crossingId}:${cut.segmentId}`,
          crossingId,
          distance: clampDistance(cut.distance, topology.totalLength),
          kind: 'self-intersection'
        })
      })
    }
  }

  selfIntersectionCutCache.set(topology.revision, cuts)
  if (selfIntersectionCutCache.size > SELF_INTERSECTION_CUT_CACHE_LIMIT) {
    const [oldestKey] = selfIntersectionCutCache.keys()
    if (oldestKey) {
      selfIntersectionCutCache.delete(oldestKey)
    }
  }
  return cuts
}

const addCut = (
  cutsByDistance: Map<string, SourceSpanCut>,
  cut: SourceSpanCut,
  totalLength: number
) => {
  const distanceKey = clampDistance(cut.distance, totalLength).toFixed(6)
  const existing = cutsByDistance.get(distanceKey)
  if (!existing) {
    cutsByDistance.set(distanceKey, {
      ...cut,
      distance: Number(distanceKey)
    })
    return
  }

  cutsByDistance.set(distanceKey, {
    cutId: `${existing.cutId}|${cut.cutId}`,
    distance: existing.distance,
    crossingId:
      existing.crossingId === cut.crossingId
        ? existing.crossingId
        : [existing.crossingId, cut.crossingId].filter(Boolean).join('|') ||
          undefined,
    kind:
      existing.kind === 'self-intersection' || cut.kind === 'self-intersection'
        ? 'self-intersection'
        : existing.kind === 'dash-boundary' || cut.kind === 'dash-boundary'
          ? 'dash-boundary'
          : 'vertex'
  })
}

export const buildSourceSpanGraph = (
  topology: PathTopologyModel,
  intervals: DashedCenterStrokeIntervalRecord[] = []
): SourceSpanGraph => {
  const cutsByDistance = new Map<string, SourceSpanCut>()
  const segmentRanges = getSegmentDistanceRanges(topology)

  addCut(
    cutsByDistance,
    { cutId: 'path:start', distance: 0, kind: 'vertex' },
    topology.totalLength
  )
  addCut(
    cutsByDistance,
    {
      cutId: 'path:end',
      distance: topology.totalLength,
      kind: 'vertex'
    },
    topology.totalLength
  )

  segmentRanges.forEach((segment) => {
    addCut(
      cutsByDistance,
      {
        cutId: `${segment.contourId}:${segment.segmentId}:start`,
        distance: segment.startDistance,
        kind: 'vertex'
      },
      topology.totalLength
    )
    addCut(
      cutsByDistance,
      {
        cutId: `${segment.contourId}:${segment.segmentId}:end`,
        distance: segment.endDistance,
        kind: 'vertex'
      },
      topology.totalLength
    )
  })

  getSelfIntersectionCuts(topology).forEach((cut) =>
    addCut(cutsByDistance, cut, topology.totalLength)
  )

  intervals.forEach((interval) => {
    addCut(
      cutsByDistance,
      {
        cutId: `${interval.intervalId}:start`,
        distance: interval.startDistance,
        kind: 'dash-boundary'
      },
      topology.totalLength
    )
    addCut(
      cutsByDistance,
      {
        cutId: `${interval.intervalId}:end`,
        distance: interval.endDistance,
        kind: 'dash-boundary'
      },
      topology.totalLength
    )
  })

  const cuts = [...cutsByDistance.values()].sort(
    (left, right) => left.distance - right.distance
  )
  const contourId =
    topology.contours[0]?.contourId ?? `${topology.pathId}:contour:0`
  const spans = cuts.slice(0, -1).flatMap((cut, index) => {
    const nextCut = cuts[index + 1]
    if (!nextCut || nextCut.distance - cut.distance <= EPS) {
      return []
    }

    return [
      {
        sourceSpanId: `${contourId}:source-span:${index}`,
        contourId,
        startDistance: cut.distance,
        endDistance: nextCut.distance,
        cutKinds: [cut.kind, nextCut.kind]
      }
    ]
  })

  return {
    topologyRevision: topology.revision,
    totalLength: topology.totalLength,
    closed: topology.closed,
    cuts,
    spans
  }
}

export const getSourceSpanIdsForInterval = (
  graph: SourceSpanGraph,
  interval: Pick<
    DashedCenterStrokeIntervalRecord,
    'startDistance' | 'endDistance' | 'wrapsSeam'
  >
): string[] => {
  const collect = (startDistance: number, endDistance: number) => {
    const ids: string[] = []
    for (const span of graph.spans) {
      if (span.startDistance >= endDistance - EPS) {
        break
      }
      if (span.endDistance > startDistance + EPS) {
        ids.push(span.sourceSpanId)
      }
    }
    return ids
  }

  const sourceSpanIds = interval.wrapsSeam
    ? [
        ...collect(interval.startDistance, graph.totalLength),
        ...collect(0, interval.endDistance)
      ]
    : collect(interval.startDistance, interval.endDistance)

  return [...new Set(sourceSpanIds)]
}
