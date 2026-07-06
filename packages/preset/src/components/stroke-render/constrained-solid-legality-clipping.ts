import type { StrokeAttrs } from '@asyra/utils'
import type { SolidCenterStrokeResolvedPacket } from './solid-center-stroke-packets'
import {
  buildConstrainedSolidLegalityDiagnostics,
  type ConstrainedSolidLegalityDiagnostics,
  type ConstrainedSolidLegalitySourceGroup
} from './constrained-solid-legality-diagnostics'
import {
  buildConstrainedSolidOwnershipDiagnostics,
  createEmptyConstrainedSolidOwnershipDiagnostics,
  type ConstrainedSolidOwnershipDiagnostics
} from './constrained-solid-ownership-diagnostics'
import type { SolidCenterStrokeGeometryPacket } from './solid-center-stroke-packets'

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

export interface ConstrainedSolidLegalityClippingResult {
  packets: SolidCenterStrokeResolvedPacket[]
  eligibleOverflowGeometryIds: string[]
  preservedGeometryIds: string[]
  legalityDiagnostics: ConstrainedSolidLegalityDiagnostics
  ownershipDiagnostics: ConstrainedSolidOwnershipDiagnostics
}

export interface ConstrainedSolidLegalityClippingOptions {
  /**
   * Render-layer diagnostics can request candidate ownership metadata even when
   * there is only one preserved packet. The core no-op clipping path keeps the
   * historical empty diagnostics contract unless this is enabled.
   */
  includeOwnershipDiagnosticsForPreservedPackets?: boolean
}

const EPSILON = 1e-6

const orientation = (a: Vec2, b: Vec2, c: Vec2) =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)

const isPointOnSegment = (point: Vec2, start: Vec2, end: Vec2) => {
  const cross =
    (end.x - start.x) * (point.y - start.y) -
    (end.y - start.y) * (point.x - start.x)

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

const isPointOnBoundary = (point: Vec2, polygon: Vec2[]) =>
  polygon.some((start, index) => {
    const end = polygon[(index + 1) % polygon.length]
    return isPointOnSegment(point, start, end)
  })

const segmentsIntersect = (
  firstStart: Vec2,
  firstEnd: Vec2,
  secondStart: Vec2,
  secondEnd: Vec2
) => {
  const firstToSecondStart = orientation(firstStart, firstEnd, secondStart)
  const firstToSecondEnd = orientation(firstStart, firstEnd, secondEnd)
  const secondToFirstStart = orientation(secondStart, secondEnd, firstStart)
  const secondToFirstEnd = orientation(secondStart, secondEnd, firstEnd)

  if (
    Math.abs(firstToSecondStart) <= EPSILON &&
    isPointOnSegment(secondStart, firstStart, firstEnd)
  ) {
    return true
  }
  if (
    Math.abs(firstToSecondEnd) <= EPSILON &&
    isPointOnSegment(secondEnd, firstStart, firstEnd)
  ) {
    return true
  }
  if (
    Math.abs(secondToFirstStart) <= EPSILON &&
    isPointOnSegment(firstStart, secondStart, secondEnd)
  ) {
    return true
  }
  if (
    Math.abs(secondToFirstEnd) <= EPSILON &&
    isPointOnSegment(firstEnd, secondStart, secondEnd)
  ) {
    return true
  }

  const firstSegmentStraddlesSecond =
    (firstToSecondStart > EPSILON && firstToSecondEnd < -EPSILON) ||
    (firstToSecondStart < -EPSILON && firstToSecondEnd > EPSILON)
  const secondSegmentStraddlesFirst =
    (secondToFirstStart > EPSILON && secondToFirstEnd < -EPSILON) ||
    (secondToFirstStart < -EPSILON && secondToFirstEnd > EPSILON)

  return firstSegmentStraddlesSecond && secondSegmentStraddlesFirst
}

const isNonAdjacentEdgePair = (
  firstIndex: number,
  secondIndex: number,
  edgeCount: number
) =>
  firstIndex !== secondIndex &&
  (firstIndex + 1) % edgeCount !== secondIndex &&
  (secondIndex + 1) % edgeCount !== firstIndex

const isSelfIntersectingBoundary = (polygon: Vec2[]) => {
  if (polygon.length < 4) {
    return false
  }

  for (let firstIndex = 0; firstIndex < polygon.length; firstIndex += 1) {
    const firstStart = polygon[firstIndex]
    const firstEnd = polygon[(firstIndex + 1) % polygon.length]
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < polygon.length;
      secondIndex += 1
    ) {
      if (!isNonAdjacentEdgePair(firstIndex, secondIndex, polygon.length)) {
        continue
      }

      const secondStart = polygon[secondIndex]
      const secondEnd = polygon[(secondIndex + 1) % polygon.length]
      if (segmentsIntersect(firstStart, firstEnd, secondStart, secondEnd)) {
        return true
      }
    }
  }

  return false
}

const isPointStrictlyInsidePolygon = (point: Vec2, polygon: Vec2[]) => {
  if (isPointOnBoundary(point, polygon)) {
    return false
  }

  let inside = false

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const current = polygon[i]
    const previous = polygon[j]

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
  orientation: 'cw' | 'ccw'
) => {
  const cross =
    (edgeEnd.x - edgeStart.x) * (point.y - edgeStart.y) -
    (edgeEnd.y - edgeStart.y) * (point.x - edgeStart.x)
  return orientation === 'ccw' ? cross >= -EPSILON : cross <= EPSILON
}

const isOutsideHalfPlane = (
  point: Vec2,
  edgeStart: Vec2,
  edgeEnd: Vec2,
  orientation: 'cw' | 'ccw'
) => {
  const cross =
    (edgeEnd.x - edgeStart.x) * (point.y - edgeStart.y) -
    (edgeEnd.y - edgeStart.y) * (point.x - edgeStart.x)
  return orientation === 'ccw' ? cross <= EPSILON : cross >= -EPSILON
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
  const triangleOrientation = signedArea(triangle) >= 0 ? 'ccw' : 'cw'

  const ab = orientation(a, b, point)
  const bc = orientation(b, c, point)
  const ca = orientation(c, a, point)

  return triangleOrientation === 'ccw'
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

  const yLevels = [...new Set(polygon.map((point) => point.y))].sort(
    (left, right) => left - right
  )
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
  if (polygon.length < 4) {
    return [polygon]
  }

  if (isOrthogonalPolygon(polygon)) {
    return decomposeOrthogonalPolygonToRectangles(polygon)
  }

  if (isConvexPolygon(polygon)) {
    return [polygon]
  }

  return decomposeSimplePolygonToTriangles(polygon)
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
  const subtrahendIsInsideOrOnMinuend = subtrahend.every(
    (point) =>
      isPointOnBoundary(point, minuend) ||
      isPointStrictlyInsidePolygon(point, minuend)
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

const clipForeignOwnedPolygons = (
  packets: SolidCenterStrokeResolvedPacket[],
  ownershipDiagnostics: ConstrainedSolidOwnershipDiagnostics
) =>
  packets.map((packet, packetIndex) => {
    const strokeId = packet.geometry.debugMeta?.strokeId
    if (!strokeId) {
      return packet
    }

    const packetCandidateId = `candidate:${packetIndex}`
    const foreignOwnedFaces = ownershipDiagnostics.arrangementFaces.filter(
      (face) =>
        face.ownerStrokeId !== strokeId &&
        face.candidateIds.includes(packetCandidateId)
    )

    if (foreignOwnedFaces.length === 0) {
      return packet
    }

    const polygons = packet.geometry.polygons.flatMap((polygon) => {
      let remainingPolygons = normalizePolygonToConvexPieces(polygon)

      foreignOwnedFaces.forEach((foreignOwnedFace) => {
        remainingPolygons = remainingPolygons.flatMap((remainingPolygon) =>
          subtractConvexPolygon(remainingPolygon, foreignOwnedFace.polygon)
        )
      })

      return remainingPolygons.filter(
        (remainingPolygon) =>
          remainingPolygon.length >= 3 &&
          Math.abs(signedArea(remainingPolygon)) > EPSILON
      )
    })

    const changed =
      polygons.length !== packet.geometry.polygons.length ||
      polygons.some(
        (polygon, polygonIndex) =>
          !polygonsEqual(polygon, packet.geometry.polygons[polygonIndex] ?? [])
      )

    if (!changed) {
      return packet
    }

    return {
      ...packet,
      geometry: {
        ...packet.geometry,
        polygons,
        bounds: getBounds(polygons)
      }
    }
  })

const clipPolygonToConvexBoundary = (
  polygon: Vec2[],
  boundary: Vec2[],
  orientation: 'cw' | 'ccw'
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
      orientation
    )

    input.forEach((current) => {
      const currentInside = isInsideHalfPlane(
        current,
        clipStart,
        clipEnd,
        orientation
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

const clipPolygonToOutsideHalfPlane = (
  polygon: Vec2[],
  edgeStart: Vec2,
  edgeEnd: Vec2,
  orientation: 'cw' | 'ccw'
) => {
  const input = [...polygon]
  const output: Vec2[] = []
  if (input.length === 0) {
    return output
  }

  let previous = input[input.length - 1]
  let previousOutside = isOutsideHalfPlane(
    previous,
    edgeStart,
    edgeEnd,
    orientation
  )

  input.forEach((current) => {
    const currentOutside = isOutsideHalfPlane(
      current,
      edgeStart,
      edgeEnd,
      orientation
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
  orientation: 'cw' | 'ccw'
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
    orientation
  )

  input.forEach((current) => {
    const currentInside = isInsideHalfPlane(
      current,
      edgeStart,
      edgeEnd,
      orientation
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

const clipGeometryPacketToInsideDomain = (
  geometry: SolidCenterStrokeGeometryPacket,
  boundaryPolygon: Vec2[],
  orientation: 'cw' | 'ccw'
) => {
  const clippedPolygons = geometry.polygons
    .map((polygon) =>
      clipPolygonToConvexBoundary(polygon, boundaryPolygon, orientation)
    )
    .filter(
      (polygon) =>
        polygon.length >= 3 && Math.abs(signedArea(polygon)) > EPSILON
    )

  const changed =
    clippedPolygons.length !== geometry.polygons.length ||
    clippedPolygons.some(
      (polygon, index) =>
        !polygonsEqual(polygon, geometry.polygons[index] ?? [])
    )

  if (!changed) {
    return {
      changed: false,
      geometry
    }
  }

  return {
    changed: true,
    geometry: {
      ...geometry,
      polygons: clippedPolygons,
      bounds: getBounds(clippedPolygons)
    }
  }
}

const clipGeometryPacketToOutsideDomain = (
  geometry: SolidCenterStrokeGeometryPacket,
  boundaryPolygon: Vec2[],
  orientation: 'cw' | 'ccw'
) => {
  const hasStrictInteriorPoint = geometry.polygons.some((polygon) =>
    polygon.some((point) =>
      isPointStrictlyInsidePolygon(point, boundaryPolygon)
    )
  )

  if (!hasStrictInteriorPoint) {
    return {
      changed: false,
      geometry
    }
  }

  const clippedPolygons = geometry.polygons.flatMap((polygon) => {
    const outsidePolygons: Vec2[][] = []

    for (let index = 0; index < boundaryPolygon.length; index += 1) {
      const clipStart = boundaryPolygon[index]
      const clipEnd = boundaryPolygon[(index + 1) % boundaryPolygon.length]
      let clipped = clipPolygonToOutsideHalfPlane(
        polygon,
        clipStart,
        clipEnd,
        orientation
      )

      for (let previousIndex = 0; previousIndex < index; previousIndex += 1) {
        if (clipped.length < 3 || Math.abs(signedArea(clipped)) <= EPSILON) {
          break
        }

        const previousStart = boundaryPolygon[previousIndex]
        const previousEnd =
          boundaryPolygon[(previousIndex + 1) % boundaryPolygon.length]
        clipped = clipPolygonToInsideHalfPlane(
          clipped,
          previousStart,
          previousEnd,
          orientation
        )
      }

      if (clipped.length < 3 || Math.abs(signedArea(clipped)) <= EPSILON) {
        continue
      }

      if (!polygonListContains(outsidePolygons, clipped)) {
        outsidePolygons.push(clipped)
      }
    }

    return outsidePolygons
  })

  const changed =
    clippedPolygons.length !== geometry.polygons.length ||
    clippedPolygons.some(
      (polygon, index) =>
        !polygonsEqual(polygon, geometry.polygons[index] ?? [])
    )

  if (!changed) {
    return {
      changed: false,
      geometry
    }
  }

  return {
    changed: true,
    geometry: {
      ...geometry,
      polygons: clippedPolygons,
      bounds: getBounds(clippedPolygons)
    }
  }
}

export const buildConstrainedSolidLegalityClippingResult = (
  sources: ConstrainedSolidLegalitySourceGroup[],
  strokes: StrokeAttrs[] | undefined,
  packets: SolidCenterStrokeResolvedPacket[],
  options: ConstrainedSolidLegalityClippingOptions = {}
): ConstrainedSolidLegalityClippingResult => {
  const initialLegalityDiagnostics = buildConstrainedSolidLegalityDiagnostics(
    sources,
    strokes,
    packets
  )
  const domainsByGeometryId = new Map(
    initialLegalityDiagnostics.domains.map(
      (domain) => [domain.geometryId, domain] as const
    )
  )

  const eligibleOverflowGeometryIds: string[] = []
  const clippedPackets = packets.map((packet) => {
    const domain = domainsByGeometryId.get(packet.geometry.geometryId)
    if (!domain) {
      return packet
    }

    if (isSelfIntersectingBoundary(domain.boundaryPolygon)) {
      return packet
    }

    const clipped =
      domain.mode === 'inside'
        ? clipGeometryPacketToInsideDomain(
            packet.geometry,
            domain.boundaryPolygon,
            domain.orientation
          )
        : clipGeometryPacketToOutsideDomain(
            packet.geometry,
            domain.boundaryPolygon,
            domain.orientation
          )

    if (!clipped.changed) {
      return packet
    }

    eligibleOverflowGeometryIds.push(packet.geometry.geometryId)
    return {
      ...packet,
      geometry: clipped.geometry
    }
  })

  if (clippedPackets.length < 2) {
    const legalityDiagnostics = buildConstrainedSolidLegalityDiagnostics(
      sources,
      strokes,
      clippedPackets
    )
    const ownershipDiagnostics =
      options.includeOwnershipDiagnosticsForPreservedPackets === true
        ? buildConstrainedSolidOwnershipDiagnostics(clippedPackets)
        : createEmptyConstrainedSolidOwnershipDiagnostics()

    return {
      packets: clippedPackets,
      eligibleOverflowGeometryIds,
      preservedGeometryIds: clippedPackets.map(
        (packet) => packet.geometry.geometryId
      ),
      legalityDiagnostics,
      ownershipDiagnostics
    }
  }

  const ownershipDiagnostics =
    buildConstrainedSolidOwnershipDiagnostics(clippedPackets)
  const ownerClippedPackets = clipForeignOwnedPolygons(
    clippedPackets,
    ownershipDiagnostics
  )

  const legalityDiagnostics = buildConstrainedSolidLegalityDiagnostics(
    sources,
    strokes,
    ownerClippedPackets
  )

  return {
    packets: ownerClippedPackets,
    eligibleOverflowGeometryIds,
    preservedGeometryIds: ownerClippedPackets.map(
      (packet) => packet.geometry.geometryId
    ),
    legalityDiagnostics,
    ownershipDiagnostics
  }
}
