import type { PolygonRegion } from './geometry-backend'

export interface Vec2 {
  x: number
  y: number
}

interface LineSegment {
  start: Vec2
  end: Vec2
}

interface DirectedEdge {
  from: number
  to: number
  angle: number
  rev: number
}

const INTERSECTION_EPS = 1e-6
const NODE_KEY_EPS = 1e-4
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

const splitSegmentsByIntersections = (segments: LineSegment[]) => {
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

  const result: LineSegment[] = []
  segments.forEach((segment, index) => {
    const params = uniqueSorted(splitParams[index])
    for (let paramIndex = 0; paramIndex < params.length - 1; paramIndex += 1) {
      const t0 = params[paramIndex]
      const t1 = params[paramIndex + 1]
      if (t1 - t0 <= INTERSECTION_EPS) {
        continue
      }
      const start = {
        x: segment.start.x + (segment.end.x - segment.start.x) * t0,
        y: segment.start.y + (segment.end.y - segment.start.y) * t0
      }
      const end = {
        x: segment.start.x + (segment.end.x - segment.start.x) * t1,
        y: segment.start.y + (segment.end.y - segment.start.y) * t1
      }
      if (distance(start, end) > INTERSECTION_EPS) {
        result.push({ start, end })
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

const buildFillFaces = (segments: LineSegment[]) => {
  if (segments.length > MAX_OPEN_SEGMENTS) {
    return []
  }

  const splitSegments = splitSegmentsByIntersections(segments)
  if (splitSegments.length === 0) {
    return []
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

  splitSegments.forEach((segment) => {
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
      rev: backwardIndex
    })
    edges.push({
      from: to,
      to: from,
      angle: Math.atan2(
        segment.start.y - segment.end.y,
        segment.start.x - segment.end.x
      ),
      rev: forwardIndex
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
  const faces: Vec2[][] = []

  for (let edgeIndex = 0; edgeIndex < edges.length; edgeIndex += 1) {
    if (visited[edgeIndex]) {
      continue
    }

    const face: Vec2[] = []
    let currentEdge = edgeIndex
    let guard = 0

    while (!visited[currentEdge] && guard < edges.length * 2) {
      guard += 1
      visited[currentEdge] = true
      const edge = edges[currentEdge]
      face.push(pointsList[edge.from])

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
    faces.push(face)
  }

  return faces.filter((face) => {
    const centroid = polygonCentroid(face)
    return evenOddContains(centroid, segments)
  })
}

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

  return buildFillFaces(segments).map((face) => ({ polygons: [face] }))
}
