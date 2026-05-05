export interface Vec2 {
  x: number
  y: number
}

interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface CenterDashedOverlapCandidate {
  candidateId: string
  intervalId: string
  strokeId: string
  ownerKey?: string
  networkId?: string
  authoredVisibleIntervalIndex: number
  startDistance: number
  endDistance: number
  wrapsSeam: boolean
  previousVisibleIntervalId: string | null
  nextVisibleIntervalId: string | null
  polygons: Vec2[][]
}

export interface CenterDashedOverlapGraph {
  candidates: CenterDashedOverlapCandidate[]
  edges: [string, string][]
}

const EPSILON = 1e-6
const polygonBoundsCache = new WeakMap<Vec2[], Bounds>()

const getPolygonBounds = (polygon: Vec2[]): Bounds => {
  const cached = polygonBoundsCache.get(polygon)
  if (cached) {
    return cached
  }

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

  const bounds = Number.isFinite(minX)
    ? { minX, minY, maxX, maxY }
    : { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  polygonBoundsCache.set(polygon, bounds)
  return bounds
}

const getCandidateBounds = (
  candidate: CenterDashedOverlapCandidate
): Bounds => {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  candidate.polygons.forEach((polygon) => {
    const bounds = getPolygonBounds(polygon)
    minX = Math.min(minX, bounds.minX)
    minY = Math.min(minY, bounds.minY)
    maxX = Math.max(maxX, bounds.maxX)
    maxY = Math.max(maxY, bounds.maxY)
  })

  return Number.isFinite(minX)
    ? { minX, minY, maxX, maxY }
    : { minX: 0, minY: 0, maxX: 0, maxY: 0 }
}

const boundsOverlap = (a: Bounds, b: Bounds) =>
  a.minX <= b.maxX + EPSILON &&
  a.maxX + EPSILON >= b.minX &&
  a.minY <= b.maxY + EPSILON &&
  a.maxY + EPSILON >= b.minY

const orientation = (a: Vec2, b: Vec2, c: Vec2) =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)

const isPointOnSegment = (point: Vec2, start: Vec2, end: Vec2) => {
  const cross = orientation(start, end, point)
  if (Math.abs(cross) > EPSILON) {
    return false
  }

  return (
    point.x >= Math.min(start.x, end.x) - EPSILON &&
    point.x <= Math.max(start.x, end.x) + EPSILON &&
    point.y >= Math.min(start.y, end.y) - EPSILON &&
    point.y <= Math.max(start.y, end.y) + EPSILON
  )
}

const segmentsIntersect = (a1: Vec2, a2: Vec2, b1: Vec2, b2: Vec2) => {
  const o1 = orientation(a1, a2, b1)
  const o2 = orientation(a1, a2, b2)
  const o3 = orientation(b1, b2, a1)
  const o4 = orientation(b1, b2, a2)

  if (
    ((o1 > EPSILON && o2 < -EPSILON) || (o1 < -EPSILON && o2 > EPSILON)) &&
    ((o3 > EPSILON && o4 < -EPSILON) || (o3 < -EPSILON && o4 > EPSILON))
  ) {
    return true
  }

  return (
    isPointOnSegment(b1, a1, a2) ||
    isPointOnSegment(b2, a1, a2) ||
    isPointOnSegment(a1, b1, b2) ||
    isPointOnSegment(a2, b1, b2)
  )
}

const isPointInsidePolygon = (point: Vec2, polygon: Vec2[]) => {
  let inside = false

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const current = polygon[i]
    const previous = polygon[j]

    if (isPointOnSegment(point, previous, current)) {
      return true
    }

    const intersects =
      current.y > point.y !== previous.y > point.y &&
      point.x <
        ((previous.x - current.x) * (point.y - current.y)) /
          (previous.y - current.y) +
          current.x

    if (intersects) {
      inside = !inside
    }
  }

  return inside
}

const signedArea = (polygon: Vec2[]) => {
  let area = 0

  for (let index = 0; index < polygon.length; index += 1) {
    const nextIndex = (index + 1) % polygon.length
    area +=
      polygon[index].x * polygon[nextIndex].y -
      polygon[nextIndex].x * polygon[index].y
  }

  return area / 2
}

const isInsideHalfPlane = (
  point: Vec2,
  edgeStart: Vec2,
  edgeEnd: Vec2,
  orientationKind: 'cw' | 'ccw'
) => {
  const cross = orientation(edgeStart, edgeEnd, point)
  return orientationKind === 'ccw' ? cross >= -EPSILON : cross <= EPSILON
}

const lineIntersection = (
  segmentStart: Vec2,
  segmentEnd: Vec2,
  clipStart: Vec2,
  clipEnd: Vec2
): Vec2 => {
  const x1 = segmentStart.x
  const y1 = segmentStart.y
  const x2 = segmentEnd.x
  const y2 = segmentEnd.y
  const x3 = clipStart.x
  const y3 = clipStart.y
  const x4 = clipEnd.x
  const y4 = clipEnd.y

  const denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)
  if (Math.abs(denominator) <= EPSILON) {
    return segmentEnd
  }

  const determinant1 = x1 * y2 - y1 * x2
  const determinant2 = x3 * y4 - y3 * x4

  return {
    x: (determinant1 * (x3 - x4) - (x1 - x2) * determinant2) / denominator,
    y: (determinant1 * (y3 - y4) - (y1 - y2) * determinant2) / denominator
  }
}

const dedupePolygon = (polygon: Vec2[]) => {
  const result: Vec2[] = []

  polygon.forEach((point) => {
    const previous = result[result.length - 1]
    if (
      !previous ||
      Math.abs(previous.x - point.x) > EPSILON ||
      Math.abs(previous.y - point.y) > EPSILON
    ) {
      result.push(point)
    }
  })

  const first = result[0]
  const last = result[result.length - 1]
  if (
    first &&
    last &&
    result.length > 1 &&
    Math.abs(first.x - last.x) <= EPSILON &&
    Math.abs(first.y - last.y) <= EPSILON
  ) {
    result.pop()
  }

  return result
}

export const polygonsHavePositiveAreaOverlap = (
  left: Vec2[],
  right: Vec2[]
) => {
  const boundsA = getPolygonBounds(left)
  const boundsB = getPolygonBounds(right)

  if (!boundsOverlap(boundsA, boundsB)) {
    return false
  }

  let output = [...left]
  const orientationKind = signedArea(right) >= 0 ? 'ccw' : 'cw'

  for (let index = 0; index < right.length; index += 1) {
    const clipStart = right[index]
    const clipEnd = right[(index + 1) % right.length]
    const input = output
    output = []

    if (input.length === 0) {
      break
    }

    let previous = input[input.length - 1]
    let previousInside = isInsideHalfPlane(
      previous,
      clipStart,
      clipEnd,
      orientationKind
    )

    input.forEach((current) => {
      const currentInside = isInsideHalfPlane(
        current,
        clipStart,
        clipEnd,
        orientationKind
      )

      if (currentInside) {
        if (!previousInside) {
          output.push(lineIntersection(previous, current, clipStart, clipEnd))
        }
        output.push(current)
      } else if (previousInside) {
        output.push(lineIntersection(previous, current, clipStart, clipEnd))
      }

      previous = current
      previousInside = currentInside
    })
  }

  const intersection = dedupePolygon(output)
  return (
    intersection.length >= 3 && Math.abs(signedArea(intersection)) > EPSILON
  )
}

const polygonsOverlap = (a: Vec2[], b: Vec2[]) => {
  const boundsA = getPolygonBounds(a)
  const boundsB = getPolygonBounds(b)

  if (!boundsOverlap(boundsA, boundsB)) {
    return false
  }

  for (let index = 0; index < a.length; index += 1) {
    const nextIndex = (index + 1) % a.length
    for (let otherIndex = 0; otherIndex < b.length; otherIndex += 1) {
      const nextOtherIndex = (otherIndex + 1) % b.length
      if (
        segmentsIntersect(
          a[index],
          a[nextIndex],
          b[otherIndex],
          b[nextOtherIndex]
        )
      ) {
        return true
      }
    }
  }

  return isPointInsidePolygon(a[0], b) || isPointInsidePolygon(b[0], a)
}

const candidatesOverlap = (
  left: CenterDashedOverlapCandidate,
  right: CenterDashedOverlapCandidate
) =>
  left.polygons.some((leftPolygon) =>
    right.polygons.some((rightPolygon) =>
      polygonsOverlap(leftPolygon, rightPolygon)
    )
  )

export const buildCenterDashedOverlapGraph = (
  candidates: CenterDashedOverlapCandidate[]
): CenterDashedOverlapGraph => {
  const sortedCandidates = [...candidates].sort((left, right) =>
    left.candidateId.localeCompare(right.candidateId)
  )
  const boundsByCandidateId = new Map(
    sortedCandidates.map((candidate) => [
      candidate.candidateId,
      getCandidateBounds(candidate)
    ])
  )

  const edges: [string, string][] = []

  for (let leftIndex = 0; leftIndex < sortedCandidates.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < sortedCandidates.length;
      rightIndex += 1
    ) {
      const left = sortedCandidates[leftIndex]
      const right = sortedCandidates[rightIndex]
      const leftBounds = boundsByCandidateId.get(left.candidateId)
      const rightBounds = boundsByCandidateId.get(right.candidateId)
      if (
        leftBounds &&
        rightBounds &&
        boundsOverlap(leftBounds, rightBounds) &&
        candidatesOverlap(left, right)
      ) {
        edges.push([left.candidateId, right.candidateId])
      }
    }
  }

  return {
    candidates: sortedCandidates,
    edges
  }
}

export const extractCenterDashedOverlapComponents = (
  graph: CenterDashedOverlapGraph
) => {
  const adjacency = new Map<string, string[]>()

  graph.candidates.forEach((candidate) => {
    adjacency.set(candidate.candidateId, [])
  })

  graph.edges.forEach(([left, right]) => {
    adjacency.get(left)?.push(right)
    adjacency.get(right)?.push(left)
  })

  adjacency.forEach((neighbors) => {
    neighbors.sort((left, right) => left.localeCompare(right))
  })

  const visited = new Set<string>()
  const components: string[][] = []

  graph.candidates.forEach((candidate) => {
    if (visited.has(candidate.candidateId)) {
      return
    }

    const queue = [candidate.candidateId]
    const component: string[] = []
    visited.add(candidate.candidateId)

    while (queue.length > 0) {
      const current = queue.shift()
      if (!current) {
        continue
      }

      component.push(current)
      adjacency.get(current)?.forEach((neighbor) => {
        if (!visited.has(neighbor)) {
          visited.add(neighbor)
          queue.push(neighbor)
        }
      })
    }

    component.sort((left, right) => left.localeCompare(right))
    components.push(component)
  })

  return components.sort((left, right) => left[0].localeCompare(right[0]))
}
