import type { SolidCenterStrokeResolvedPacket } from './solid-center-stroke-packets'

interface Vec2 {
  x: number
  y: number
}

interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

interface ConstrainedSolidOwnershipCandidate {
  candidateId: string
  strokeId: string
  strokeIndex?: number
  ownerKey?: string
  polygons: Vec2[][]
  bounds: Bounds
}

interface ConstrainedSolidOwnershipComponentDiagnostic {
  componentId: string
  candidateIds: string[]
  bounds: Bounds
  polygons: Vec2[][]
}

export interface ConstrainedSolidOwnershipRegionDiagnostic {
  regionId: string
  candidateIds: string[]
  ownerStrokeId: string
  ownerStrokeIndex?: number
  ownerKey?: string
  bounds: Bounds
  polygon: Vec2[]
}

export interface ConstrainedSolidArrangementPolicyDiagnostic {
  strategy: 'bounded-convex-subset-arrangement'
  epsilon: number
  roundingFactor: number
  maxExactSubsetCount: number
  zeroAreaThreshold: number
  tangentialTouchPolicy: 'boundary-overlap-without-zero-area-face'
  coincidentEdgePolicy: 'dedupe-rotated-polygon-signatures'
}

export interface ConstrainedSolidArrangementFaceDiagnostic {
  faceId: string
  candidateIds: string[]
  ownerStrokeId: string
  ownerStrokeIndex?: number
  ownerKey?: string
  bounds: Bounds
  polygon: Vec2[]
  partitionMethod:
    | 'exact-subset-intersection'
    | 'intra-candidate-intersection'
    | 'bounded-overlap-polygon'
}

export interface ConstrainedSolidOwnershipDiagnostics {
  arrangementPolicy: ConstrainedSolidArrangementPolicyDiagnostic
  candidates: ConstrainedSolidOwnershipCandidate[]
  edges: [string, string][]
  components: ConstrainedSolidOwnershipComponentDiagnostic[]
  arrangementFaces: ConstrainedSolidArrangementFaceDiagnostic[]
  ownedRegions: ConstrainedSolidOwnershipRegionDiagnostic[]
}

export interface ConstrainedSolidOwnershipDiagnosticsRuntimeGraphic {
  __asyraConstrainedSolidOwnershipDiagnostics?: ConstrainedSolidOwnershipDiagnostics
}

const EPSILON = 1e-6
const ROUNDING_FACTOR = 1_000
const MAX_EXACT_SUBSET_COUNT = 4096
const polygonBoundsCache = new WeakMap<Vec2[], Bounds>()
const convexPiecesCache = new WeakMap<Vec2[], Vec2[][]>()

const ARRANGEMENT_POLICY: ConstrainedSolidArrangementPolicyDiagnostic = {
  strategy: 'bounded-convex-subset-arrangement',
  epsilon: EPSILON,
  roundingFactor: ROUNDING_FACTOR,
  maxExactSubsetCount: MAX_EXACT_SUBSET_COUNT,
  zeroAreaThreshold: EPSILON,
  tangentialTouchPolicy: 'boundary-overlap-without-zero-area-face',
  coincidentEdgePolicy: 'dedupe-rotated-polygon-signatures'
}

export const createEmptyConstrainedSolidOwnershipDiagnostics =
  (): ConstrainedSolidOwnershipDiagnostics => ({
    arrangementPolicy: ARRANGEMENT_POLICY,
    candidates: [],
    edges: [],
    components: [],
    arrangementFaces: [],
    ownedRegions: []
  })

const roundCoordinate = (value: number) =>
  Math.round(value * ROUNDING_FACTOR) / ROUNDING_FACTOR

const getBounds = (polygons: Vec2[][]): Bounds => {
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

  if (!Number.isFinite(minX)) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  }

  return { minX, minY, maxX, maxY }
}

const getPolygonBounds = (polygon: Vec2[]): Bounds => {
  const cached = polygonBoundsCache.get(polygon)
  if (cached) {
    return cached
  }

  const bounds = getBounds([polygon])
  polygonBoundsCache.set(polygon, bounds)
  return bounds
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

const polygonsOverlap = (left: Vec2[], right: Vec2[]) => {
  const leftBounds = getPolygonBounds(left)
  const rightBounds = getPolygonBounds(right)

  if (!boundsOverlap(leftBounds, rightBounds)) {
    return false
  }

  for (let leftIndex = 0; leftIndex < left.length; leftIndex += 1) {
    const leftNextIndex = (leftIndex + 1) % left.length
    for (let rightIndex = 0; rightIndex < right.length; rightIndex += 1) {
      const rightNextIndex = (rightIndex + 1) % right.length
      if (
        segmentsIntersect(
          left[leftIndex],
          left[leftNextIndex],
          right[rightIndex],
          right[rightNextIndex]
        )
      ) {
        return true
      }
    }
  }

  return (
    isPointInsidePolygon(left[0], right) || isPointInsidePolygon(right[0], left)
  )
}

const candidatesOverlap = (
  left: ConstrainedSolidOwnershipCandidate,
  right: ConstrainedSolidOwnershipCandidate
) =>
  boundsOverlap(left.bounds, right.bounds) &&
  left.polygons.some((leftPolygon) =>
    right.polygons.some((rightPolygon) =>
      polygonsOverlap(leftPolygon, rightPolygon)
    )
  )

const buildCandidates = (packets: SolidCenterStrokeResolvedPacket[]) =>
  packets.map((packet, index) => ({
    candidateId: `candidate:${index}`,
    strokeId: packet.geometry.debugMeta?.strokeId ?? `stroke:${index}`,
    strokeIndex: packet.geometry.debugMeta?.strokeIndex,
    ownerKey: packet.geometry.debugMeta?.ownerKey,
    polygons: packet.geometry.polygons,
    bounds: packet.geometry.bounds
  }))

const getOwnerCandidate = (candidates: ConstrainedSolidOwnershipCandidate[]) =>
  [...candidates].sort((left, right) =>
    Number.isFinite(left.strokeIndex) && Number.isFinite(right.strokeIndex)
      ? (left.strokeIndex as number) - (right.strokeIndex as number) ||
        left.strokeId.localeCompare(right.strokeId)
      : left.strokeId.localeCompare(right.strokeId)
  )[0]

const buildEdges = (candidates: ConstrainedSolidOwnershipCandidate[]) => {
  const sortedCandidates = [...candidates].sort((left, right) =>
    left.candidateId.localeCompare(right.candidateId)
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
      if (candidatesOverlap(left, right)) {
        edges.push([left.candidateId, right.candidateId])
      }
    }
  }

  return edges
}

const extractComponents = (
  candidates: ConstrainedSolidOwnershipCandidate[],
  edges: [string, string][]
) => {
  const candidateById = new Map(
    candidates.map((candidate) => [candidate.candidateId, candidate])
  )
  const adjacency = new Map<string, string[]>()
  candidates.forEach((candidate) => {
    adjacency.set(candidate.candidateId, [])
  })

  edges.forEach(([left, right]) => {
    adjacency.get(left)?.push(right)
    adjacency.get(right)?.push(left)
  })

  adjacency.forEach((neighbors) =>
    neighbors.sort((left, right) => left.localeCompare(right))
  )

  const visited = new Set<string>()
  const components: ConstrainedSolidOwnershipComponentDiagnostic[] = []

  candidates.forEach((candidate) => {
    if (visited.has(candidate.candidateId)) {
      return
    }

    const queue = [candidate.candidateId]
    const candidateIds: string[] = []
    visited.add(candidate.candidateId)

    while (queue.length > 0) {
      const current = queue.shift()
      if (!current) {
        continue
      }

      candidateIds.push(current)
      adjacency.get(current)?.forEach((neighbor) => {
        if (!visited.has(neighbor)) {
          visited.add(neighbor)
          queue.push(neighbor)
        }
      })
    }

    candidateIds.sort((left, right) => left.localeCompare(right))
    const componentCandidates = candidateIds
      .map((candidateId) => candidateById.get(candidateId))
      .filter((entry): entry is ConstrainedSolidOwnershipCandidate => !!entry)
    const polygons = componentCandidates.flatMap(({ polygons }) => polygons)

    components.push({
      componentId: `component:${components.length}`,
      candidateIds,
      bounds: getBounds(polygons),
      polygons
    })
  })

  return components.sort((left, right) =>
    left.componentId.localeCompare(right.componentId)
  )
}

const buildRegionKey = (candidateIds: string[], bounds: Bounds) =>
  [
    candidateIds.join('|'),
    roundCoordinate(bounds.minX),
    roundCoordinate(bounds.minY),
    roundCoordinate(bounds.maxX),
    roundCoordinate(bounds.maxY)
  ].join(':')

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
    const normalizedPoint = {
      x: Math.abs(point.x) <= EPSILON ? 0 : point.x,
      y: Math.abs(point.y) <= EPSILON ? 0 : point.y
    }
    const previous = result[result.length - 1]
    if (
      !previous ||
      Math.abs(previous.x - normalizedPoint.x) > EPSILON ||
      Math.abs(previous.y - normalizedPoint.y) > EPSILON
    ) {
      result.push(normalizedPoint)
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

const clipPolygonToConvexBoundary = (
  polygon: Vec2[],
  boundary: Vec2[],
  orientationKind: 'cw' | 'ccw'
) => {
  let output = [...polygon]

  for (let index = 0; index < boundary.length; index += 1) {
    const clipStart = boundary[index]
    const clipEnd = boundary[(index + 1) % boundary.length]
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

  return dedupePolygon(output)
}

const pointsEqual = (left: Vec2, right: Vec2) =>
  Math.abs(left.x - right.x) <= EPSILON && Math.abs(left.y - right.y) <= EPSILON

const polygonsEqual = (left: Vec2[], right: Vec2[]) => {
  if (left.length !== right.length) {
    return false
  }

  const matchesAtRotation = (candidate: Vec2[]) =>
    left.every((point, index) => pointsEqual(point, candidate[index]))

  for (let offset = 0; offset < right.length; offset += 1) {
    const rotated = right.map(
      (_, index) => right[(index + offset) % right.length]
    )
    if (matchesAtRotation(rotated)) {
      return true
    }

    const reversed = [...rotated].reverse()
    if (matchesAtRotation(reversed)) {
      return true
    }
  }

  return false
}

const polygonListContains = (polygons: Vec2[][], candidate: Vec2[]) =>
  polygons.some((polygon) => polygonsEqual(polygon, candidate))

const isOrthogonalPolygon = (polygon: Vec2[]) =>
  polygon.every((point, index) => {
    const next = polygon[(index + 1) % polygon.length]
    return (
      Math.abs(point.x - next.x) <= EPSILON ||
      Math.abs(point.y - next.y) <= EPSILON
    )
  })

const isConvexPolygon = (polygon: Vec2[]) => {
  if (polygon.length < 4) {
    return true
  }

  const orientationKind = signedArea(polygon) >= 0 ? 'ccw' : 'cw'

  for (let index = 0; index < polygon.length; index += 1) {
    const previous = polygon[(index - 1 + polygon.length) % polygon.length]
    const current = polygon[index]
    const next = polygon[(index + 1) % polygon.length]
    const cross = orientation(previous, current, next)

    if (Math.abs(cross) <= EPSILON) {
      continue
    }

    if (orientationKind === 'ccw' ? cross < -EPSILON : cross > EPSILON) {
      return false
    }
  }

  return true
}

const isPointInTriangle = (point: Vec2, triangle: Vec2[]) => {
  const [a, b, c] = triangle
  const triangleArea = signedArea(triangle)
  const orientationKind = triangleArea >= 0 ? 'ccw' : 'cw'

  const ab = orientation(a, b, point)
  const bc = orientation(b, c, point)
  const ca = orientation(c, a, point)

  return orientationKind === 'ccw'
    ? ab >= -EPSILON && bc >= -EPSILON && ca >= -EPSILON
    : ab <= EPSILON && bc <= EPSILON && ca <= EPSILON
}

const decomposeSimplePolygonToTriangles = (polygon: Vec2[]) => {
  const remaining = dedupePolygon(polygon)

  if (remaining.length < 4) {
    return [remaining]
  }

  const orientationKind = signedArea(remaining) >= 0 ? 'ccw' : 'cw'
  const triangles: Vec2[][] = []
  let guard = 0

  while (remaining.length > 3 && guard < polygon.length * polygon.length) {
    let earFound = false

    for (let index = 0; index < remaining.length; index += 1) {
      const previousIndex = (index - 1 + remaining.length) % remaining.length
      const nextIndex = (index + 1) % remaining.length
      const previous = remaining[previousIndex]
      const current = remaining[index]
      const next = remaining[nextIndex]
      const cross = orientation(previous, current, next)

      if (Math.abs(cross) <= EPSILON) {
        continue
      }

      if (orientationKind === 'ccw' ? cross < -EPSILON : cross > EPSILON) {
        continue
      }

      const triangle = dedupePolygon([previous, current, next])
      if (triangle.length < 3 || Math.abs(signedArea(triangle)) <= EPSILON) {
        continue
      }

      const containsOtherVertex = remaining.some((point, pointIndex) => {
        if (
          pointIndex === previousIndex ||
          pointIndex === index ||
          pointIndex === nextIndex
        ) {
          return false
        }

        return isPointInTriangle(point, triangle)
      })

      if (containsOtherVertex) {
        continue
      }

      triangles.push(triangle)
      remaining.splice(index, 1)
      earFound = true
      break
    }

    if (!earFound) {
      return [polygon]
    }

    guard += 1
  }

  if (remaining.length === 3 && Math.abs(signedArea(remaining)) > EPSILON) {
    triangles.push(dedupePolygon(remaining))
  }

  return triangles.length > 0 ? triangles : [polygon]
}

const decomposeOrthogonalPolygonToRectangles = (polygon: Vec2[]) => {
  if (!isOrthogonalPolygon(polygon)) {
    return [polygon]
  }

  const yLevels = [
    ...new Set(polygon.map((point) => roundCoordinate(point.y)))
  ].sort((left, right) => left - right)
  const rectangles: Vec2[][] = []

  for (let index = 0; index < yLevels.length - 1; index += 1) {
    const top = yLevels[index]
    const bottom = yLevels[index + 1]

    if (bottom - top <= EPSILON) {
      continue
    }

    const sampleY = (top + bottom) / 2
    const intersections = polygon
      .flatMap((point, pointIndex) => {
        const next = polygon[(pointIndex + 1) % polygon.length]
        if (Math.abs(point.x - next.x) > EPSILON) {
          return []
        }

        const minY = Math.min(point.y, next.y)
        const maxY = Math.max(point.y, next.y)

        return sampleY > minY + EPSILON && sampleY < maxY - EPSILON
          ? [point.x]
          : []
      })
      .sort((left, right) => left - right)

    for (
      let intersectionIndex = 0;
      intersectionIndex < intersections.length;
      intersectionIndex += 2
    ) {
      const left = intersections[intersectionIndex]
      const right = intersections[intersectionIndex + 1]

      if (
        left === undefined ||
        right === undefined ||
        right - left <= EPSILON
      ) {
        continue
      }

      const rectangle = dedupePolygon([
        { x: left, y: top },
        { x: right, y: top },
        { x: right, y: bottom },
        { x: left, y: bottom }
      ])

      if (
        rectangle.length >= 3 &&
        Math.abs(signedArea(rectangle)) > EPSILON &&
        !polygonListContains(rectangles, rectangle)
      ) {
        rectangles.push(rectangle)
      }
    }
  }

  return rectangles.length > 0 ? rectangles : [polygon]
}

const normalizePolygonToConvexPieces = (polygon: Vec2[]) => {
  const cached = convexPiecesCache.get(polygon)
  if (cached) {
    return cached
  }

  let pieces: Vec2[][]
  if (polygon.length < 4) {
    pieces = [polygon]
  } else if (isOrthogonalPolygon(polygon)) {
    pieces = decomposeOrthogonalPolygonToRectangles(polygon)
  } else if (isConvexPolygon(polygon)) {
    pieces = [polygon]
  } else {
    pieces = decomposeSimplePolygonToTriangles(polygon)
  }

  convexPiecesCache.set(polygon, pieces)
  return pieces
}

const intersectConvexPolygons = (left: Vec2[], right: Vec2[]) => {
  const orientationKind = signedArea(right) >= 0 ? 'ccw' : 'cw'
  const clipped = clipPolygonToConvexBoundary(left, right, orientationKind)

  if (clipped.length < 3 || Math.abs(signedArea(clipped)) <= EPSILON) {
    return []
  }

  return clipped
}

const polygonsHavePositiveAreaOverlap = (left: Vec2[], right: Vec2[]) =>
  boundsOverlap(getPolygonBounds(left), getPolygonBounds(right)) &&
  normalizePolygonToConvexPieces(left).some((leftPiece) =>
    normalizePolygonToConvexPieces(right).some((rightPiece) => {
      if (
        !boundsOverlap(
          getPolygonBounds(leftPiece),
          getPolygonBounds(rightPiece)
        )
      ) {
        return false
      }

      const intersection = intersectConvexPolygons(leftPiece, rightPiece)
      return (
        intersection.length >= 3 && Math.abs(signedArea(intersection)) > EPSILON
      )
    })
  )

const candidateOverlapsPolygon = (
  candidate: ConstrainedSolidOwnershipCandidate,
  polygon: Vec2[]
) =>
  candidate.polygons.some((candidatePolygon) =>
    polygonsHavePositiveAreaOverlap(candidatePolygon, polygon)
  )

const isPointOnBoundary = (point: Vec2, polygon: Vec2[]) =>
  polygon.some((start, index) => {
    const end = polygon[(index + 1) % polygon.length]
    return isPointOnSegment(point, start, end)
  })

const isPointStrictlyInsidePolygon = (point: Vec2, polygon: Vec2[]) => {
  if (isPointOnBoundary(point, polygon)) {
    return false
  }

  return isPointInsidePolygon(point, polygon)
}

const clipPolygonToOutsideHalfPlane = (
  polygon: Vec2[],
  edgeStart: Vec2,
  edgeEnd: Vec2,
  orientationKind: 'cw' | 'ccw'
) => {
  const input = [...polygon]
  const output: Vec2[] = []
  if (input.length === 0) {
    return output
  }

  let previous = input[input.length - 1]
  let previousOutside = !isInsideHalfPlane(
    previous,
    edgeStart,
    edgeEnd,
    orientationKind
  )

  input.forEach((current) => {
    const currentOutside = !isInsideHalfPlane(
      current,
      edgeStart,
      edgeEnd,
      orientationKind
    )

    if (currentOutside) {
      if (!previousOutside) {
        output.push(lineIntersection(previous, current, edgeStart, edgeEnd))
      }
      output.push(current)
    } else if (previousOutside) {
      output.push(lineIntersection(previous, current, edgeStart, edgeEnd))
    }

    previous = current
    previousOutside = currentOutside
  })

  return dedupePolygon(output)
}

const clipPolygonToInsideHalfPlane = (
  polygon: Vec2[],
  edgeStart: Vec2,
  edgeEnd: Vec2,
  orientationKind: 'cw' | 'ccw'
) => {
  const input = [...polygon]
  const output: Vec2[] = []
  if (input.length === 0) {
    return output
  }

  let previous = input[input.length - 1]
  let previousInside = isInsideHalfPlane(
    previous,
    edgeStart,
    edgeEnd,
    orientationKind
  )

  input.forEach((current) => {
    const currentInside = isInsideHalfPlane(
      current,
      edgeStart,
      edgeEnd,
      orientationKind
    )

    if (currentInside) {
      if (!previousInside) {
        output.push(lineIntersection(previous, current, edgeStart, edgeEnd))
      }
      output.push(current)
    } else if (previousInside) {
      output.push(lineIntersection(previous, current, edgeStart, edgeEnd))
    }

    previous = current
    previousInside = currentInside
  })

  return dedupePolygon(output)
}

const subtractConvexPolygon = (minuend: Vec2[], subtrahend: Vec2[]) => {
  if (polygonsEqual(minuend, subtrahend)) {
    return []
  }

  const minuendArea = Math.abs(signedArea(minuend))
  const subtrahendArea = Math.abs(signedArea(subtrahend))
  const hasStrictInteriorPoint =
    minuend.some((point) => isPointStrictlyInsidePolygon(point, subtrahend)) ||
    subtrahend.some((point) => isPointStrictlyInsidePolygon(point, minuend))
  const subtrahendIsInsideOrOnMinuend = subtrahend.every((point) =>
    isPointInsidePolygon(point, minuend)
  )

  if (
    !hasStrictInteriorPoint &&
    !(subtrahendIsInsideOrOnMinuend && minuendArea > subtrahendArea + EPSILON)
  ) {
    return [minuend]
  }

  const orientationKind = signedArea(subtrahend) >= 0 ? 'ccw' : 'cw'
  const sectors: Vec2[][] = []

  for (let index = 0; index < subtrahend.length; index += 1) {
    const edgeStart = subtrahend[index]
    const edgeEnd = subtrahend[(index + 1) % subtrahend.length]
    let clipped = clipPolygonToOutsideHalfPlane(
      minuend,
      edgeStart,
      edgeEnd,
      orientationKind
    )

    for (let previousIndex = 0; previousIndex < index; previousIndex += 1) {
      if (clipped.length < 3 || Math.abs(signedArea(clipped)) <= EPSILON) {
        break
      }

      const previousStart = subtrahend[previousIndex]
      const previousEnd = subtrahend[(previousIndex + 1) % subtrahend.length]
      clipped = clipPolygonToInsideHalfPlane(
        clipped,
        previousStart,
        previousEnd,
        orientationKind
      )
    }

    if (clipped.length < 3 || Math.abs(signedArea(clipped)) <= EPSILON) {
      continue
    }

    if (!polygonListContains(sectors, clipped)) {
      sectors.push(clipped)
    }
  }

  return sectors
}

const buildSharedIntersectionPolygons = (
  candidates: ConstrainedSolidOwnershipCandidate[]
) => {
  if (candidates.length < 2) {
    return []
  }

  let sharedPolygons = candidates[0].polygons.flatMap((polygon) =>
    normalizePolygonToConvexPieces(polygon)
  )

  for (
    let candidateIndex = 1;
    candidateIndex < candidates.length;
    candidateIndex += 1
  ) {
    const nextCandidate = candidates[candidateIndex]
    const nextSharedPolygons: Vec2[][] = []

    sharedPolygons.forEach((sharedPolygon) => {
      nextCandidate.polygons.forEach((candidatePolygon) => {
        if (
          !boundsOverlap(
            getPolygonBounds(sharedPolygon),
            getPolygonBounds(candidatePolygon)
          )
        ) {
          return
        }

        normalizePolygonToConvexPieces(candidatePolygon).forEach(
          (candidatePiece) => {
            if (
              !boundsOverlap(
                getPolygonBounds(sharedPolygon),
                getPolygonBounds(candidatePiece)
              )
            ) {
              return
            }

            const intersection = intersectConvexPolygons(
              sharedPolygon,
              candidatePiece
            )
            if (intersection.length === 0) {
              return
            }

            if (!polygonListContains(nextSharedPolygons, intersection)) {
              nextSharedPolygons.push(intersection)
            }
          }
        )
      })
    })

    sharedPolygons = nextSharedPolygons

    if (sharedPolygons.length === 0) {
      break
    }
  }

  return sharedPolygons
}

const buildIntraCandidateIntersectionPolygons = (
  candidate: ConstrainedSolidOwnershipCandidate
) => {
  const intersections: Vec2[][] = []

  for (
    let leftPolygonIndex = 0;
    leftPolygonIndex < candidate.polygons.length;
    leftPolygonIndex += 1
  ) {
    const leftPieces = normalizePolygonToConvexPieces(
      candidate.polygons[leftPolygonIndex]
    )

    for (
      let rightPolygonIndex = leftPolygonIndex + 1;
      rightPolygonIndex < candidate.polygons.length;
      rightPolygonIndex += 1
    ) {
      const rightPieces = normalizePolygonToConvexPieces(
        candidate.polygons[rightPolygonIndex]
      )
      if (
        !boundsOverlap(
          getPolygonBounds(candidate.polygons[leftPolygonIndex]),
          getPolygonBounds(candidate.polygons[rightPolygonIndex])
        )
      ) {
        continue
      }

      leftPieces.forEach((leftPiece) => {
        rightPieces.forEach((rightPiece) => {
          if (
            !boundsOverlap(
              getPolygonBounds(leftPiece),
              getPolygonBounds(rightPiece)
            )
          ) {
            return
          }

          const intersection = intersectConvexPolygons(leftPiece, rightPiece)
          if (
            intersection.length < 3 ||
            Math.abs(signedArea(intersection)) <= EPSILON
          ) {
            return
          }

          if (!polygonListContains(intersections, intersection)) {
            intersections.push(intersection)
          }
        })
      })
    }
  }

  return intersections
}

const candidateIdsContainsAll = (candidateIds: string[], subset: string[]) =>
  subset.every((candidateId) => candidateIds.includes(candidateId))

const enumerateCandidateSubsets = (
  candidates: ConstrainedSolidOwnershipCandidate[]
) => {
  const subsets: ConstrainedSolidOwnershipCandidate[][] = []
  const current: ConstrainedSolidOwnershipCandidate[] = []

  const visit = (index: number) => {
    if (index >= candidates.length) {
      if (current.length >= 2) {
        subsets.push([...current])
      }
      return
    }

    visit(index + 1)
    current.push(candidates[index])
    visit(index + 1)
    current.pop()
  }

  visit(0)

  return subsets.sort((left, right) => {
    if (right.length !== left.length) {
      return right.length - left.length
    }

    const leftKey = left.map((candidate) => candidate.candidateId).join('|')
    const rightKey = right.map((candidate) => candidate.candidateId).join('|')
    return leftKey.localeCompare(rightKey)
  })
}

const getExactSubsetCount = (candidateCount: number) =>
  candidateCount < 2 ? 0 : 2 ** candidateCount - candidateCount - 1

const buildOwnedRegions = (
  components: ConstrainedSolidOwnershipComponentDiagnostic[],
  candidates: ConstrainedSolidOwnershipCandidate[]
): {
  arrangementFaces: ConstrainedSolidArrangementFaceDiagnostic[]
  ownedRegions: ConstrainedSolidOwnershipRegionDiagnostic[]
} => {
  const ownedRegions: ConstrainedSolidOwnershipRegionDiagnostic[] = []
  const arrangementFaces: ConstrainedSolidArrangementFaceDiagnostic[] = []
  const candidateById = new Map(
    candidates.map((candidate) => [candidate.candidateId, candidate])
  )

  components.forEach((component) => {
    const componentCandidates = component.candidateIds
      .map((candidateId) => candidateById.get(candidateId))
      .filter(
        (candidate): candidate is ConstrainedSolidOwnershipCandidate =>
          !!candidate
      )

    const regions = new Map<
      string,
      {
        regionId: string
        candidateIds: string[]
        polygon: Vec2[]
        ownerStrokeId: string
        ownerStrokeIndex?: number
        ownerKey?: string
        partitionMethod: ConstrainedSolidArrangementFaceDiagnostic['partitionMethod']
      }
    >()

    const canBuildExactSharedRegions =
      componentCandidates.length >= 2 &&
      getExactSubsetCount(componentCandidates.length) <= MAX_EXACT_SUBSET_COUNT

    componentCandidates.forEach((candidate) => {
      const candidateIds = [candidate.candidateId]
      buildIntraCandidateIntersectionPolygons(candidate).forEach(
        (polygon, polygonIndex) => {
          const bounds = getBounds([polygon])
          const regionKey = buildRegionKey(candidateIds, bounds)

          if (!regions.has(regionKey)) {
            regions.set(regionKey, {
              regionId: `${component.componentId}:region:intra:${candidate.candidateId}:${polygonIndex}`,
              candidateIds,
              polygon,
              ownerStrokeId: candidate.strokeId,
              ownerStrokeIndex: candidate.strokeIndex,
              ownerKey: candidate.ownerKey,
              partitionMethod: 'intra-candidate-intersection'
            })
          }
        }
      )
    })

    if (canBuildExactSharedRegions) {
      const subsetEntries = enumerateCandidateSubsets(componentCandidates)
        .map((subset) => {
          const candidateIds = subset
            .map((candidate) => candidate.candidateId)
            .sort((left, right) => left.localeCompare(right))
          const ownerCandidate = getOwnerCandidate(subset)
          const intersectionPolygons = buildSharedIntersectionPolygons(subset)

          return {
            candidateIds,
            ownerStrokeId: ownerCandidate.strokeId,
            ownerStrokeIndex: ownerCandidate.strokeIndex,
            ownerKey: ownerCandidate.ownerKey,
            polygons: intersectionPolygons
          }
        })
        .filter((entry) => entry.polygons.length > 0)

      const exactEntries: {
        candidateIds: string[]
        ownerStrokeId: string
        ownerStrokeIndex?: number
        ownerKey?: string
        polygons: Vec2[][]
      }[] = []

      subsetEntries.forEach((entry) => {
        let exactPolygons = [...entry.polygons]

        exactEntries.forEach((supersetEntry) => {
          if (
            !candidateIdsContainsAll(
              supersetEntry.candidateIds,
              entry.candidateIds
            )
          ) {
            return
          }

          exactPolygons = exactPolygons.flatMap((polygon) => {
            let remaining = [polygon]

            supersetEntry.polygons.forEach((supersetPolygon) => {
              remaining = remaining.flatMap((remainingPolygon) =>
                subtractConvexPolygon(remainingPolygon, supersetPolygon)
              )
            })

            return remaining
          })
        })

        const filteredPolygons = exactPolygons.filter(
          (polygon) =>
            polygon.length >= 3 && Math.abs(signedArea(polygon)) > EPSILON
        )

        if (filteredPolygons.length > 0) {
          exactEntries.push({
            candidateIds: entry.candidateIds,
            ownerStrokeId: entry.ownerStrokeId,
            ownerStrokeIndex: entry.ownerStrokeIndex,
            ownerKey: entry.ownerKey,
            polygons: filteredPolygons
          })
        }
      })

      exactEntries.forEach((entry) => {
        entry.polygons.forEach((polygon, polygonIndex) => {
          const bounds = getBounds([polygon])
          const regionKey = buildRegionKey(entry.candidateIds, bounds)
          if (!regions.has(regionKey)) {
            regions.set(regionKey, {
              regionId: `${component.componentId}:region:shared:${entry.candidateIds.join('-')}:${polygonIndex}`,
              candidateIds: entry.candidateIds,
              polygon,
              ownerStrokeId: entry.ownerStrokeId,
              ownerStrokeIndex: entry.ownerStrokeIndex,
              ownerKey: entry.ownerKey,
              partitionMethod: 'exact-subset-intersection'
            })
          }
        })
      })
    }

    if (regions.size === 0) {
      componentCandidates.forEach((anchorCandidate) => {
        anchorCandidate.polygons.forEach((polygon, polygonIndex) => {
          const overlappingCandidates = componentCandidates.filter(
            (candidate) => candidateOverlapsPolygon(candidate, polygon)
          )

          if (overlappingCandidates.length < 2) {
            return
          }

          const candidateIds = overlappingCandidates
            .map(({ candidateId }) => candidateId)
            .sort((left, right) => left.localeCompare(right))
          const ownerCandidate = getOwnerCandidate(overlappingCandidates)
          const bounds = getBounds([polygon])
          const regionKey = buildRegionKey(candidateIds, bounds)

          if (!regions.has(regionKey)) {
            regions.set(regionKey, {
              regionId: `${component.componentId}:region:${anchorCandidate.candidateId}:${polygonIndex}`,
              candidateIds,
              polygon,
              ownerStrokeId: ownerCandidate.strokeId,
              ownerStrokeIndex: ownerCandidate.strokeIndex,
              ownerKey: ownerCandidate.ownerKey,
              partitionMethod: 'bounded-overlap-polygon'
            })
          }
        })
      })
    }

    const componentFaces = [...regions.values()].map((region) => ({
      faceId: region.regionId.replace(':region:', ':face:'),
      candidateIds: region.candidateIds,
      ownerStrokeId: region.ownerStrokeId,
      ownerStrokeIndex: region.ownerStrokeIndex,
      ownerKey: region.ownerKey,
      bounds: getBounds([region.polygon]),
      polygon: region.polygon,
      partitionMethod: region.partitionMethod
    }))

    arrangementFaces.push(...componentFaces)
    ownedRegions.push(
      ...componentFaces.map((face) => ({
        regionId: face.faceId.replace(':face:', ':region:'),
        candidateIds: face.candidateIds,
        ownerStrokeId: face.ownerStrokeId,
        ownerStrokeIndex: face.ownerStrokeIndex,
        ownerKey: face.ownerKey,
        bounds: face.bounds,
        polygon: face.polygon
      }))
    )
  })

  return {
    arrangementFaces: arrangementFaces.sort((left, right) =>
      left.faceId.localeCompare(right.faceId)
    ),
    ownedRegions: ownedRegions.sort((left, right) =>
      left.regionId.localeCompare(right.regionId)
    )
  }
}

export const buildConstrainedSolidOwnershipDiagnostics = (
  packets: SolidCenterStrokeResolvedPacket[]
): ConstrainedSolidOwnershipDiagnostics => {
  const candidates = buildCandidates(packets)
  const edges = buildEdges(candidates)
  const components = extractComponents(candidates, edges)
  const { arrangementFaces, ownedRegions } = buildOwnedRegions(
    components,
    candidates
  )

  return {
    arrangementPolicy: ARRANGEMENT_POLICY,
    candidates,
    edges,
    components,
    arrangementFaces,
    ownedRegions
  }
}

export const buildConstrainedSolidOwnershipCandidateDiagnostics = (
  packets: SolidCenterStrokeResolvedPacket[]
): ConstrainedSolidOwnershipDiagnostics => ({
  ...createEmptyConstrainedSolidOwnershipDiagnostics(),
  candidates: buildCandidates(packets)
})

export const applyConstrainedSolidOwnershipDiagnostics = <T extends object>(
  graphic: T,
  packets: SolidCenterStrokeResolvedPacket[]
) => {
  ;(
    graphic as T & ConstrainedSolidOwnershipDiagnosticsRuntimeGraphic
  ).__asyraConstrainedSolidOwnershipDiagnostics =
    buildConstrainedSolidOwnershipDiagnostics(packets)
}

export const setConstrainedSolidOwnershipDiagnostics = <T extends object>(
  graphic: T,
  diagnostics: ConstrainedSolidOwnershipDiagnostics
) => {
  ;(
    graphic as T & ConstrainedSolidOwnershipDiagnosticsRuntimeGraphic
  ).__asyraConstrainedSolidOwnershipDiagnostics = diagnostics
}

export const clearConstrainedSolidOwnershipDiagnostics = <T extends object>(
  graphic: T
) => {
  delete (graphic as T & ConstrainedSolidOwnershipDiagnosticsRuntimeGraphic)
    .__asyraConstrainedSolidOwnershipDiagnostics
}
