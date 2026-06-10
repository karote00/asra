import type { PolygonRegion } from './geometry-backend'

export interface Vec2 {
  x: number
  y: number
}

interface LineSegment {
  start: Vec2
  end: Vec2
}

interface LineSegmentBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface TracedLineSegment extends LineSegment {
  sourceSegmentIndex?: number
  sourceStartDistance?: number
  sourceEndDistance?: number
  isImplicitClosingEdge?: boolean
}

export interface SelfIntersectionPairCacheEntry {
  leftIndex: number
  rightIndex: number
  leftSignature: string
  rightSignature: string
  leftParams: number[]
  rightParams: number[]
}

export interface SelfIntersectionPairCache {
  segmentSignatures: string[]
  pairEntries: Map<string, SelfIntersectionPairCacheEntry>
}

export interface IncrementalSelfIntersectionOptions {
  previousCache?: SelfIntersectionPairCache
  segmentSignatures?: string[]
  returnCache?: boolean
  preSplitResult?: SplitTracedSegmentsResult
  legalFacePolicy?: 'fill-rule' | 'bounded-faces'
}

export interface SplitTracedSegmentsResult {
  splitSegments: TracedLineSegment[]
  cache: SelfIntersectionPairCache
}

interface DirectedEdge {
  from: number
  to: number
  angle: number
  rev: number
  segmentIndex: number
  reversed: boolean
}

interface PlanarFace {
  faceId: string
  points: Vec2[]
  edgeIds: number[]
  area: number
  legal: boolean
  exterior: boolean
}

interface PlanarGraph {
  splitSegments: TracedLineSegment[]
  pointsList: Vec2[]
  nodeIdByKey: Map<string, number>
  nodeDegreeById: number[]
  edges: DirectedEdge[]
  faces: PlanarFace[]
  faceIndexByEdgeId: Map<number, number>
}

type SelfIntersectingFillRule = 'evenodd' | 'nonzero'

const INTERSECTION_EPS = 1e-6
const NODE_KEY_EPS = 1e-4
const SOURCE_DISTANCE_EPS = 1e-4
const MAX_OPEN_SEGMENTS = 1200

const distance = (from: Vec2, to: Vec2) =>
  Math.hypot(to.x - from.x, to.y - from.y)

const measureSelfIntersectingPhase = <T>(
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

const polygonArea = (points: Vec2[]) => {
  let area = 0
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]
    const next = points[(index + 1) % points.length]
    area += current.x * next.y - next.x * current.y
  }
  return area / 2
}

const polygonCentroid = (points: Vec2[], precomputedArea?: number) => {
  const area = precomputedArea ?? polygonArea(points)
  if (Math.abs(area) <= INTERSECTION_EPS) {
    const sum = points.reduce(
      (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
      { x: 0, y: 0 }
    )
    return { x: sum.x / points.length, y: sum.y / points.length }
  }

  let cx = 0
  let cy = 0
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]
    const next = points[(index + 1) % points.length]
    const cross = current.x * next.y - next.x * current.y
    cx += (current.x + next.x) * cross
    cy += (current.y + next.y) * cross
  }

  const factor = 1 / (6 * area)
  return { x: cx * factor, y: cy * factor }
}

const cross = (a: Vec2, b: Vec2) => a.x * b.y - a.y * b.x

const getSegmentBounds = (segment: LineSegment): LineSegmentBounds => ({
  minX: Math.min(segment.start.x, segment.end.x),
  minY: Math.min(segment.start.y, segment.end.y),
  maxX: Math.max(segment.start.x, segment.end.x),
  maxY: Math.max(segment.start.y, segment.end.y)
})

const segmentBoundsMayOverlap = (
  left: LineSegmentBounds,
  right: LineSegmentBounds
) =>
  left.maxX >= right.minX - INTERSECTION_EPS &&
  right.maxX >= left.minX - INTERSECTION_EPS &&
  left.maxY >= right.minY - INTERSECTION_EPS &&
  right.maxY >= left.minY - INTERSECTION_EPS

const segmentIntersection = (a: LineSegment, b: LineSegment) => {
  const r = { x: a.end.x - a.start.x, y: a.end.y - a.start.y }
  const s = { x: b.end.x - b.start.x, y: b.end.y - b.start.y }
  const denominator = cross(r, s)
  if (Math.abs(denominator) <= INTERSECTION_EPS) {
    return null
  }

  const delta = { x: b.start.x - a.start.x, y: b.start.y - a.start.y }
  const t = cross(delta, s) / denominator
  const u = cross(delta, r) / denominator
  if (
    t <= INTERSECTION_EPS ||
    t >= 1 - INTERSECTION_EPS ||
    u <= INTERSECTION_EPS ||
    u >= 1 - INTERSECTION_EPS
  ) {
    return null
  }

  return {
    point: {
      x: a.start.x + r.x * t,
      y: a.start.y + r.y * t
    },
    t,
    u
  }
}

const uniqueSorted = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b)
  const result: number[] = []
  sorted.forEach((value) => {
    if (
      result.length === 0 ||
      Math.abs(value - result[result.length - 1]) > INTERSECTION_EPS
    ) {
      result.push(value)
    }
  })
  return result
}

const toNodeKey = (point: Vec2) =>
  `${Math.round(point.x / NODE_KEY_EPS)}:${Math.round(point.y / NODE_KEY_EPS)}`

const interpolateTracedSegmentPoint = (
  segment: TracedLineSegment,
  t: number
): Vec2 => ({
  x: segment.start.x + (segment.end.x - segment.start.x) * t,
  y: segment.start.y + (segment.end.y - segment.start.y) * t
})

const interpolateTracedDistance = (segment: TracedLineSegment, t: number) => {
  if (
    segment.sourceStartDistance === undefined ||
    segment.sourceEndDistance === undefined
  ) {
    return undefined
  }
  return (
    segment.sourceStartDistance +
    (segment.sourceEndDistance - segment.sourceStartDistance) * t
  )
}

const getTracedSegmentSignature = (segment: TracedLineSegment) =>
  [
    segment.start.x.toFixed(4),
    segment.start.y.toFixed(4),
    segment.end.x.toFixed(4),
    segment.end.y.toFixed(4),
    segment.sourceSegmentIndex ?? ''
  ].join(':')

const getPairCacheKey = (leftIndex: number, rightIndex: number) =>
  `${leftIndex}:${rightIndex}`

const areSourceDistancesConsecutive = (
  left: TracedLineSegment,
  right: TracedLineSegment
) => {
  if (
    left.sourceStartDistance === undefined ||
    left.sourceEndDistance === undefined ||
    right.sourceStartDistance === undefined ||
    right.sourceEndDistance === undefined
  ) {
    return false
  }

  return (
    Math.abs(left.sourceEndDistance - right.sourceStartDistance) <=
      SOURCE_DISTANCE_EPS ||
    Math.abs(right.sourceEndDistance - left.sourceStartDistance) <=
      SOURCE_DISTANCE_EPS
  )
}

const areConsecutiveSameSourceTracedSegments = (
  left: TracedLineSegment,
  right: TracedLineSegment
) =>
  left.sourceSegmentIndex !== undefined &&
  left.sourceSegmentIndex === right.sourceSegmentIndex &&
  areSourceDistancesConsecutive(left, right)

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

const splitTracedSegmentsByIntersectionsInternal = <
  T extends TracedLineSegment
>(
  segments: T[],
  options: IncrementalSelfIntersectionOptions = {}
): SplitTracedSegmentsResult => {
  const splitParams = segments.map(() => [0, 1])
  const segmentBounds = segments.map(getSegmentBounds)
  const segmentSignatures =
    options.segmentSignatures ??
    segments.map((segment) => getTracedSegmentSignature(segment))
  const pairEntries = new Map<string, SelfIntersectionPairCacheEntry>()
  const previousSegmentSignatures = options.previousCache?.segmentSignatures
  const canReusePreviousPairs =
    previousSegmentSignatures !== undefined &&
    previousSegmentSignatures.length === segmentSignatures.length
  const dirtySegmentIndexes = new Set<number>()
  if (canReusePreviousPairs) {
    segmentSignatures.forEach((signature, index) => {
      if (previousSegmentSignatures[index] !== signature) {
        dirtySegmentIndexes.add(index)
      }
    })
    options.previousCache?.pairEntries.forEach((cachedPair, pairKey) => {
      const leftIndex = cachedPair.leftIndex
      const rightIndex = cachedPair.rightIndex
      if (
        !Number.isInteger(leftIndex) ||
        !Number.isInteger(rightIndex) ||
        dirtySegmentIndexes.has(leftIndex) ||
        dirtySegmentIndexes.has(rightIndex) ||
        cachedPair.leftSignature !== (segmentSignatures[leftIndex] ?? '') ||
        cachedPair.rightSignature !== (segmentSignatures[rightIndex] ?? '')
      ) {
        return
      }

      splitParams[leftIndex].push(...cachedPair.leftParams)
      splitParams[rightIndex].push(...cachedPair.rightParams)
      pairEntries.set(pairKey, cachedPair)
      emitStrokePipelineCounter('self-intersection-pair-cache-hit')
    })
  }

  const processPair = (inputLeftIndex: number, inputRightIndex: number) => {
    const leftIndex = Math.min(inputLeftIndex, inputRightIndex)
    const rightIndex = Math.max(inputLeftIndex, inputRightIndex)
    if (leftIndex === rightIndex) {
      return
    }

    if (leftIndex === undefined) {
      return
    }
    const leftBounds = segmentBounds[leftIndex]
    if (!leftBounds) {
      return
    }
    const rightBounds = segmentBounds[rightIndex]
    if (!rightBounds || !segmentBoundsMayOverlap(leftBounds, rightBounds)) {
      return
    }
    if (
      areConsecutiveSameSourceTracedSegments(
        segments[leftIndex],
        segments[rightIndex]
      )
    ) {
      emitStrokePipelineCounter('self-intersection-consecutive-pair-skipped')
      return
    }

    const pairKey = getPairCacheKey(leftIndex, rightIndex)
    if (
      canReusePreviousPairs &&
      !dirtySegmentIndexes.has(leftIndex) &&
      !dirtySegmentIndexes.has(rightIndex)
    ) {
      return
    }
    const leftSignature = segmentSignatures[leftIndex] ?? ''
    const rightSignature = segmentSignatures[rightIndex] ?? ''
    const cachedPair = options.previousCache?.pairEntries.get(pairKey)
    if (
      cachedPair &&
      cachedPair.leftSignature === leftSignature &&
      cachedPair.rightSignature === rightSignature
    ) {
      splitParams[leftIndex].push(...cachedPair.leftParams)
      splitParams[rightIndex].push(...cachedPair.rightParams)
      pairEntries.set(pairKey, cachedPair)
      emitStrokePipelineCounter('self-intersection-pair-cache-hit')
      return
    }

    emitStrokePipelineCounter('self-intersection-pair-cache-miss')
    const intersection = segmentIntersection(
      segments[leftIndex],
      segments[rightIndex]
    )
    if (!intersection) {
      pairEntries.set(pairKey, {
        leftIndex,
        rightIndex,
        leftSignature,
        rightSignature,
        leftParams: [],
        rightParams: []
      })
      return
    }
    splitParams[leftIndex].push(intersection.t)
    splitParams[rightIndex].push(intersection.u)
    pairEntries.set(pairKey, {
      leftIndex,
      rightIndex,
      leftSignature,
      rightSignature,
      leftParams: [intersection.t],
      rightParams: [intersection.u]
    })
  }

  const segmentIndexesByMinX = segments
    .map((_, index) => index)
    .sort(
      (leftIndex, rightIndex) =>
        (segmentBounds[leftIndex]?.minX ?? 0) -
        (segmentBounds[rightIndex]?.minX ?? 0)
    )

  for (
    let leftOrderIndex = 0;
    leftOrderIndex < segmentIndexesByMinX.length;
    leftOrderIndex += 1
  ) {
    const leftIndex = segmentIndexesByMinX[leftOrderIndex]
    if (leftIndex === undefined) {
      continue
    }
    const leftBounds = segmentBounds[leftIndex]
    if (!leftBounds) {
      continue
    }
    for (
      let rightOrderIndex = leftOrderIndex + 1;
      rightOrderIndex < segmentIndexesByMinX.length;
      rightOrderIndex += 1
    ) {
      const rightIndex = segmentIndexesByMinX[rightOrderIndex]
      if (rightIndex === undefined) {
        continue
      }
      const rightBounds = segmentBounds[rightIndex]
      if (!rightBounds) {
        continue
      }
      if (rightBounds.minX > leftBounds.maxX + INTERSECTION_EPS) {
        break
      }
      processPair(leftIndex, rightIndex)
    }
  }

  const result: TracedLineSegment[] = []
  segments.forEach((segment, index) => {
    const params = uniqueSorted(splitParams[index])
    for (let paramIndex = 0; paramIndex < params.length - 1; paramIndex += 1) {
      const t0 = params[paramIndex]
      const t1 = params[paramIndex + 1]
      if (t1 - t0 <= INTERSECTION_EPS) {
        continue
      }
      const start = interpolateTracedSegmentPoint(segment, t0)
      const end = interpolateTracedSegmentPoint(segment, t1)
      if (distance(start, end) > INTERSECTION_EPS) {
        result.push({
          start,
          end,
          sourceSegmentIndex: segment.sourceSegmentIndex,
          sourceStartDistance: interpolateTracedDistance(segment, t0),
          sourceEndDistance: interpolateTracedDistance(segment, t1),
          isImplicitClosingEdge: segment.isImplicitClosingEdge
        })
      }
    }
  })

  return {
    splitSegments: result,
    cache: {
      segmentSignatures,
      pairEntries
    }
  }
}

export function splitTracedSegmentsByIntersections<T extends TracedLineSegment>(
  segments: T[]
): TracedLineSegment[]
export function splitTracedSegmentsByIntersections<T extends TracedLineSegment>(
  segments: T[],
  options: IncrementalSelfIntersectionOptions & { returnCache: true }
): SplitTracedSegmentsResult
export function splitTracedSegmentsByIntersections<T extends TracedLineSegment>(
  segments: T[],
  options: IncrementalSelfIntersectionOptions = {}
): TracedLineSegment[] | SplitTracedSegmentsResult {
  const result = splitTracedSegmentsByIntersectionsInternal(segments, options)
  return options.returnCache ? result : result.splitSegments
}

const evenOddContains = (point: Vec2, segments: LineSegment[]) => {
  let intersections = 0
  segments.forEach((segment) => {
    const { start, end } = segment
    if (start.y > point.y === end.y > point.y) {
      return
    }
    const x =
      start.x + ((point.y - start.y) * (end.x - start.x)) / (end.y - start.y)
    if (x > point.x + INTERSECTION_EPS) {
      intersections += 1
    }
  })
  return intersections % 2 === 1
}

const windingContains = (point: Vec2, segments: LineSegment[]) => {
  let winding = 0
  segments.forEach((segment) => {
    const { start, end } = segment
    if (start.y <= point.y) {
      if (end.y > point.y) {
        const value = cross(
          { x: end.x - start.x, y: end.y - start.y },
          { x: point.x - start.x, y: point.y - start.y }
        )
        if (value > INTERSECTION_EPS) {
          winding += 1
        }
      }
    } else if (end.y <= point.y) {
      const value = cross(
        { x: end.x - start.x, y: end.y - start.y },
        { x: point.x - start.x, y: point.y - start.y }
      )
      if (value < -INTERSECTION_EPS) {
        winding -= 1
      }
    }
  })
  return winding !== 0
}

const containsByFillRule = (
  point: Vec2,
  segments: LineSegment[],
  fillRule: SelfIntersectingFillRule
) =>
  fillRule === 'nonzero'
    ? windingContains(point, segments)
    : evenOddContains(point, segments)

export interface EvenOddLegalFaceBoundaryEdge {
  edgeId: string
  faceId: string
  oppositeFaceId: string | null
  oppositeFaceLegal: boolean
  start: Vec2
  end: Vec2
  startNodeDegree: number
  endNodeDegree: number
  sourceSegmentIndex?: number
  sourceStartDistance?: number
  sourceEndDistance?: number
  isImplicitClosingEdge?: boolean
  reversed: boolean
  legalSide: 'left' | 'right'
}

export interface EvenOddLegalFaceBoundary {
  faceId: string
  points: Vec2[]
  edges: EvenOddLegalFaceBoundaryEdge[]
  area: number
}

export interface EvenOddBoundaryContourEdge {
  edgeId: string
  contourId: string
  contourEdgeIndex?: number
  legalFaceId: string
  oppositeFaceId: string
  start: Vec2
  end: Vec2
  startNodeDegree?: number
  endNodeDegree?: number
  sourceSegmentIndex?: number
  sourceStartDistance?: number
  sourceEndDistance?: number
  isImplicitClosingEdge?: boolean
  reversed: boolean
  legalSide: 'left' | 'right'
}

export type EvenOddBoundaryContourDashDomainBreakKind =
  | 'authored-vertex'
  | 'self-intersection'
  | 'source-segment-boundary'
  | 'contour-seam'

export interface EvenOddBoundaryContourDashDomain {
  domainId: string
  contourId: string
  edges: EvenOddBoundaryContourEdge[]
  points: Vec2[]
  legalSide: 'left' | 'right'
  sourceSegmentIndex?: number
  sourceStartDistance?: number
  sourceEndDistance?: number
  reversed: boolean
  startBreakKind: EvenOddBoundaryContourDashDomainBreakKind
  endBreakKind: EvenOddBoundaryContourDashDomainBreakKind
  totalLength: number
}

export interface EvenOddBoundaryContour {
  contourId: string
  points: Vec2[]
  edges: EvenOddBoundaryContourEdge[]
  dashDomains: EvenOddBoundaryContourDashDomain[]
  legalSide: 'left' | 'right'
  legalFaceIds: string[]
  oppositeFaceId: string
  area: number
}

export interface SelfIntersectingEvenOddResolvedGeometry {
  fillRegions: PolygonRegion[]
  legalFaceBoundaries: EvenOddLegalFaceBoundary[]
  unfilledFaceBoundaries: EvenOddLegalFaceBoundary[]
  legalBoundaryContours: EvenOddBoundaryContour[]
  cache?: SelfIntersectionPairCache
}

const buildPlanarGraph = (
  segments: TracedLineSegment[],
  fillRule: SelfIntersectingFillRule = 'evenodd',
  options: IncrementalSelfIntersectionOptions & {
    inputAlreadySplit?: boolean
  } = {}
): PlanarGraph | null => {
  if (segments.length > MAX_OPEN_SEGMENTS) {
    return null
  }

  const splitSegments: TracedLineSegment[] = options.inputAlreadySplit
    ? segments
    : splitTracedSegmentsByIntersectionsInternal(segments, options)
        .splitSegments
  if (splitSegments.length === 0) {
    return null
  }

  const nodes = new Map<string, number>()
  const pointsList: Vec2[] = []
  const getNodeId = (point: Vec2) => {
    const key = toNodeKey(point)
    const existing = nodes.get(key)
    if (existing !== undefined) {
      return existing
    }
    const id = pointsList.length
    nodes.set(key, id)
    pointsList.push(point)
    return id
  }

  const edges: DirectedEdge[] = []
  const adjacency: number[][] = []
  const ensureAdjacency = (nodeId: number) => {
    if (!adjacency[nodeId]) {
      adjacency[nodeId] = []
    }
  }

  splitSegments.forEach((segment, segmentIndex) => {
    const from = getNodeId(segment.start)
    const to = getNodeId(segment.end)
    if (from === to) {
      return
    }
    const forwardIndex = edges.length
    const backwardIndex = edges.length + 1
    edges.push({
      from,
      to,
      angle: Math.atan2(
        segment.end.y - segment.start.y,
        segment.end.x - segment.start.x
      ),
      rev: backwardIndex,
      segmentIndex,
      reversed: false
    })
    edges.push({
      from: to,
      to: from,
      angle: Math.atan2(
        segment.start.y - segment.end.y,
        segment.start.x - segment.end.x
      ),
      rev: forwardIndex,
      segmentIndex,
      reversed: true
    })
    ensureAdjacency(from)
    ensureAdjacency(to)
    adjacency[from].push(forwardIndex)
    adjacency[to].push(backwardIndex)
  })

  adjacency.forEach((edgeIds) => {
    edgeIds.sort((a, b) => edges[a].angle - edges[b].angle)
  })
  const adjacencyPositionByEdgeId = new Int32Array(edges.length)
  adjacencyPositionByEdgeId.fill(-1)
  adjacency.forEach((edgeIds) => {
    edgeIds.forEach((edgeId, edgePosition) => {
      adjacencyPositionByEdgeId[edgeId] = edgePosition
    })
  })

  const visited = new Uint8Array(edges.length)
  const rawFaces: { points: Vec2[]; edgeIds: number[]; area: number }[] = []

  for (let edgeIndex = 0; edgeIndex < edges.length; edgeIndex += 1) {
    if (visited[edgeIndex] === 1) {
      continue
    }

    const face: Vec2[] = []
    const faceEdgeIds: number[] = []
    let currentEdge = edgeIndex
    let guard = 0

    while (visited[currentEdge] !== 1 && guard < edges.length * 2) {
      guard += 1
      visited[currentEdge] = 1
      const edge = edges[currentEdge]
      face.push(pointsList[edge.from])
      faceEdgeIds.push(currentEdge)

      const outgoing = adjacency[edge.to] ?? []
      const reverseIndex = adjacencyPositionByEdgeId[edge.rev] ?? -1
      if (reverseIndex === -1) {
        break
      }
      currentEdge =
        outgoing[(reverseIndex - 1 + outgoing.length) % outgoing.length]
      if (currentEdge === edgeIndex) {
        break
      }
    }

    const area = polygonArea(face)
    if (face.length < 3 || Math.abs(area) <= INTERSECTION_EPS) {
      continue
    }
    rawFaces.push({ points: face, edgeIds: faceEdgeIds, area })
  }

  const faceIndexByEdgeId = new Map<number, number>()
  const outerFaceIndex = rawFaces.reduce(
    (largestIndex, face, faceIndex) =>
      Math.abs(face.area) > Math.abs(rawFaces[largestIndex]?.area ?? 0)
        ? faceIndex
        : largestIndex,
    0
  )
  const faces = rawFaces.map((face, faceIndex) => {
    face.edgeIds.forEach((edgeId) => {
      faceIndexByEdgeId.set(edgeId, faceIndex)
    })
    const centroid = polygonCentroid(face.points, face.area)
    return {
      faceId: `face:${faceIndex}`,
      points: face.points,
      edgeIds: face.edgeIds,
      area: face.area,
      exterior: faceIndex === outerFaceIndex,
      legal:
        faceIndex === outerFaceIndex
          ? false
          : options.legalFacePolicy === 'bounded-faces'
            ? true
            : containsByFillRule(centroid, segments, fillRule)
    }
  })

  return {
    splitSegments,
    pointsList,
    nodeIdByKey: nodes,
    nodeDegreeById: pointsList.map(
      (_, nodeId) => adjacency[nodeId]?.length ?? 0
    ),
    edges,
    faces,
    faceIndexByEdgeId
  }
}

const toLegalFaceBoundaryEdge = (
  graph: PlanarGraph,
  face: PlanarFace,
  edgeId: number,
  boundaryIndex: number
): EvenOddLegalFaceBoundaryEdge | null => {
  const edge = graph.edges[edgeId]
  const segment = graph.splitSegments[edge.segmentIndex]
  if (!segment) {
    return null
  }
  const sourceStartDistance = edge.reversed
    ? segment.sourceEndDistance
    : segment.sourceStartDistance
  const sourceEndDistance = edge.reversed
    ? segment.sourceStartDistance
    : segment.sourceEndDistance
  const start = graph.pointsList[edge.from]
  const end = graph.pointsList[edge.to]
  const legalSide = face.area >= 0 ? ('left' as const) : ('right' as const)
  const reverseFaceIndex = graph.faceIndexByEdgeId.get(edge.rev)
  const reverseFace =
    reverseFaceIndex === undefined ? undefined : graph.faces[reverseFaceIndex]
  return {
    edgeId: `${face.faceId}:edge:${boundaryIndex}`,
    faceId: face.faceId,
    oppositeFaceId: reverseFace?.faceId ?? null,
    oppositeFaceLegal: reverseFace?.legal === true,
    start,
    end,
    startNodeDegree: graph.nodeDegreeById[edge.from] ?? 0,
    endNodeDegree: graph.nodeDegreeById[edge.to] ?? 0,
    sourceSegmentIndex: segment.sourceSegmentIndex,
    sourceStartDistance,
    sourceEndDistance,
    isImplicitClosingEdge: segment.isImplicitClosingEdge,
    reversed: edge.reversed,
    legalSide
  }
}

const buildFillFaceBoundariesFromGraph = (
  graph: PlanarGraph
): EvenOddLegalFaceBoundary[] => {
  const boundaries: EvenOddLegalFaceBoundary[] = []
  graph.faces.forEach((face) => {
    if (!face.legal) {
      return
    }

    const edges: EvenOddLegalFaceBoundaryEdge[] = []
    face.edgeIds.forEach((edgeId, boundaryIndex) => {
      const edge = toLegalFaceBoundaryEdge(graph, face, edgeId, boundaryIndex)
      if (edge) {
        edges.push(edge)
      }
    })
    boundaries.push({
      faceId: face.faceId,
      points: face.points,
      edges,
      area: face.area
    })
  })
  return boundaries
}

const buildUnfilledFaceBoundariesFromGraph = (
  graph: PlanarGraph
): EvenOddLegalFaceBoundary[] => {
  const boundaries: EvenOddLegalFaceBoundary[] = []
  graph.faces.forEach((face) => {
    if (face.legal || face.exterior) {
      return
    }

    const edges: EvenOddLegalFaceBoundaryEdge[] = []
    face.edgeIds.forEach((edgeId, boundaryIndex) => {
      const edge = toLegalFaceBoundaryEdge(graph, face, edgeId, boundaryIndex)
      if (edge) {
        edges.push(edge)
      }
    })
    boundaries.push({
      faceId: face.faceId,
      points: face.points,
      edges,
      area: face.area
    })
  })
  return boundaries
}

const buildFillFaceBoundaries = (
  segments: TracedLineSegment[]
): EvenOddLegalFaceBoundary[] => {
  const graph = buildPlanarGraph(segments, 'evenodd')
  return graph ? buildFillFaceBoundariesFromGraph(graph) : []
}

export const buildSelfIntersectingEvenOddLegalFaceBoundaries = (
  segments: TracedLineSegment[]
): EvenOddLegalFaceBoundary[] => buildFillFaceBoundaries(segments)

const getGraphNodeIdAtPoint = (graph: PlanarGraph, point: Vec2) => {
  const key = toNodeKey(point)
  return graph.nodeIdByKey.get(key) ?? -1
}

const getGraphNodeDegreeAtPoint = (graph: PlanarGraph, point: Vec2) => {
  const nodeId = getGraphNodeIdAtPoint(graph, point)
  return nodeId >= 0 ? (graph.nodeDegreeById[nodeId] ?? 0) : 0
}

const areSourceDistancesContinuous = (
  previous: EvenOddBoundaryContourEdge,
  next: EvenOddBoundaryContourEdge
) => {
  if (
    previous.sourceEndDistance === undefined ||
    next.sourceStartDistance === undefined
  ) {
    return true
  }

  return (
    Math.abs(previous.sourceEndDistance - next.sourceStartDistance) <=
    SOURCE_DISTANCE_EPS
  )
}

const canMergeContourEdgesIntoDashDomain = (
  graph: PlanarGraph,
  previous: EvenOddBoundaryContourEdge,
  next: EvenOddBoundaryContourEdge
) =>
  distance(previous.end, next.start) <= NODE_KEY_EPS &&
  previous.legalSide === next.legalSide &&
  previous.sourceSegmentIndex === next.sourceSegmentIndex &&
  previous.reversed === next.reversed &&
  areSourceDistancesContinuous(previous, next) &&
  (previous.endNodeDegree ?? getGraphNodeDegreeAtPoint(graph, previous.end)) <=
    2

const classifyDashDomainBreak = (
  graph: PlanarGraph,
  point: Vec2,
  incoming?: EvenOddBoundaryContourEdge,
  outgoing?: EvenOddBoundaryContourEdge
): EvenOddBoundaryContourDashDomainBreakKind => {
  const nodeDegree =
    incoming?.endNodeDegree ??
    outgoing?.startNodeDegree ??
    getGraphNodeDegreeAtPoint(graph, point)
  if (nodeDegree > 2) {
    return 'self-intersection'
  }

  if (!incoming || !outgoing) {
    return 'contour-seam'
  }

  if (
    incoming.sourceSegmentIndex !== outgoing.sourceSegmentIndex ||
    incoming.reversed !== outgoing.reversed
  ) {
    return 'source-segment-boundary'
  }

  return 'authored-vertex'
}

const getContourEdgeLength = (edge: EvenOddBoundaryContourEdge) =>
  distance(edge.start, edge.end)

const getDashDomainPoints = (edges: EvenOddBoundaryContourEdge[]) => {
  const points: Vec2[] = []
  edges.forEach((edge) => {
    if (points.length === 0) {
      points.push(edge.start)
    }
    const previous = points[points.length - 1]
    if (!previous || distance(previous, edge.end) > NODE_KEY_EPS) {
      points.push(edge.end)
    }
  })
  return points
}

const getDashDomainLength = (points: Vec2[]) =>
  points.reduce(
    (sum, point, index) =>
      index === 0 ? sum : sum + distance(points[index - 1], point),
    0
  )

const buildBoundaryContourDashDomains = (
  graph: PlanarGraph,
  contourId: string,
  edges: EvenOddBoundaryContourEdge[]
): EvenOddBoundaryContourDashDomain[] => {
  if (edges.length === 0) {
    return []
  }

  const groups: EvenOddBoundaryContourEdge[][] = []
  let active: EvenOddBoundaryContourEdge[] = []
  const flush = () => {
    if (active.length > 0) {
      groups.push(active)
      active = []
    }
  }

  edges.forEach((edge) => {
    const previous = active[active.length - 1]
    if (
      previous &&
      !canMergeContourEdgesIntoDashDomain(graph, previous, edge)
    ) {
      flush()
    }
    active.push(edge)
  })
  flush()

  if (groups.length > 1) {
    const firstGroup = groups[0]
    const lastGroup = groups[groups.length - 1]
    const firstEdge = firstGroup?.[0]
    const lastEdge = lastGroup?.[lastGroup.length - 1]
    if (
      firstGroup &&
      lastGroup &&
      firstEdge &&
      lastEdge &&
      canMergeContourEdgesIntoDashDomain(graph, lastEdge, firstEdge)
    ) {
      groups[0] = [...lastGroup, ...firstGroup]
      groups.pop()
    }
  }

  return groups.flatMap((domainEdges, domainIndex) => {
    const firstEdge = domainEdges[0]
    const lastEdge = domainEdges[domainEdges.length - 1]
    if (!firstEdge || !lastEdge) {
      return []
    }

    const points = getDashDomainPoints(domainEdges)
    const totalLength = getDashDomainLength(points)
    if (points.length < 2 || totalLength <= INTERSECTION_EPS) {
      return []
    }

    const firstEdgeIndex =
      firstEdge.contourEdgeIndex ?? edges.indexOf(firstEdge)
    const lastEdgeIndex = lastEdge.contourEdgeIndex ?? edges.indexOf(lastEdge)
    const previousEdge =
      firstEdgeIndex >= 0
        ? edges[(firstEdgeIndex - 1 + edges.length) % edges.length]
        : undefined
    const nextEdge =
      lastEdgeIndex >= 0 ? edges[(lastEdgeIndex + 1) % edges.length] : undefined
    const startBreakKind =
      domainEdges.length === edges.length &&
      lastEdge &&
      firstEdge &&
      canMergeContourEdgesIntoDashDomain(graph, lastEdge, firstEdge)
        ? 'contour-seam'
        : classifyDashDomainBreak(
            graph,
            firstEdge.start,
            previousEdge,
            firstEdge
          )
    const endBreakKind =
      domainEdges.length === edges.length &&
      lastEdge &&
      firstEdge &&
      canMergeContourEdgesIntoDashDomain(graph, lastEdge, firstEdge)
        ? 'contour-seam'
        : classifyDashDomainBreak(graph, lastEdge.end, lastEdge, nextEdge)

    return [
      {
        domainId: `${contourId}:domain:${domainIndex}`,
        contourId,
        edges: domainEdges,
        points,
        legalSide: firstEdge.legalSide,
        sourceSegmentIndex: firstEdge.sourceSegmentIndex,
        sourceStartDistance: firstEdge.sourceStartDistance,
        sourceEndDistance: lastEdge.sourceEndDistance,
        reversed: firstEdge.reversed,
        startBreakKind,
        endBreakKind,
        totalLength: domainEdges.reduce(
          (sum, edge) => sum + getContourEdgeLength(edge),
          0
        )
      }
    ]
  })
}

const buildBoundaryContoursFromGraph = (
  graph: PlanarGraph
): EvenOddBoundaryContour[] => {
  const areSamePoint = (a: Vec2, b: Vec2) => distance(a, b) <= NODE_KEY_EPS
  const splitClosedBoundaryCycles = <T extends { start: Vec2; end: Vec2 }>(
    edges: T[]
  ): T[][] => {
    const cycles: T[][] = []
    let active: T[] = []
    let activeStartIndexByKey = new Map<string, number>()
    const rebuildActiveStartIndex = () => {
      activeStartIndexByKey = new Map(
        active.map((activeEdge, activeIndex) => [
          toNodeKey(activeEdge.start),
          activeIndex
        ])
      )
    }

    edges.forEach((edge) => {
      const previous = active[active.length - 1]
      if (previous && !areSamePoint(previous.end, edge.start)) {
        if (
          active.length > 0 &&
          areSamePoint(active[active.length - 1].end, active[0].start)
        ) {
          cycles.push(active)
        }
        active = []
        activeStartIndexByKey.clear()
      }

      activeStartIndexByKey.set(toNodeKey(edge.start), active.length)
      active.push(edge)
      const endKey = toNodeKey(edge.end)
      const repeatedStartIndex = activeStartIndexByKey.get(endKey) ?? -1
      if (repeatedStartIndex === -1) {
        return
      }

      const cycle = active.slice(repeatedStartIndex)
      if (cycle.length > 0) {
        cycles.push(cycle)
      }
      active = active.slice(0, repeatedStartIndex)
      rebuildActiveStartIndex()
    })

    if (
      active.length > 0 &&
      areSamePoint(active[active.length - 1].end, active[0].start)
    ) {
      cycles.push(active)
    }

    return cycles
  }

  const contours: EvenOddBoundaryContour[] = []
  graph.faces.forEach((face) => {
    if (face.legal) {
      return
    }

    const rawEdges: (Omit<
      EvenOddBoundaryContourEdge,
      'edgeId' | 'contourId'
    > & {
      boundaryIndex: number
    })[] = []
    face.edgeIds.forEach((edgeId, boundaryIndex) => {
      const edge = graph.edges[edgeId]
      if (!edge) {
        return
      }
      const reverseFaceIndex = graph.faceIndexByEdgeId.get(edge.rev)
      const reverseFace =
        reverseFaceIndex === undefined
          ? undefined
          : graph.faces[reverseFaceIndex]
      if (!reverseFace?.legal) {
        return
      }

      const segment = graph.splitSegments[edge.segmentIndex]
      if (!segment) {
        return
      }
      const legalSide = face.area >= 0 ? ('right' as const) : ('left' as const)
      const sourceStartDistance = edge.reversed
        ? segment.sourceEndDistance
        : segment.sourceStartDistance
      const sourceEndDistance = edge.reversed
        ? segment.sourceStartDistance
        : segment.sourceEndDistance

      rawEdges.push({
        boundaryIndex,
        legalFaceId: reverseFace.faceId,
        oppositeFaceId: face.faceId,
        start: graph.pointsList[edge.from],
        end: graph.pointsList[edge.to],
        startNodeDegree: graph.nodeDegreeById[edge.from] ?? 0,
        endNodeDegree: graph.nodeDegreeById[edge.to] ?? 0,
        sourceSegmentIndex: segment.sourceSegmentIndex,
        sourceStartDistance,
        sourceEndDistance,
        isImplicitClosingEdge: segment.isImplicitClosingEdge,
        reversed: edge.reversed,
        legalSide
      })
    })

    if (rawEdges.length === 0) {
      return
    }

    const chains: (typeof rawEdges)[] = []
    let active: typeof rawEdges = []
    const flush = () => {
      if (active.length > 0) {
        chains.push(active)
        active = []
      }
    }

    rawEdges.forEach((edge) => {
      const previous = active[active.length - 1]
      if (
        previous &&
        (!areSamePoint(previous.end, edge.start) ||
          previous.legalSide !== edge.legalSide)
      ) {
        flush()
      }
      active.push(edge)
    })
    flush()

    if (chains.length > 1) {
      const first = chains[0]
      const last = chains[chains.length - 1]
      const firstEdge = first?.[0]
      const lastEdge = last?.[last.length - 1]
      if (
        first &&
        last &&
        firstEdge &&
        lastEdge &&
        firstEdge.legalSide === lastEdge.legalSide &&
        areSamePoint(lastEdge.end, firstEdge.start)
      ) {
        chains[0] = [...last, ...first]
        chains.pop()
      }
    }

    const cycles: (typeof rawEdges)[] = []
    chains.forEach((chain) => {
      cycles.push(...splitClosedBoundaryCycles(chain))
    })

    cycles.forEach((chain, chainIndex) => {
      const contourId = `contour:${face.faceId}:${chainIndex}`
      const firstEdge = chain[0]
      const lastEdge = chain[chain.length - 1]
      if (
        !firstEdge ||
        !lastEdge ||
        !areSamePoint(lastEdge.end, firstEdge.start)
      ) {
        return
      }
      const legalSide = firstEdge.legalSide
      const edges = chain.map((edge, edgeIndex) => ({
        ...edge,
        edgeId: `${contourId}:edge:${edgeIndex}`,
        contourId,
        contourEdgeIndex: edgeIndex
      }))
      const points: Vec2[] = []
      edges.forEach((edge) => {
        if (points.length === 0) {
          points.push(edge.start)
        }
        points.push(edge.end)
      })
      const dashDomains = buildBoundaryContourDashDomains(
        graph,
        contourId,
        edges
      )

      contours.push({
        contourId,
        points,
        edges,
        dashDomains,
        legalSide,
        legalFaceIds: Array.from(
          new Set(edges.map((edge) => edge.legalFaceId))
        ),
        oppositeFaceId: face.faceId,
        area: polygonArea(points)
      })
    })
  })
  return contours
}

export const buildSelfIntersectingEvenOddBoundaryContours = (
  segments: TracedLineSegment[]
): EvenOddBoundaryContour[] => {
  const graph = buildPlanarGraph(segments, 'evenodd')
  return graph ? buildBoundaryContoursFromGraph(graph) : []
}

export const buildSelfIntersectingResolvedGeometry = (
  segments: TracedLineSegment[],
  fillRule: SelfIntersectingFillRule = 'evenodd',
  options: IncrementalSelfIntersectionOptions = {}
): SelfIntersectingEvenOddResolvedGeometry => {
  const splitResult = measureSelfIntersectingPhase(
    'resolved self-intersecting geometry: intersections',
    () =>
      options.preSplitResult ??
      splitTracedSegmentsByIntersections(segments, {
        ...options,
        returnCache: true
      })
  )
  const graph = measureSelfIntersectingPhase(
    'resolved self-intersecting geometry: planar graph',
    () =>
      buildPlanarGraph(splitResult.splitSegments, fillRule, {
        inputAlreadySplit: true,
        legalFacePolicy: options.legalFacePolicy
      })
  )
  if (!graph) {
    return {
      fillRegions: [],
      legalFaceBoundaries: [],
      unfilledFaceBoundaries: [],
      legalBoundaryContours: [],
      cache: splitResult.cache
    }
  }

  const legalFaceBoundaries = measureSelfIntersectingPhase(
    'resolved self-intersecting geometry: legal face boundaries',
    () => buildFillFaceBoundariesFromGraph(graph)
  )
  const unfilledFaceBoundaries = measureSelfIntersectingPhase(
    'resolved self-intersecting geometry: unfilled face boundaries',
    () => buildUnfilledFaceBoundariesFromGraph(graph)
  )
  const legalBoundaryContours = measureSelfIntersectingPhase(
    'resolved self-intersecting geometry: boundary contours',
    () => buildBoundaryContoursFromGraph(graph)
  )
  return {
    legalFaceBoundaries,
    unfilledFaceBoundaries,
    fillRegions: legalFaceBoundaries.map((face) => ({
      polygons: [face.points]
    })),
    legalBoundaryContours,
    cache: splitResult.cache
  }
}

export const buildSelfIntersectingEvenOddResolvedGeometry = (
  segments: TracedLineSegment[]
): SelfIntersectingEvenOddResolvedGeometry =>
  buildSelfIntersectingResolvedGeometry(segments, 'evenodd')

export const buildSelfIntersectingPolylineLegalDomainRegions = (
  points: Vec2[]
): PolygonRegion[] => {
  if (points.length < 3) {
    return []
  }

  const segments: LineSegment[] = []
  for (let index = 0; index < points.length; index += 1) {
    const start = points[index]
    const end = points[(index + 1) % points.length]
    if (distance(start, end) > INTERSECTION_EPS) {
      segments.push({ start, end })
    }
  }

  return buildSelfIntersectingEvenOddResolvedGeometry(segments).fillRegions
}
