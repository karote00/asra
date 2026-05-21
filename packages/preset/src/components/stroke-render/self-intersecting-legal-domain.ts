import type { PolygonRegion } from './geometry-backend'

export interface Vec2 {
  x: number
  y: number
}

interface LineSegment {
  start: Vec2
  end: Vec2
}

export interface TracedLineSegment extends LineSegment {
  sourceSegmentIndex?: number
  sourceStartDistance?: number
  sourceEndDistance?: number
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
}

interface PlanarGraph {
  splitSegments: TracedLineSegment[]
  pointsList: Vec2[]
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

const polygonArea = (points: Vec2[]) => {
  let area = 0
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]
    const next = points[(index + 1) % points.length]
    area += current.x * next.y - next.x * current.y
  }
  return area / 2
}

const polygonCentroid = (points: Vec2[]) => {
  const area = polygonArea(points)
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

export const splitTracedSegmentsByIntersections = <T extends TracedLineSegment>(
  segments: T[]
): TracedLineSegment[] => {
  const splitParams = segments.map(() => [0, 1])

  for (let leftIndex = 0; leftIndex < segments.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < segments.length;
      rightIndex += 1
    ) {
      const intersection = segmentIntersection(
        segments[leftIndex],
        segments[rightIndex]
      )
      if (!intersection) {
        continue
      }
      splitParams[leftIndex].push(intersection.t)
      splitParams[rightIndex].push(intersection.u)
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
          sourceEndDistance: interpolateTracedDistance(segment, t1)
        })
      }
    }
  })

  return result
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
  legalFaceId: string
  oppositeFaceId: string
  start: Vec2
  end: Vec2
  sourceSegmentIndex?: number
  sourceStartDistance?: number
  sourceEndDistance?: number
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
  legalBoundaryContours: EvenOddBoundaryContour[]
}

const buildPlanarGraph = (
  segments: TracedLineSegment[],
  fillRule: SelfIntersectingFillRule = 'evenodd'
): PlanarGraph | null => {
  if (segments.length > MAX_OPEN_SEGMENTS) {
    return null
  }

  const splitSegments = splitTracedSegmentsByIntersections(segments)
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

  const visited = new Array(edges.length).fill(false)
  const rawFaces: { points: Vec2[]; edgeIds: number[] }[] = []

  for (let edgeIndex = 0; edgeIndex < edges.length; edgeIndex += 1) {
    if (visited[edgeIndex]) {
      continue
    }

    const face: Vec2[] = []
    const faceEdgeIds: number[] = []
    let currentEdge = edgeIndex
    let guard = 0

    while (!visited[currentEdge] && guard < edges.length * 2) {
      guard += 1
      visited[currentEdge] = true
      const edge = edges[currentEdge]
      face.push(pointsList[edge.from])
      faceEdgeIds.push(currentEdge)

      const outgoing = adjacency[edge.to] ?? []
      const reverseIndex = outgoing.indexOf(edge.rev)
      if (reverseIndex === -1) {
        break
      }
      currentEdge =
        outgoing[(reverseIndex - 1 + outgoing.length) % outgoing.length]
      if (currentEdge === edgeIndex) {
        break
      }
    }

    if (face.length < 3 || Math.abs(polygonArea(face)) <= INTERSECTION_EPS) {
      continue
    }
    rawFaces.push({ points: face, edgeIds: faceEdgeIds })
  }

  const faceIndexByEdgeId = new Map<number, number>()
  const outerFaceIndex = rawFaces.reduce(
    (largestIndex, face, faceIndex) =>
      Math.abs(polygonArea(face.points)) >
      Math.abs(polygonArea(rawFaces[largestIndex]?.points ?? []))
        ? faceIndex
        : largestIndex,
    0
  )
  const faces = rawFaces.map((face, faceIndex) => {
    face.edgeIds.forEach((edgeId) => {
      faceIndexByEdgeId.set(edgeId, faceIndex)
    })
    const centroid = polygonCentroid(face.points)
    return {
      faceId: `face:${faceIndex}`,
      points: face.points,
      edgeIds: face.edgeIds,
      area: polygonArea(face.points),
      legal:
        faceIndex === outerFaceIndex
          ? false
          : containsByFillRule(centroid, segments, fillRule)
    }
  })

  return {
    splitSegments,
    pointsList,
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
): EvenOddLegalFaceBoundaryEdge[] => {
  const edge = graph.edges[edgeId]
  const segment = graph.splitSegments[edge.segmentIndex]
  if (!segment) {
    return []
  }
  const sourceStartDistance = edge.reversed
    ? segment.sourceEndDistance
    : segment.sourceStartDistance
  const sourceEndDistance = edge.reversed
    ? segment.sourceStartDistance
    : segment.sourceEndDistance
  const start = graph.pointsList[edge.from]
  const end = graph.pointsList[edge.to]
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.hypot(dx, dy)
  const midpoint = {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2
  }
  const offset = 1e-3
  const leftProbe = {
    x: midpoint.x + (-dy / length) * offset,
    y: midpoint.y + (dx / length) * offset
  }
  const rightProbe = {
    x: midpoint.x - (-dy / length) * offset,
    y: midpoint.y - (dx / length) * offset
  }
  const leftInFace = evenOddContains(
    leftProbe,
    face.edgeIds.map((id) => {
      const faceEdge = graph.edges[id]
      return {
        start: graph.pointsList[faceEdge.from],
        end: graph.pointsList[faceEdge.to]
      }
    })
  )
  const rightInFace = evenOddContains(
    rightProbe,
    face.edgeIds.map((id) => {
      const faceEdge = graph.edges[id]
      return {
        start: graph.pointsList[faceEdge.from],
        end: graph.pointsList[faceEdge.to]
      }
    })
  )
  const fallbackLegalSide = face.area >= 0 ? 'left' : 'right'
  const legalSide =
    leftInFace && !rightInFace
      ? ('left' as const)
      : rightInFace && !leftInFace
        ? ('right' as const)
        : fallbackLegalSide
  const reverseFaceIndex = graph.faceIndexByEdgeId.get(edge.rev)
  const reverseFace =
    reverseFaceIndex === undefined ? undefined : graph.faces[reverseFaceIndex]
  return [
    {
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
      reversed: edge.reversed,
      legalSide
    }
  ]
}

const buildFillFaceBoundariesFromGraph = (
  graph: PlanarGraph
): EvenOddLegalFaceBoundary[] =>
  graph.faces.flatMap((face) =>
    face.legal
      ? [
          {
            faceId: face.faceId,
            points: face.points,
            edges: face.edgeIds.flatMap((edgeId, boundaryIndex) =>
              toLegalFaceBoundaryEdge(graph, face, edgeId, boundaryIndex)
            ),
            area: face.area
          }
        ]
      : []
  )

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
  return graph.pointsList.findIndex((candidate) => toNodeKey(candidate) === key)
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
  getGraphNodeDegreeAtPoint(graph, previous.end) <= 2

const classifyDashDomainBreak = (
  graph: PlanarGraph,
  point: Vec2,
  incoming?: EvenOddBoundaryContourEdge,
  outgoing?: EvenOddBoundaryContourEdge
): EvenOddBoundaryContourDashDomainBreakKind => {
  if (getGraphNodeDegreeAtPoint(graph, point) > 2) {
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

    const firstEdgeIndex = edges.indexOf(firstEdge)
    const lastEdgeIndex = edges.indexOf(lastEdge)
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
  graph: PlanarGraph,
  fillRule: SelfIntersectingFillRule
): EvenOddBoundaryContour[] => {
  const areSamePoint = (a: Vec2, b: Vec2) => distance(a, b) <= NODE_KEY_EPS
  const splitClosedBoundaryCycles = <T extends { start: Vec2; end: Vec2 }>(
    edges: T[]
  ): T[][] => {
    const cycles: T[][] = []
    let active: T[] = []

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
      }

      active.push(edge)
      const endKey = toNodeKey(edge.end)
      const repeatedStartIndex = active.findIndex(
        (activeEdge) => toNodeKey(activeEdge.start) === endKey
      )
      if (repeatedStartIndex === -1) {
        return
      }

      const cycle = active.slice(repeatedStartIndex)
      if (cycle.length > 0) {
        cycles.push(cycle)
      }
      active = active.slice(0, repeatedStartIndex)
    })

    if (
      active.length > 0 &&
      areSamePoint(active[active.length - 1].end, active[0].start)
    ) {
      cycles.push(active)
    }

    return cycles
  }

  return graph.faces.flatMap((face) => {
    if (face.legal) {
      return []
    }

    const rawEdges = face.edgeIds.flatMap((edgeId, boundaryIndex) => {
      const edge = graph.edges[edgeId]
      const reverseFaceIndex = graph.faceIndexByEdgeId.get(edge.rev)
      const reverseFace =
        reverseFaceIndex === undefined
          ? undefined
          : graph.faces[reverseFaceIndex]
      if (!reverseFace?.legal) {
        return []
      }

      const segment = graph.splitSegments[edge.segmentIndex]
      if (!segment) {
        return []
      }
      const edgeStart = graph.pointsList[edge.from]
      const edgeEnd = graph.pointsList[edge.to]
      const edgeDx = edgeEnd.x - edgeStart.x
      const edgeDy = edgeEnd.y - edgeStart.y
      const edgeLength = Math.hypot(edgeDx, edgeDy)
      if (edgeLength <= INTERSECTION_EPS) {
        return []
      }
      const midpoint = {
        x: (edgeStart.x + edgeEnd.x) / 2,
        y: (edgeStart.y + edgeEnd.y) / 2
      }
      const probeDistance = 1e-3
      const leftProbe = {
        x: midpoint.x + (-edgeDy / edgeLength) * probeDistance,
        y: midpoint.y + (edgeDx / edgeLength) * probeDistance
      }
      const rightProbe = {
        x: midpoint.x - (-edgeDy / edgeLength) * probeDistance,
        y: midpoint.y - (edgeDx / edgeLength) * probeDistance
      }
      const leftLegal = containsByFillRule(
        leftProbe,
        graph.splitSegments,
        fillRule
      )
      const rightLegal = containsByFillRule(
        rightProbe,
        graph.splitSegments,
        fillRule
      )
      const fallbackLegalSide =
        face.area >= 0 ? ('right' as const) : ('left' as const)
      const legalSide =
        leftLegal && !rightLegal
          ? ('left' as const)
          : rightLegal && !leftLegal
            ? ('right' as const)
            : fallbackLegalSide
      const sourceStartDistance = edge.reversed
        ? segment.sourceEndDistance
        : segment.sourceStartDistance
      const sourceEndDistance = edge.reversed
        ? segment.sourceStartDistance
        : segment.sourceEndDistance

      return [
        {
          boundaryIndex,
          legalFaceId: reverseFace.faceId,
          oppositeFaceId: face.faceId,
          start: graph.pointsList[edge.from],
          end: graph.pointsList[edge.to],
          sourceSegmentIndex: segment.sourceSegmentIndex,
          sourceStartDistance,
          sourceEndDistance,
          reversed: edge.reversed,
          legalSide
        }
      ]
    })

    if (rawEdges.length === 0) {
      return []
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

    const cycles = chains.flatMap((chain) => splitClosedBoundaryCycles(chain))

    return cycles.flatMap((chain, chainIndex) => {
      const contourId = `contour:${face.faceId}:${chainIndex}`
      const firstEdge = chain[0]
      const lastEdge = chain[chain.length - 1]
      if (
        !firstEdge ||
        !lastEdge ||
        !areSamePoint(lastEdge.end, firstEdge.start)
      ) {
        return []
      }
      const legalSide = firstEdge.legalSide
      const edges = chain.map((edge, edgeIndex) => ({
        ...edge,
        edgeId: `${contourId}:edge:${edgeIndex}`,
        contourId
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

      return [
        {
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
        }
      ]
    })
  })
}

export const buildSelfIntersectingEvenOddBoundaryContours = (
  segments: TracedLineSegment[]
): EvenOddBoundaryContour[] => {
  const graph = buildPlanarGraph(segments, 'evenodd')
  return graph ? buildBoundaryContoursFromGraph(graph, 'evenodd') : []
}

export const buildSelfIntersectingResolvedGeometry = (
  segments: TracedLineSegment[],
  fillRule: SelfIntersectingFillRule = 'evenodd'
): SelfIntersectingEvenOddResolvedGeometry => {
  const graph = buildPlanarGraph(segments, fillRule)
  if (!graph) {
    return {
      fillRegions: [],
      legalFaceBoundaries: [],
      legalBoundaryContours: []
    }
  }

  const legalFaceBoundaries = buildFillFaceBoundariesFromGraph(graph)
  return {
    legalFaceBoundaries,
    fillRegions: legalFaceBoundaries.map((face) => ({
      polygons: [face.points]
    })),
    legalBoundaryContours: buildBoundaryContoursFromGraph(graph, fillRule)
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
