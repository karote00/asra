import type { RenderableStroke } from './renderable-stroke'
import type { FillRule, GeometryBackend } from './geometry-backend'
import {
  slicePathSegmentPoints,
  type PathGeometry,
  type PathSegment
} from './path-geometry'
import {
  add,
  buildOffsetSegments,
  EPS,
  dedupeClosed,
  distance,
  extendForCap,
  isSimpleClosedPolygon,
  isSimpleOpenPath,
  normalize,
  normalizeClosed,
  offsetPath,
  polygonArea,
  scale,
  subtract,
  type Vec2
} from './solid-stroke-geometry-core'

interface SelectedSideGuardPoint extends Vec2 {
  sharp?: boolean
}

type ExactConstrainedSolidBackend = Pick<
  GeometryBackend,
  'capabilities' | 'union' | 'difference' | 'offset'
>

export const supportsConstrainedSolidStroke = (
  stroke: Pick<
    RenderableStroke,
    'style' | 'position' | 'width' | 'join' | 'miterLimit' | 'cap'
  >,
  closed: boolean
) =>
  stroke.style === 'solid' &&
  (stroke.position === 'inside' || stroke.position === 'outside') &&
  stroke.width > 0 &&
  (stroke.join === 'miter' ||
    stroke.join === 'bevel' ||
    stroke.join === 'round') &&
  stroke.miterLimit >= 1 &&
  (stroke.cap === 'butt' || stroke.cap === 'square' || stroke.cap === 'round')

const buildArcPoints = (
  center: Vec2,
  start: Vec2,
  end: Vec2,
  sweepSign: number
) => {
  const startAngle = Math.atan2(start.y - center.y, start.x - center.x)
  const endAngle = Math.atan2(end.y - center.y, end.x - center.x)
  let sweep = endAngle - startAngle

  if (sweepSign >= 0) {
    while (sweep < 0) {
      sweep += Math.PI * 2
    }
  } else {
    while (sweep > 0) {
      sweep -= Math.PI * 2
    }
  }

  const segmentCount = Math.max(2, Math.ceil(Math.abs(sweep) / (Math.PI / 12)))
  const radius = distance(center, start)
  const points: Vec2[] = []

  for (let index = 0; index <= segmentCount; index += 1) {
    const angle = startAngle + (sweep * index) / segmentCount
    points.push({
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius
    })
  }

  return points
}

const cross = (a: Vec2, b: Vec2) => a.x * b.y - a.y * b.x

const getOpenConstrainedOffset = (
  stroke: Pick<RenderableStroke, 'position' | 'width'>
) => (stroke.position === 'inside' ? stroke.width : -stroke.width)

const buildOneSidedRoundCap = (
  endpoint: Vec2,
  offsetEndpoint: Vec2,
  tangent: Vec2,
  isStart: boolean
): Vec2[] => {
  const center = scale(add(endpoint, offsetEndpoint), 0.5)
  const radius = distance(endpoint, offsetEndpoint) / 2
  if (radius <= EPS) {
    return []
  }

  if (!normalize(subtract(offsetEndpoint, endpoint))) {
    return []
  }

  const bulgeDirection = isStart ? scale(tangent, -1) : tangent
  const midPoint = add(center, scale(bulgeDirection, radius))
  const startAngle = Math.atan2(endpoint.y - center.y, endpoint.x - center.x)
  const midAngle = Math.atan2(midPoint.y - center.y, midPoint.x - center.x)
  const endAngle = Math.atan2(
    offsetEndpoint.y - center.y,
    offsetEndpoint.x - center.x
  )

  const sweepViaMid = (start: number, mid: number, end: number) => {
    let sweep = end - start
    while (sweep <= -Math.PI) {
      sweep += Math.PI * 2
    }
    while (sweep > Math.PI) {
      sweep -= Math.PI * 2
    }

    const normalizeDelta = (value: number) => {
      let result = value
      while (result < 0) {
        result += Math.PI * 2
      }
      while (result >= Math.PI * 2) {
        result -= Math.PI * 2
      }
      return result
    }

    const positiveSweep = sweep < 0 ? sweep + Math.PI * 2 : sweep
    const midDelta = normalizeDelta(mid - start)
    if (midDelta <= positiveSweep + EPS) {
      return positiveSweep
    }

    return positiveSweep - Math.PI * 2
  }

  const sweep = sweepViaMid(startAngle, midAngle, endAngle)
  const segmentCount = Math.max(3, Math.ceil(Math.abs(sweep) / (Math.PI / 12)))
  const points: Vec2[] = []

  for (let index = 0; index <= segmentCount; index += 1) {
    const angle = startAngle + (sweep * index) / segmentCount
    points.push({
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius
    })
  }

  return points
}

const appendDedupePoint = (points: Vec2[], point: Vec2) => {
  const previous = points[points.length - 1]
  if (previous && distance(previous, point) <= EPS) {
    return
  }
  points.push(point)
}

const offsetVectorAtSegment = (from: Vec2, to: Vec2, offset: number) => {
  const direction = normalize(subtract(to, from))
  if (!direction) {
    return null
  }

  return {
    x: -direction.y * offset,
    y: direction.x * offset
  }
}

const midpoint = (a: Vec2, b: Vec2): Vec2 => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2
})

const distanceBetween = distance

const normalizeVector = (vector: Vec2): Vec2 | null => normalize(vector)

const buildSampledOpenOffsetBoundary = (
  points: Vec2[],
  offset: number,
  stroke: Pick<RenderableStroke, 'miterLimit'>
) => {
  const segments = buildOffsetSegments(points, false, offset)
  const firstSegment = segments[0]
  const lastSegment = segments[points.length - 2]
  if (!firstSegment || !lastSegment) {
    return []
  }

  const boundary: Vec2[] = [firstSegment.start]

  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = segments[index - 1]
    const next = segments[index]
    if (!previous || !next) {
      return []
    }

    const previousOffset = offsetVectorAtSegment(
      points[index - 1],
      points[index],
      offset
    )
    const nextOffset = offsetVectorAtSegment(
      points[index],
      points[index + 1],
      offset
    )
    const averagedOffset =
      previousOffset && nextOffset
        ? scale(add(previousOffset, nextOffset), 0.5)
        : null

    const averagedDirection = averagedOffset ? normalize(averagedOffset) : null

    if (averagedDirection) {
      appendDedupePoint(
        boundary,
        add(points[index], scale(averagedDirection, Math.abs(offset)))
      )
      continue
    }

    appendDedupePoint(boundary, midpoint(previous.end, next.start))
  }

  appendDedupePoint(boundary, lastSegment.end)
  return boundary
}

const buildJoinedOpenOffsetBoundary = (
  points: Vec2[],
  offset: number,
  stroke: Pick<RenderableStroke, 'join' | 'miterLimit' | 'width'>
) => {
  const segments = buildOffsetSegments(points, false, offset)
  const firstSegment = segments[0]
  const lastSegment = segments[points.length - 2]
  if (!firstSegment || !lastSegment) {
    return []
  }

  const boundary: Vec2[] = [firstSegment.start]
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = segments[index - 1]
    const next = segments[index]
    if (!previous || !next) {
      return []
    }

    if (stroke.join === 'round') {
      const incoming = subtract(points[index], points[index - 1])
      const outgoing = subtract(points[index + 1], points[index])
      const sweepSign = cross(incoming, outgoing) * offset >= 0 ? -1 : 1
      const arcPoints = buildArcPoints(
        points[index],
        previous.end,
        next.start,
        sweepSign
      )
      arcPoints.slice(1).forEach((point) => appendDedupePoint(boundary, point))
      continue
    }

    if (stroke.join === 'bevel') {
      appendDedupePoint(boundary, previous.end)
      appendDedupePoint(boundary, next.start)
      continue
    }

    const intersection = offsetLineIntersection(
      previous.start,
      previous.end,
      next.start,
      next.end
    )
    const maxDistance = stroke.miterLimit * Math.abs(offset)
    if (
      intersection &&
      distance(points[index], intersection) <= maxDistance + EPS
    ) {
      appendDedupePoint(boundary, intersection)
      continue
    }

    appendDedupePoint(boundary, previous.end)
    appendDedupePoint(boundary, next.start)
  }

  appendDedupePoint(boundary, lastSegment.end)
  return boundary
}

const MAX_OPEN_RIBBON_SPLIT_DEPTH = 8

const buildOpenConstrainedStrokeStripPolygonsFromSource = (
  source: Vec2[],
  stroke: Pick<RenderableStroke, 'position' | 'width' | 'miterLimit'>
) => {
  const offset = getOpenConstrainedOffset(stroke)
  const offsetBoundary = buildSampledOpenOffsetBoundary(source, offset, stroke)
  if (offsetBoundary.length !== source.length) {
    return []
  }

  const polygon = dedupeClosed([...source, ...offsetBoundary.slice().reverse()])
  return polygon.length >= 3 && Math.abs(polygonArea(polygon)) > EPS
    ? [polygon]
    : []
}

const buildOpenConstrainedStrokeCellPolygonsFromSource = (
  source: Vec2[],
  stroke: Pick<RenderableStroke, 'position' | 'width' | 'miterLimit'>
) => {
  const offset = getOpenConstrainedOffset(stroke)
  const offsetBoundary = buildSampledOpenOffsetBoundary(source, offset, stroke)
  if (offsetBoundary.length !== source.length) {
    return []
  }

  const polygons: Vec2[][] = []
  const seamOverlap = Math.min(0.35, Math.max(0, stroke.width * 0.035))

  for (let index = 0; index < source.length - 1; index += 1) {
    let start = source[index]
    let end = source[index + 1]
    if (distance(start, end) <= EPS) {
      continue
    }
    const direction = normalize(subtract(end, start))
    if (direction && seamOverlap > EPS) {
      if (index > 0) {
        start = add(start, scale(direction, -seamOverlap))
      }
      if (index < source.length - 2) {
        end = add(end, scale(direction, seamOverlap))
      }
    }

    let polygon = dedupeClosed([
      start,
      end,
      offsetBoundary[index + 1],
      offsetBoundary[index]
    ])

    if (!isSimpleClosedPolygon(polygon)) {
      const offsetVector = offsetVectorAtSegment(start, end, offset)
      if (!offsetVector) {
        continue
      }
      polygon = dedupeClosed([
        start,
        end,
        add(end, offsetVector),
        add(start, offsetVector)
      ])
      if (!isSimpleClosedPolygon(polygon)) {
        continue
      }
    }

    if (polygon.length >= 3 && Math.abs(polygonArea(polygon)) > EPS) {
      polygons.push(polygon)
    }
  }

  return polygons
}

const buildOpenConstrainedStrokePolygonsFromSource = (
  source: Vec2[],
  stroke: Pick<
    RenderableStroke,
    'position' | 'width' | 'join' | 'miterLimit' | 'cap'
  >,
  options: { assumeNormalizedOpen?: boolean },
  splitDepth: number
): Vec2[][] => {
  if (
    options.assumeNormalizedOpen === true &&
    source.length > 3 &&
    stroke.cap !== 'round'
  ) {
    const stripPolygons = buildOpenConstrainedStrokeStripPolygonsFromSource(
      source,
      stroke
    )
    if (stripPolygons.length > 0) {
      return stripPolygons
    }

    return buildOpenConstrainedStrokeCellPolygonsFromSource(source, stroke)
  }

  const offset = getOpenConstrainedOffset(stroke)
  const offsetBoundary =
    options.assumeNormalizedOpen === true && source.length > 3
      ? buildSampledOpenOffsetBoundary(source, offset, stroke)
      : stroke.join === 'round' || stroke.join === 'bevel'
        ? buildJoinedOpenOffsetBoundary(source, offset, stroke)
        : offsetPath(source, false, offset, stroke)
  if (offsetBoundary.length < 2) {
    return []
  }

  const rawPolygon: Vec2[] = [...source]
  if (stroke.cap === 'round') {
    const startDirection = normalize(subtract(source[1], source[0]))
    const endDirection = normalize(
      subtract(source[source.length - 1], source[source.length - 2])
    )
    if (startDirection && endDirection) {
      const endCap = buildOneSidedRoundCap(
        source[source.length - 1],
        offsetBoundary[offsetBoundary.length - 1],
        endDirection,
        false
      )
      const startCap = buildOneSidedRoundCap(
        source[0],
        offsetBoundary[0],
        startDirection,
        true
      ).reverse()

      rawPolygon.push(...endCap.slice(1))
      rawPolygon.push(...offsetBoundary.slice(0, -1).reverse())
      rawPolygon.push(...startCap.slice(1))
    } else {
      rawPolygon.push(...offsetBoundary.reverse())
    }
  } else {
    rawPolygon.push(...offsetBoundary.reverse())
  }

  const polygon = dedupeClosed(rawPolygon)
  if (polygon.length < 3) {
    return []
  }

  if (
    isSimpleClosedPolygon(polygon) ||
    splitDepth >= MAX_OPEN_RIBBON_SPLIT_DEPTH ||
    source.length <= 2
  ) {
    return [polygon]
  }

  const splitIndex = Math.floor(source.length / 2)
  const leftSource = source.slice(0, splitIndex + 1)
  const rightSource = source.slice(splitIndex)

  return [
    ...buildOpenConstrainedStrokePolygonsFromSource(
      leftSource,
      stroke,
      options,
      splitDepth + 1
    ),
    ...buildOpenConstrainedStrokePolygonsFromSource(
      rightSource,
      stroke,
      options,
      splitDepth + 1
    )
  ]
}

const buildOpenConstrainedStrokePolygons = (
  points: Vec2[],
  stroke: Pick<
    RenderableStroke,
    'position' | 'width' | 'join' | 'miterLimit' | 'cap'
  >,
  options: {
    assumeSimpleOpen?: boolean
    assumeNormalizedOpen?: boolean
  } = {}
): Vec2[][] => {
  const normalizedSource =
    options.assumeNormalizedOpen === true ? points : dedupeClosed(points)
  const source = extendForCap(normalizedSource, stroke)
  if (source.length < 2) {
    return []
  }
  if (options.assumeSimpleOpen !== true && !isSimpleOpenPath(source)) {
    return []
  }

  return buildOpenConstrainedStrokePolygonsFromSource(
    source,
    stroke,
    { assumeNormalizedOpen: options.assumeNormalizedOpen },
    0
  )
}

const normalizePoint = (point: Vec2): Vec2 => ({
  x: Math.abs(point.x) <= EPS ? 0 : point.x,
  y: Math.abs(point.y) <= EPS ? 0 : point.y
})

const offsetLineIntersection = (
  firstStart: Vec2,
  firstEnd: Vec2,
  secondStart: Vec2,
  secondEnd: Vec2
): Vec2 | null => {
  const firstDelta = subtract(firstEnd, firstStart)
  const secondDelta = subtract(secondEnd, secondStart)
  const denominator = cross(firstDelta, secondDelta)
  if (Math.abs(denominator) <= EPS) {
    return null
  }

  const startDelta = subtract(secondStart, firstStart)
  const amount = cross(startDelta, secondDelta) / denominator
  return normalizePoint(add(firstStart, scale(firstDelta, amount)))
}

const getClosedSegmentRanges = (points: Vec2[], closed: boolean) => {
  if (!closed || points.length < 2) {
    return []
  }

  const segments = []
  let cursor = 0

  for (let index = 0; index < points.length; index += 1) {
    const start = points[index]
    const end = points[(index + 1) % points.length]
    const length = distanceBetween(start, end)
    const startDistance = cursor
    const endDistance = cursor + length
    cursor = endDistance
    segments.push({
      index,
      startDistance,
      endDistance
    })
  }

  return segments
}

const getSourcePathSegmentRanges = (path: Pick<PathGeometry, 'segments'>) => {
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

const normalizeClosedGuardPoints = (points: Vec2[]) => {
  if (
    points.length > 1 &&
    distanceBetween(points[0], points[points.length - 1]) <= EPS
  ) {
    return points.slice(0, -1)
  }

  return points
}

const isSharpGuardVertex = (points: Vec2[], index: number) => {
  const candidate = points[index] as SelectedSideGuardPoint

  const previous = points[(index - 1 + points.length) % points.length]
  const point = points[index]
  const next = points[(index + 1) % points.length]
  const incoming = normalizeVector({
    x: point.x - previous.x,
    y: point.y - previous.y
  })
  const outgoing = normalizeVector({
    x: next.x - point.x,
    y: next.y - point.y
  })

  if (!incoming || !outgoing) {
    return false
  }

  const dot = Math.max(
    -1,
    Math.min(1, incoming.x * outgoing.x + incoming.y * outgoing.y)
  )
  const turnAngle = Math.acos(dot)
  if (candidate.sharp === false) {
    return false
  }

  return turnAngle >= Math.PI / 4
}

interface SharpGuardVertex {
  index: number
  sharp: boolean
  previousBoundary: Vec2[]
  nextBoundary: Vec2[]
}

export interface ClosedConstrainedStrokePolygonEntry {
  polygon: Vec2[]
  role: 'segment' | 'join'
  index: number
  sourceSegmentIndex?: number
  sourceVertexIndex?: number
  sourceStartVertexIndex?: number
  sourceEndVertexIndex?: number
  sourceEdgeStartDistanceFromSegmentStart?: number
  sourceEdgeEndDistanceToSegmentEnd?: number
  sourcePreviousSegmentIndex?: number
  sourceNextSegmentIndex?: number
  sourceDistanceToPreviousSegmentEnd?: number
  sourceDistanceFromNextSegmentStart?: number
}

interface SourcePathSampleMetadata {
  sourceSegmentIndexByEdgeIndex: number[]
  sourceVertexIndexByPointIndex: (number | undefined)[]
  sourceEdgeStartDistanceFromSegmentStartByEdgeIndex: number[]
  sourceEdgeEndDistanceToSegmentEndByEdgeIndex: number[]
}

const buildSourceSegmentBoundary = (segment: PathSegment | undefined) =>
  segment ? slicePathSegmentPoints(segment, 0, segment.length) : []

const _buildSourcePathSampleMetadata = (
  sourcePath?: Pick<PathGeometry, 'segments' | 'closed'>
): SourcePathSampleMetadata | undefined => {
  if (!sourcePath || sourcePath.segments.length === 0) {
    return undefined
  }

  const sourceSegmentIndexByEdgeIndex: number[] = []
  const sourceVertexIndexByPointIndex: (number | undefined)[] = []
  const sourceEdgeStartDistanceFromSegmentStartByEdgeIndex: number[] = []
  const sourceEdgeEndDistanceToSegmentEndByEdgeIndex: number[] = []
  let pointCursor = 0

  sourcePath.segments.forEach((segment, segmentIndex) => {
    const points = buildSourceSegmentBoundary(segment)
    if (points.length < 2) {
      return
    }
    const edgeLengths = points
      .slice(0, -1)
      .map((point, pointIndex) =>
        distanceBetween(point, points[pointIndex + 1])
      )
    const sampledSegmentLength = edgeLengths.reduce(
      (sum, length) => sum + length,
      0
    )
    const edgeStartDistances: number[] = []
    let accumulatedEdgeLength = 0
    edgeLengths.forEach((length, index) => {
      edgeStartDistances[index] = accumulatedEdgeLength
      accumulatedEdgeLength += length
    })

    const setEdgeDistanceMetadata = (edgeIndex: number, pointIndex: number) => {
      const startDistance = edgeStartDistances[pointIndex] ?? 0
      const endDistance = Math.max(
        sampledSegmentLength - startDistance - edgeLengths[pointIndex],
        0
      )
      sourceEdgeStartDistanceFromSegmentStartByEdgeIndex[edgeIndex] =
        startDistance
      sourceEdgeEndDistanceToSegmentEndByEdgeIndex[edgeIndex] = endDistance
    }

    if (pointCursor === 0) {
      sourceVertexIndexByPointIndex[0] = segmentIndex
      for (
        let pointIndex = 0;
        pointIndex < points.length - 1;
        pointIndex += 1
      ) {
        sourceSegmentIndexByEdgeIndex[pointCursor + pointIndex] = segmentIndex
        setEdgeDistanceMetadata(pointCursor + pointIndex, pointIndex)
      }
      pointCursor = points.length - 1
      sourceVertexIndexByPointIndex[pointCursor] =
        (segmentIndex + 1) % sourcePath.segments.length
      return
    }

    sourceVertexIndexByPointIndex[pointCursor] = segmentIndex
    for (let pointIndex = 1; pointIndex < points.length - 1; pointIndex += 1) {
      sourceVertexIndexByPointIndex[pointCursor + pointIndex] = undefined
    }
    for (let pointIndex = 0; pointIndex < points.length - 1; pointIndex += 1) {
      sourceSegmentIndexByEdgeIndex[pointCursor + pointIndex] = segmentIndex
      setEdgeDistanceMetadata(pointCursor + pointIndex, pointIndex)
    }
    pointCursor += points.length - 1
    sourceVertexIndexByPointIndex[pointCursor] =
      (segmentIndex + 1) % sourcePath.segments.length
  })

  return {
    sourceSegmentIndexByEdgeIndex,
    sourceVertexIndexByPointIndex,
    sourceEdgeStartDistanceFromSegmentStartByEdgeIndex,
    sourceEdgeEndDistanceToSegmentEndByEdgeIndex
  }
}

const findNearestSegmentRange = (
  point: Vec2,
  topologyPoints: Vec2[],
  segmentRanges: ReturnType<typeof getClosedSegmentRanges>
) => {
  let nearestIndex = -1
  let nearestDistanceSquared = Number.POSITIVE_INFINITY

  topologyPoints.forEach((candidate, index) => {
    const distanceSquared =
      (candidate.x - point.x) * (candidate.x - point.x) +
      (candidate.y - point.y) * (candidate.y - point.y)
    if (distanceSquared < nearestDistanceSquared) {
      nearestIndex = index
      nearestDistanceSquared = distanceSquared
    }
  })

  return nearestIndex >= 0 ? segmentRanges[nearestIndex] : undefined
}

const buildSharpGuardVertices = (
  topologyPoints: Vec2[],
  segmentRanges: ReturnType<typeof getClosedSegmentRanges>,
  guardPoints: SelectedSideGuardPoint[] = topologyPoints,
  sourcePath?: Pick<PathGeometry, 'segments' | 'closed'>
): SharpGuardVertex[] => {
  const normalizedGuardPoints = normalizeClosedGuardPoints(guardPoints)
  if (normalizedGuardPoints.length < 3) {
    return []
  }

  const canUseSourcePathSegments =
    sourcePath?.closed === true &&
    sourcePath.segments.length === normalizedGuardPoints.length
  const canUseDirectGuardRange =
    normalizedGuardPoints.length === segmentRanges.length
  const sourcePathSegmentRanges = canUseSourcePathSegments
    ? getSourcePathSegmentRanges(sourcePath)
    : []
  const vertices: SharpGuardVertex[] = []

  for (let index = 0; index < normalizedGuardPoints.length; index += 1) {
    const sharp = isSharpGuardVertex(normalizedGuardPoints, index)
    if (!sharp && !canUseSourcePathSegments) {
      continue
    }

    const point = normalizedGuardPoints[index]
    const segment = canUseSourcePathSegments
      ? sourcePathSegmentRanges[index]
      : canUseDirectGuardRange
        ? segmentRanges[index]
        : findNearestSegmentRange(point, topologyPoints, segmentRanges)
    if (!segment) {
      continue
    }

    const previous =
      normalizedGuardPoints[
        (index - 1 + normalizedGuardPoints.length) %
          normalizedGuardPoints.length
      ]
    const next =
      normalizedGuardPoints[(index + 1) % normalizedGuardPoints.length]
    const previousBoundary = canUseSourcePathSegments
      ? buildSourceSegmentBoundary(
          sourcePath.segments[
            (index - 1 + sourcePath.segments.length) %
              sourcePath.segments.length
          ]
        )
      : [previous, point]
    const nextBoundary = canUseSourcePathSegments
      ? buildSourceSegmentBoundary(sourcePath.segments[index])
      : [point, next]
    vertices.push({
      index,
      sharp,
      previousBoundary,
      nextBoundary
    })
  }

  return vertices
}

interface ClipEdge {
  start: Vec2
  end: Vec2
  dx: number
  dy: number
}

const buildClipEdges = (boundary: Vec2[]): ClipEdge[] =>
  boundary.map((start, index) => {
    const end = boundary[(index + 1) % boundary.length]
    return {
      start,
      end,
      dx: end.x - start.x,
      dy: end.y - start.y
    }
  })

const isPointInsideClipEdge = (
  point: Vec2,
  edge: ClipEdge,
  orientation: number
) => {
  const value =
    edge.dx * (point.y - edge.start.y) - edge.dy * (point.x - edge.start.x)
  return orientation > 0 ? value >= -EPS : value <= EPS
}

const boundaryLineIntersection = (
  segmentStart: Vec2,
  segmentEnd: Vec2,
  edgeStart: Vec2,
  edgeEnd: Vec2
): Vec2 => {
  const intersection = offsetLineIntersection(
    segmentStart,
    segmentEnd,
    edgeStart,
    edgeEnd
  )

  return intersection ?? normalizePoint(segmentEnd)
}

const clipPolygonToInsideBoundary = (
  polygon: Vec2[],
  boundary: ClipEdge[],
  orientation: number
) => {
  let output = polygon.map(normalizePoint)

  for (const edge of boundary) {
    const input = output
    output = []
    if (input.length === 0) {
      break
    }

    input.forEach((current, currentIndex) => {
      const previous = input[(currentIndex - 1 + input.length) % input.length]
      const currentInside = isPointInsideClipEdge(current, edge, orientation)
      const previousInside = isPointInsideClipEdge(previous, edge, orientation)

      if (currentInside) {
        if (!previousInside) {
          output.push(
            boundaryLineIntersection(previous, current, edge.start, edge.end)
          )
        }
        output.push(current)
        return
      }

      if (previousInside) {
        output.push(
          boundaryLineIntersection(previous, current, edge.start, edge.end)
        )
      }
    })
  }

  return dedupeClosed(output)
}

const pointSegmentDistance = (point: Vec2, start: Vec2, end: Vec2) => {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared <= EPS) {
    return distanceBetween(point, start)
  }

  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared
    )
  )
  return distanceBetween(point, {
    x: start.x + dx * t,
    y: start.y + dy * t
  })
}

const segmentBoundsOverlapPolygon = (
  segmentStart: Vec2,
  segmentEnd: Vec2,
  polygon: Vec2[]
) => {
  const minX = Math.min(segmentStart.x, segmentEnd.x) - EPS
  const maxX = Math.max(segmentStart.x, segmentEnd.x) + EPS
  const minY = Math.min(segmentStart.y, segmentEnd.y) - EPS
  const maxY = Math.max(segmentStart.y, segmentEnd.y) + EPS
  return polygon.some(
    (point) =>
      point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY
  )
}

const clipPolygonToSelectedSideOfSegment = (
  polygon: Vec2[],
  segmentStart: Vec2,
  segmentEnd: Vec2,
  selectedSide: 1 | -1
) => {
  const dx = segmentEnd.x - segmentStart.x
  const dy = segmentEnd.y - segmentStart.y
  const isInside = (point: Vec2) => {
    const value =
      dx * (point.y - segmentStart.y) - dy * (point.x - segmentStart.x)
    return selectedSide > 0 ? value >= -EPS : value <= EPS
  }
  const output: Vec2[] = []

  for (let currentIndex = 0; currentIndex < polygon.length; currentIndex += 1) {
    const current = polygon[currentIndex]
    const previous =
      polygon[(currentIndex - 1 + polygon.length) % polygon.length]
    const currentInside = isInside(current)
    const previousInside = isInside(previous)

    if (currentInside) {
      if (!previousInside) {
        output.push(
          boundaryLineIntersection(previous, current, segmentStart, segmentEnd)
        )
      }
      output.push(current)
      continue
    }

    if (previousInside) {
      output.push(
        boundaryLineIntersection(previous, current, segmentStart, segmentEnd)
      )
    }
  }

  return dedupeClosed(output)
}

interface SegmentIntersectionHit {
  point: Vec2
  polygonEdgeIndex: number
  polygonT: number
  boundaryEdgeIndex: number
  boundaryT: number
  polygonPosition: number
  boundaryPosition: number
}

const segmentIntersectionWithParams = (
  polygonStart: Vec2,
  polygonEnd: Vec2,
  boundaryStart: Vec2,
  boundaryEnd: Vec2
) => {
  const rx = polygonEnd.x - polygonStart.x
  const ry = polygonEnd.y - polygonStart.y
  const sx = boundaryEnd.x - boundaryStart.x
  const sy = boundaryEnd.y - boundaryStart.y
  const denominator = rx * sy - ry * sx
  if (Math.abs(denominator) <= EPS) {
    return null
  }

  const qpx = boundaryStart.x - polygonStart.x
  const qpy = boundaryStart.y - polygonStart.y
  const t = (qpx * sy - qpy * sx) / denominator
  const u = (qpx * ry - qpy * rx) / denominator
  if (t < -EPS || t > 1 + EPS || u < -EPS || u > 1 + EPS) {
    return null
  }

  const clampedT = Math.max(0, Math.min(1, t))
  const clampedU = Math.max(0, Math.min(1, u))
  return {
    point: normalizePoint({
      x: polygonStart.x + rx * clampedT,
      y: polygonStart.y + ry * clampedT
    }),
    polygonT: clampedT,
    boundaryT: clampedU
  }
}

const getPolylineClipIntersections = (
  polygon: Vec2[],
  boundary: Vec2[]
): SegmentIntersectionHit[] => {
  const hits: SegmentIntersectionHit[] = []
  for (
    let polygonEdgeIndex = 0;
    polygonEdgeIndex < polygon.length;
    polygonEdgeIndex += 1
  ) {
    const polygonStart = polygon[polygonEdgeIndex]
    const polygonEnd = polygon[(polygonEdgeIndex + 1) % polygon.length]
    for (
      let boundaryEdgeIndex = 0;
      boundaryEdgeIndex < boundary.length - 1;
      boundaryEdgeIndex += 1
    ) {
      const boundaryStart = boundary[boundaryEdgeIndex]
      const boundaryEnd = boundary[boundaryEdgeIndex + 1]
      const hit = segmentIntersectionWithParams(
        polygonStart,
        polygonEnd,
        boundaryStart,
        boundaryEnd
      )
      if (!hit) {
        continue
      }
      if (
        hits.some(
          (existing) => distanceBetween(existing.point, hit.point) <= EPS
        )
      ) {
        continue
      }
      hits.push({
        point: hit.point,
        polygonEdgeIndex,
        polygonT: hit.polygonT,
        boundaryEdgeIndex,
        boundaryT: hit.boundaryT,
        polygonPosition: polygonEdgeIndex + hit.polygonT,
        boundaryPosition: boundaryEdgeIndex + hit.boundaryT
      })
    }
  }

  return hits
}

const pushDedupePoint = (points: Vec2[], point: Vec2) => {
  const previous = points[points.length - 1]
  if (!previous || distanceBetween(previous, point) > EPS) {
    points.push(point)
  }
}

const getPolygonPathBetweenHits = (
  polygon: Vec2[],
  from: SegmentIntersectionHit,
  to: SegmentIntersectionHit
) => {
  const result: Vec2[] = []
  pushDedupePoint(result, from.point)

  let vertexIndex = (from.polygonEdgeIndex + 1) % polygon.length
  while (vertexIndex !== (to.polygonEdgeIndex + 1) % polygon.length) {
    pushDedupePoint(result, polygon[vertexIndex])
    vertexIndex = (vertexIndex + 1) % polygon.length
  }

  pushDedupePoint(result, to.point)
  return result
}

const getBoundaryPathBetweenHits = (
  boundary: Vec2[],
  from: SegmentIntersectionHit,
  to: SegmentIntersectionHit
): Vec2[] => {
  if (from.boundaryPosition <= to.boundaryPosition) {
    const result: Vec2[] = []
    pushDedupePoint(result, from.point)
    for (
      let vertexIndex = from.boundaryEdgeIndex + 1;
      vertexIndex <= to.boundaryEdgeIndex;
      vertexIndex += 1
    ) {
      pushDedupePoint(result, boundary[vertexIndex])
    }
    pushDedupePoint(result, to.point)
    return result
  }

  return getBoundaryPathBetweenHits(boundary, to, from).reverse()
}

const clipPolygonToSelectedSidePolylineIfCrossing = (
  polygon: Vec2[],
  boundary: Vec2[],
  selectedSide: 1 | -1,
  sourceBoundary?: Vec2[]
) => {
  if (polygon.length < 3 || boundary.length < 2) {
    return null
  }

  const hits = getPolylineClipIntersections(polygon, boundary).sort(
    (left, right) => left.boundaryPosition - right.boundaryPosition
  )
  if (hits.length < 2) {
    return null
  }

  const first = hits[0]
  const last = hits[hits.length - 1]
  const candidates = [
    dedupeClosed([
      ...getPolygonPathBetweenHits(polygon, first, last),
      ...getBoundaryPathBetweenHits(boundary, last, first).slice(1)
    ]),
    dedupeClosed([
      ...getPolygonPathBetweenHits(polygon, last, first),
      ...getBoundaryPathBetweenHits(boundary, first, last).slice(1)
    ])
  ].filter((candidate) => candidate.length >= 3)

  if (candidates.length === 0) {
    return null
  }

  return candidates.sort((left, right) => {
    if (sourceBoundary && sourceBoundary.length >= 3) {
      const outsideDelta =
        getSourceBoundaryOutsideScore(left, sourceBoundary) -
        getSourceBoundaryOutsideScore(right, sourceBoundary)
      if (Math.abs(outsideDelta) > EPS) {
        return outsideDelta
      }
    }

    const scoreDelta =
      getSelectedSideViolationScore(left, boundary, selectedSide) -
      getSelectedSideViolationScore(right, boundary, selectedSide)
    if (Math.abs(scoreDelta) > EPS) {
      return scoreDelta
    }
    return Math.abs(polygonArea(left)) - Math.abs(polygonArea(right))
  })[0]
}

const clipPolygonToSelectedSideIfCrossing = (
  polygon: Vec2[],
  segmentStart: Vec2,
  segmentEnd: Vec2,
  selectedSide: 1 | -1
) => {
  if (
    polygon.length < 3 ||
    !segmentBoundsOverlapPolygon(segmentStart, segmentEnd, polygon)
  ) {
    return polygon
  }

  const dx = segmentEnd.x - segmentStart.x
  const dy = segmentEnd.y - segmentStart.y
  let hasInside = false
  let hasOutside = false

  for (const point of polygon) {
    const cross =
      dx * (point.y - segmentStart.y) - dy * (point.x - segmentStart.x)
    const inside = selectedSide > 0 ? cross >= -EPS : cross <= EPS
    hasInside ||= inside
    hasOutside ||= !inside
    if (hasInside && hasOutside) {
      return clipPolygonToSelectedSideOfSegment(
        polygon,
        segmentStart,
        segmentEnd,
        selectedSide
      )
    }
  }

  return polygon
}

const getBoundaryHead = (boundary: Vec2[], reach: number) => {
  if (boundary.length <= 2) {
    return boundary
  }

  const result = [boundary[0]]
  let length = 0
  for (let index = 1; index < boundary.length; index += 1) {
    const previous = boundary[index - 1]
    const current = boundary[index]
    length += distanceBetween(previous, current)
    result.push(current)
    if (length >= reach - EPS) {
      break
    }
  }
  return result
}

const getBoundaryTail = (boundary: Vec2[], reach: number) => {
  if (boundary.length <= 2) {
    return boundary
  }

  const result = [boundary[boundary.length - 1]]
  let length = 0
  for (let index = boundary.length - 2; index >= 0; index -= 1) {
    const previous = boundary[index + 1]
    const current = boundary[index]
    length += distanceBetween(previous, current)
    result.push(current)
    if (length >= reach - EPS) {
      break
    }
  }
  return result.reverse()
}

const clipPolygonToSelectedSideBoundaryIfCrossing = (
  polygon: Vec2[],
  boundary: Vec2[],
  selectedSide: 1 | -1,
  sourceBoundary?: Vec2[]
) => {
  if (polygon.length < 3 || boundary.length < 2) {
    return polygon
  }

  const polylineClipped = clipPolygonToSelectedSidePolylineIfCrossing(
    polygon,
    boundary,
    selectedSide,
    sourceBoundary
  )
  if (polylineClipped) {
    return polylineClipped
  }

  let currentPolygon = polygon
  for (let index = 0; index < boundary.length - 1; index += 1) {
    if (currentPolygon.length < 3) {
      break
    }

    currentPolygon = clipPolygonToSelectedSideIfCrossing(
      currentPolygon,
      boundary[index],
      boundary[index + 1],
      selectedSide
    )
  }
  return currentPolygon
}

const clipPolygonToDominantSideBoundaryIfCrossing = (
  polygon: Vec2[],
  boundary: Vec2[]
) => {
  if (polygon.length < 3 || boundary.length < 2) {
    return polygon
  }

  const positiveSideViolationScore = getSelectedSideViolationScore(
    polygon,
    boundary,
    1
  )
  const negativeSideViolationScore = getSelectedSideViolationScore(
    polygon,
    boundary,
    -1
  )
  const dominantSide: 1 | -1 =
    positiveSideViolationScore <= negativeSideViolationScore ? 1 : -1

  const clipped = clipPolygonToSelectedSideBoundaryIfCrossing(
    polygon,
    boundary,
    dominantSide
  )
  if (clipped.length < 3 || isSimpleClosedPolygon(clipped)) {
    return clipped
  }

  const strictClipped = clipPolygonToSelectedSideBoundary(
    polygon,
    boundary,
    dominantSide
  )
  return strictClipped.length >= 3 &&
    (isSimpleClosedPolygon(strictClipped) ||
      Math.abs(polygonArea(strictClipped)) < Math.abs(polygonArea(clipped)))
    ? strictClipped
    : clipped
}

const getBoundaryHeadReferencePoint = (boundary: Vec2[], reach: number) => {
  const head = getBoundaryHead(boundary, reach)
  return head[head.length - 1] ?? boundary[0]
}

const getBoundaryTailReferencePoint = (boundary: Vec2[], reach: number) => {
  const tail = getBoundaryTail(boundary, reach)
  return tail[0] ?? boundary[boundary.length - 1]
}

const getSelectedSideTowardPoint = (
  boundary: Vec2[],
  point: Vec2 | undefined,
  fallback: 1 | -1
): 1 | -1 => {
  if (!point || boundary.length < 2) {
    return fallback
  }

  let nearestCross = 0
  let nearestDistance = Number.POSITIVE_INFINITY
  for (let index = 0; index < boundary.length - 1; index += 1) {
    const start = boundary[index]
    const end = boundary[index + 1]
    const cross =
      (end.x - start.x) * (point.y - start.y) -
      (end.y - start.y) * (point.x - start.x)
    const distanceToSegment = pointSegmentDistance(point, start, end)
    if (distanceToSegment < nearestDistance) {
      nearestDistance = distanceToSegment
      nearestCross = cross
    }
  }

  if (Math.abs(nearestCross) <= EPS) {
    return fallback
  }

  return nearestCross > 0 ? 1 : -1
}

const clipPolygonToSelectedSideBoundary = (
  polygon: Vec2[],
  boundary: Vec2[],
  selectedSide: 1 | -1
) => {
  if (polygon.length < 3 || boundary.length < 2) {
    return polygon
  }

  let currentPolygon = polygon
  for (let index = 0; index < boundary.length - 1; index += 1) {
    if (currentPolygon.length < 3) {
      break
    }

    currentPolygon = clipPolygonToSelectedSideOfSegment(
      currentPolygon,
      boundary[index],
      boundary[index + 1],
      selectedSide
    )
  }

  return currentPolygon
}

const getSelectedSideViolationScore = (
  polygon: Vec2[],
  boundary: Vec2[],
  selectedSide: 1 | -1
) => {
  let score = 0
  for (const point of polygon) {
    let nearestCross = 0
    let nearestDistance = Number.POSITIVE_INFINITY
    for (let index = 0; index < boundary.length - 1; index += 1) {
      const start = boundary[index]
      const end = boundary[index + 1]
      const cross =
        (end.x - start.x) * (point.y - start.y) -
        (end.y - start.y) * (point.x - start.x)
      const distanceToSegment = pointSegmentDistance(point, start, end)
      if (distanceToSegment < nearestDistance) {
        nearestDistance = distanceToSegment
        nearestCross = cross
      }
    }
    const violation = selectedSide > 0 ? -nearestCross : nearestCross
    if (violation > EPS) {
      score += violation
    }
  }
  return score
}

const getNonZeroWinding = (point: Vec2, boundary: Vec2[]) => {
  let winding = 0
  for (let index = 0; index < boundary.length; index += 1) {
    const start = boundary[index]
    const end = boundary[(index + 1) % boundary.length]
    if (start.y <= point.y) {
      if (
        end.y > point.y &&
        cross(subtract(end, start), subtract(point, start)) > EPS
      ) {
        winding += 1
      }
      continue
    }

    if (
      end.y <= point.y &&
      cross(subtract(end, start), subtract(point, start)) < -EPS
    ) {
      winding -= 1
    }
  }
  return winding
}

const getPolygonCentroid = (polygon: Vec2[]) => {
  if (polygon.length === 0) {
    return { x: 0, y: 0 }
  }

  const sum = polygon.reduce(
    (accumulator, point) => ({
      x: accumulator.x + point.x,
      y: accumulator.y + point.y
    }),
    { x: 0, y: 0 }
  )
  return {
    x: sum.x / polygon.length,
    y: sum.y / polygon.length
  }
}

const getSourceBoundaryOutsideScore = (
  polygon: Vec2[],
  sourceBoundary: Vec2[]
) => {
  const probes = [...polygon, getPolygonCentroid(polygon)]
  let score = 0
  for (const point of probes) {
    if (getNonZeroWinding(point, sourceBoundary) === 0) {
      score += 1
    }
  }
  return score
}

const applyGuardBoundaryClip = (
  polygon: Vec2[],
  boundary: Vec2[],
  selectedSide: 1 | -1,
  mode: 'strict' | 'crossing' = 'crossing',
  sourceBoundary?: Vec2[],
  allowEmpty = false
) => {
  let clipped =
    mode === 'strict'
      ? clipPolygonToSelectedSideBoundary(polygon, boundary, selectedSide)
      : clipPolygonToSelectedSideBoundaryIfCrossing(
          polygon,
          boundary,
          selectedSide,
          sourceBoundary
        )

  if (sourceBoundary && sourceBoundary.length >= 3 && mode !== 'strict') {
    const oppositeClipped = clipPolygonToSelectedSideBoundaryIfCrossing(
      polygon,
      boundary,
      selectedSide > 0 ? -1 : 1,
      sourceBoundary
    )
    if (oppositeClipped.length >= 3) {
      const clippedOutsideScore = getSourceBoundaryOutsideScore(
        clipped,
        sourceBoundary
      )
      const oppositeOutsideScore = getSourceBoundaryOutsideScore(
        oppositeClipped,
        sourceBoundary
      )
      if (
        oppositeOutsideScore < clippedOutsideScore ||
        (oppositeOutsideScore === clippedOutsideScore &&
          Math.abs(polygonArea(oppositeClipped)) >
            Math.abs(polygonArea(clipped)))
      ) {
        clipped = oppositeClipped
      }
    }
  }

  if (clipped.length < 3) {
    return allowEmpty ? [] : polygon
  }

  if (mode === 'strict') {
    return clipped
  }

  if (sourceBoundary && sourceBoundary.length >= 3) {
    const clippedOutsideScore = getSourceBoundaryOutsideScore(
      clipped,
      sourceBoundary
    )
    const originalOutsideScore = getSourceBoundaryOutsideScore(
      polygon,
      sourceBoundary
    )
    if (clippedOutsideScore < originalOutsideScore) {
      return clipped
    }
    if (clippedOutsideScore > originalOutsideScore) {
      return polygon
    }
  }

  return getSelectedSideViolationScore(clipped, boundary, selectedSide) <=
    getSelectedSideViolationScore(polygon, boundary, selectedSide) + EPS
    ? clipped
    : polygon
}

const clipInsideSolidEntryToSharpWedge = (
  polygon: Vec2[],
  guard: SharpGuardVertex,
  reach: number,
  selectedSide: 1 | -1,
  useBoundarySelectedSide: boolean,
  sourceBoundary?: Vec2[]
) => {
  let currentPolygon = polygon

  const previousBoundary = getBoundaryTail(guard.previousBoundary, reach)
  const previousBoundarySelectedSide = getSelectedSideTowardPoint(
    previousBoundary,
    getBoundaryHeadReferencePoint(guard.nextBoundary, reach),
    selectedSide
  )
  currentPolygon = applyGuardBoundaryClip(
    currentPolygon,
    previousBoundary,
    useBoundarySelectedSide ? previousBoundarySelectedSide : selectedSide,
    'crossing',
    useBoundarySelectedSide ? undefined : sourceBoundary
  )
  if (
    useBoundarySelectedSide &&
    !sourceBoundary &&
    previousBoundary.length >= 2
  ) {
    const end = previousBoundary[previousBoundary.length - 1]
    const start = previousBoundary[previousBoundary.length - 2]
    currentPolygon = clipPolygonToSelectedSideOfSegment(
      currentPolygon,
      start,
      end,
      selectedSide
    )
  }

  const nextBoundary = getBoundaryHead(guard.nextBoundary, reach)
  const nextBoundarySelectedSide = getSelectedSideTowardPoint(
    nextBoundary,
    getBoundaryTailReferencePoint(guard.previousBoundary, reach),
    selectedSide
  )
  currentPolygon = applyGuardBoundaryClip(
    currentPolygon,
    nextBoundary,
    useBoundarySelectedSide ? nextBoundarySelectedSide : selectedSide,
    'crossing',
    useBoundarySelectedSide ? undefined : sourceBoundary
  )
  if (useBoundarySelectedSide && !sourceBoundary && nextBoundary.length >= 2) {
    currentPolygon = clipPolygonToSelectedSideOfSegment(
      currentPolygon,
      nextBoundary[0],
      nextBoundary[1],
      selectedSide
    )
  }

  return currentPolygon
}

const clipInsideSolidEntryToPreviousSharpBoundary = (
  polygon: Vec2[],
  guard: SharpGuardVertex,
  reach: number,
  selectedSide: 1 | -1,
  useBoundarySelectedSide: boolean,
  sourceBoundary?: Vec2[]
) => {
  const previousBoundary = getBoundaryTail(guard.previousBoundary, reach)
  const previousBoundarySelectedSide = getSelectedSideTowardPoint(
    previousBoundary,
    getBoundaryHeadReferencePoint(guard.nextBoundary, reach),
    selectedSide
  )
  let currentPolygon = applyGuardBoundaryClip(
    polygon,
    previousBoundary,
    useBoundarySelectedSide ? previousBoundarySelectedSide : selectedSide,
    'crossing',
    useBoundarySelectedSide ? undefined : sourceBoundary,
    true
  )
  if (
    useBoundarySelectedSide &&
    !sourceBoundary &&
    previousBoundary.length >= 2
  ) {
    const end = previousBoundary[previousBoundary.length - 1]
    const start = previousBoundary[previousBoundary.length - 2]
    currentPolygon = clipPolygonToSelectedSideOfSegment(
      currentPolygon,
      start,
      end,
      previousBoundarySelectedSide
    )
  }
  return currentPolygon
}

const clipInsideSolidEntryToNextSharpBoundary = (
  polygon: Vec2[],
  guard: SharpGuardVertex,
  reach: number,
  selectedSide: 1 | -1,
  useBoundarySelectedSide: boolean,
  sourceBoundary?: Vec2[]
) => {
  const nextBoundary = getBoundaryHead(guard.nextBoundary, reach)
  const nextBoundarySelectedSide = getSelectedSideTowardPoint(
    nextBoundary,
    getBoundaryTailReferencePoint(guard.previousBoundary, reach),
    selectedSide
  )
  let currentPolygon = applyGuardBoundaryClip(
    polygon,
    nextBoundary,
    useBoundarySelectedSide ? nextBoundarySelectedSide : selectedSide,
    'crossing',
    useBoundarySelectedSide ? undefined : sourceBoundary,
    true
  )
  if (useBoundarySelectedSide && !sourceBoundary && nextBoundary.length >= 2) {
    currentPolygon = clipPolygonToSelectedSideOfSegment(
      currentPolygon,
      nextBoundary[0],
      nextBoundary[1],
      nextBoundarySelectedSide
    )
  }
  return currentPolygon
}

const clipInsideSolidJoinEntryToSharpGuard = (
  polygon: Vec2[],
  entry: ClosedConstrainedStrokePolygonEntry,
  guard: SharpGuardVertex,
  sourceLength: number,
  reach: number,
  endpointReach: number,
  selectedSide: 1 | -1,
  useBoundarySelectedSide: boolean,
  sourceBoundary?: Vec2[]
) => {
  if (!guard.sharp) {
    let currentPolygon = polygon
    const previousSegmentIndex = (guard.index - 1 + sourceLength) % sourceLength
    const nearGuardStart =
      entry.sourceNextSegmentIndex === guard.index &&
      entry.sourceDistanceFromNextSegmentStart !== undefined &&
      entry.sourceDistanceFromNextSegmentStart <= endpointReach + EPS
    const nearGuardEnd =
      entry.sourcePreviousSegmentIndex === previousSegmentIndex &&
      entry.sourceDistanceToPreviousSegmentEnd !== undefined &&
      entry.sourceDistanceToPreviousSegmentEnd <= endpointReach + EPS

    if (nearGuardStart) {
      currentPolygon = applyGuardBoundaryClip(
        currentPolygon,
        getBoundaryTail(guard.previousBoundary, reach),
        selectedSide > 0 ? -1 : 1,
        'strict',
        sourceBoundary,
        true
      )
      if (currentPolygon.length >= 3) {
        currentPolygon = clipPolygonToDominantSideBoundaryIfCrossing(
          currentPolygon,
          getBoundaryHead(guard.nextBoundary, reach)
        )
      }
    }
    if (nearGuardEnd && currentPolygon.length >= 3) {
      currentPolygon = applyGuardBoundaryClip(
        currentPolygon,
        getBoundaryHead(guard.nextBoundary, reach),
        selectedSide > 0 ? -1 : 1,
        'strict',
        sourceBoundary,
        true
      )
      if (currentPolygon.length >= 3) {
        currentPolygon = clipPolygonToDominantSideBoundaryIfCrossing(
          currentPolygon,
          getBoundaryTail(guard.previousBoundary, reach)
        )
      }
    }

    return currentPolygon
  }

  const entrySourceVertexIndex = entry.sourceVertexIndex ?? entry.index
  if (guard.index === entrySourceVertexIndex) {
    return clipInsideSolidEntryToSharpWedge(
      polygon,
      guard,
      reach,
      selectedSide,
      useBoundarySelectedSide,
      sourceBoundary
    )
  }

  let currentPolygon = polygon
  const previousSegmentIndex = (guard.index - 1 + sourceLength) % sourceLength
  const nearGuardStart =
    entry.sourceNextSegmentIndex === guard.index &&
    entry.sourceDistanceFromNextSegmentStart !== undefined &&
    entry.sourceDistanceFromNextSegmentStart <= endpointReach + EPS
  const nearGuardEnd =
    entry.sourcePreviousSegmentIndex === previousSegmentIndex &&
    entry.sourceDistanceToPreviousSegmentEnd !== undefined &&
    entry.sourceDistanceToPreviousSegmentEnd <= endpointReach + EPS

  if (nearGuardStart) {
    currentPolygon = clipInsideSolidEntryToPreviousSharpBoundary(
      currentPolygon,
      guard,
      reach,
      selectedSide,
      useBoundarySelectedSide,
      sourceBoundary
    )
  }
  if (nearGuardEnd && currentPolygon.length >= 3) {
    currentPolygon = clipInsideSolidEntryToNextSharpBoundary(
      currentPolygon,
      guard,
      reach,
      selectedSide,
      useBoundarySelectedSide,
      sourceBoundary
    )
  }

  return currentPolygon
}

const clipInsideSolidSegmentEntryToSharpGuard = (
  polygon: Vec2[],
  entry: ClosedConstrainedStrokePolygonEntry,
  guard: SharpGuardVertex,
  sourceLength: number,
  reach: number,
  endpointReach: number,
  selectedSide: 1 | -1,
  useBoundarySelectedSide: boolean,
  sourceBoundary?: Vec2[]
) => {
  const entrySourceSegmentIndex = entry.sourceSegmentIndex ?? entry.index
  if (entrySourceSegmentIndex === guard.index) {
    const touchesGuardStart =
      entry.sourceStartVertexIndex === guard.index ||
      (entry.sourceEdgeStartDistanceFromSegmentStart !== undefined &&
        entry.sourceEdgeStartDistanceFromSegmentStart <= endpointReach + EPS)
    if (!touchesGuardStart) {
      return polygon
    }
    if (guard.sharp) {
      return clipInsideSolidEntryToPreviousSharpBoundary(
        polygon,
        guard,
        reach,
        selectedSide,
        useBoundarySelectedSide,
        sourceBoundary
      )
    }

    const previousBoundary = getBoundaryTail(guard.previousBoundary, reach)
    let currentPolygon = applyGuardBoundaryClip(
      polygon,
      previousBoundary,
      selectedSide > 0 ? -1 : 1,
      'strict',
      sourceBoundary,
      true
    )
    if (currentPolygon.length < 3) {
      return currentPolygon
    }

    currentPolygon = clipPolygonToDominantSideBoundaryIfCrossing(
      currentPolygon,
      getBoundaryHead(guard.nextBoundary, reach)
    )
    return currentPolygon
  }

  const previousSegmentIndex = (guard.index - 1 + sourceLength) % sourceLength
  if (entrySourceSegmentIndex === previousSegmentIndex) {
    const touchesGuardEnd =
      entry.sourceEndVertexIndex === guard.index ||
      (entry.sourceEdgeEndDistanceToSegmentEnd !== undefined &&
        entry.sourceEdgeEndDistanceToSegmentEnd <= endpointReach + EPS)
    if (!touchesGuardEnd) {
      return polygon
    }
    if (guard.sharp) {
      return clipInsideSolidEntryToNextSharpBoundary(
        polygon,
        guard,
        reach,
        selectedSide,
        useBoundarySelectedSide,
        sourceBoundary
      )
    }

    const nextBoundary = getBoundaryHead(guard.nextBoundary, reach)
    let currentPolygon = applyGuardBoundaryClip(
      polygon,
      nextBoundary,
      selectedSide > 0 ? -1 : 1,
      'strict',
      sourceBoundary,
      true
    )
    if (currentPolygon.length < 3) {
      return currentPolygon
    }

    currentPolygon = clipPolygonToDominantSideBoundaryIfCrossing(
      currentPolygon,
      getBoundaryTail(guard.previousBoundary, reach)
    )
    return currentPolygon
  }

  return polygon
}

const clipInsideSolidEntryToSharpGuards = (
  entry: ClosedConstrainedStrokePolygonEntry,
  guardVertices: SharpGuardVertex[],
  sourceLength: number,
  reach: number,
  endpointReach: number,
  selectedSide: 1 | -1,
  useBoundarySelectedSide: boolean,
  sourceBoundary?: Vec2[]
) => {
  let polygon = entry.polygon

  for (const guard of guardVertices) {
    if (polygon.length < 3) {
      break
    }

    if (entry.role === 'join') {
      polygon = clipInsideSolidJoinEntryToSharpGuard(
        polygon,
        entry,
        guard,
        sourceLength,
        reach,
        endpointReach,
        selectedSide,
        useBoundarySelectedSide,
        sourceBoundary
      )
      continue
    }

    polygon = clipInsideSolidSegmentEntryToSharpGuard(
      polygon,
      entry,
      guard,
      sourceLength,
      reach,
      endpointReach,
      selectedSide,
      useBoundarySelectedSide,
      sourceBoundary
    )
  }

  return polygon
}

const _applyInsideSolidSharpGuardClippingToEntries = (
  entries: ClosedConstrainedStrokePolygonEntry[],
  source: Vec2[],
  stroke: Pick<RenderableStroke, 'position' | 'width' | 'miterLimit'>,
  selectedSide: 1 | -1,
  selectedSideGuardPoints?: SelectedSideGuardPoint[],
  sourcePath?: Pick<PathGeometry, 'segments' | 'closed'>
) => {
  if (entries.length === 0 || stroke.position !== 'inside') {
    return entries
  }
  if (!selectedSideGuardPoints && !sourcePath) {
    return entries
  }

  const segmentRanges = getClosedSegmentRanges(source, true)
  const guardVertices = buildSharpGuardVertices(
    source,
    segmentRanges,
    selectedSideGuardPoints,
    sourcePath
  )
  if (guardVertices.length === 0) {
    return entries
  }

  const useBoundarySelectedSide = Boolean(selectedSideGuardPoints || sourcePath)
  const reach = Math.max(stroke.width * stroke.miterLimit, stroke.width, 1)
  const endpointReach = sourcePath ? Math.max(stroke.width * 1.5, 1) : reach
  const sourceTopologyLength = sourcePath?.segments.length ?? source.length
  return entries
    .map((entry): ClosedConstrainedStrokePolygonEntry | null => {
      const polygon = clipInsideSolidEntryToSharpGuards(
        entry,
        guardVertices,
        sourceTopologyLength,
        reach,
        endpointReach,
        selectedSide,
        useBoundarySelectedSide,
        sourcePath ? source : undefined
      )
      return polygon && polygon.length >= 3 ? { ...entry, polygon } : null
    })
    .filter((entry): entry is ClosedConstrainedStrokePolygonEntry =>
      Boolean(entry)
    )
}

const buildClosedOneSidedJoinFace = (
  point: Vec2,
  previousSegment: { start: Vec2; end: Vec2 },
  nextSegment: { start: Vec2; end: Vec2 },
  stroke: Pick<RenderableStroke, 'join' | 'miterLimit' | 'width'>,
  offsetDistance: number,
  orientation: number
) => {
  if (stroke.join === 'round') {
    return [
      point,
      ...buildArcPoints(
        point,
        previousSegment.end,
        nextSegment.start,
        orientation
      )
    ]
  }

  if (stroke.join === 'bevel') {
    return [point, previousSegment.end, nextSegment.start]
  }

  const joinPoint = offsetLineIntersection(
    previousSegment.start,
    previousSegment.end,
    nextSegment.start,
    nextSegment.end
  )
  const maxMiterLength = stroke.miterLimit * Math.abs(offsetDistance)

  if (!joinPoint || distance(point, joinPoint) > maxMiterLength + EPS) {
    return [point, previousSegment.end, nextSegment.start]
  }

  return [point, previousSegment.end, joinPoint, nextSegment.start]
}

const buildClosedConstrainedStrokePolygonEntries = (
  source: Vec2[],
  constrainedOffset: number,
  orientation: number,
  stroke: Pick<
    RenderableStroke,
    'position' | 'width' | 'join' | 'miterLimit' | 'cap'
  >,
  options: {
    clipInsideToSourceBoundary?: boolean
    sourcePathSampleMetadata?: SourcePathSampleMetadata
  } = {}
) => {
  const constrainedSegments = buildOffsetSegments(
    source,
    true,
    constrainedOffset
  )
  if (constrainedSegments.length === 0) {
    return []
  }

  const entries: ClosedConstrainedStrokePolygonEntry[] = []
  const clipEdges =
    stroke.position === 'inside' && options.clipInsideToSourceBoundary !== false
      ? buildClipEdges(source)
      : []
  const pushPolygon = (
    rawPoints: Vec2[],
    role: ClosedConstrainedStrokePolygonEntry['role'],
    index: number
  ) => {
    const polygon =
      stroke.position === 'inside' &&
      options.clipInsideToSourceBoundary !== false
        ? clipPolygonToInsideBoundary(rawPoints, clipEdges, orientation)
        : dedupeClosed(rawPoints.map(normalizePoint))
    if (polygon.length >= 3) {
      entries.push({
        polygon,
        role,
        index,
        sourceSegmentIndex:
          role === 'segment'
            ? options.sourcePathSampleMetadata?.sourceSegmentIndexByEdgeIndex[
                index
              ]
            : undefined,
        sourceStartVertexIndex:
          role === 'segment'
            ? (options.sourcePathSampleMetadata?.sourceVertexIndexByPointIndex[
                index
              ] ?? index)
            : undefined,
        sourceEndVertexIndex:
          role === 'segment'
            ? (options.sourcePathSampleMetadata?.sourceVertexIndexByPointIndex[
                (index + 1) % source.length
              ] ?? (index + 1) % source.length)
            : undefined,
        sourceEdgeStartDistanceFromSegmentStart:
          role === 'segment'
            ? options.sourcePathSampleMetadata
                ?.sourceEdgeStartDistanceFromSegmentStartByEdgeIndex[index]
            : undefined,
        sourceEdgeEndDistanceToSegmentEnd:
          role === 'segment'
            ? options.sourcePathSampleMetadata
                ?.sourceEdgeEndDistanceToSegmentEndByEdgeIndex[index]
            : undefined,
        sourcePreviousSegmentIndex:
          role === 'join'
            ? options.sourcePathSampleMetadata?.sourceSegmentIndexByEdgeIndex[
                (index - 1 + source.length) % source.length
              ]
            : undefined,
        sourceNextSegmentIndex:
          role === 'join'
            ? options.sourcePathSampleMetadata?.sourceSegmentIndexByEdgeIndex[
                index
              ]
            : undefined,
        sourceDistanceToPreviousSegmentEnd:
          role === 'join'
            ? options.sourcePathSampleMetadata
                ?.sourceEdgeEndDistanceToSegmentEndByEdgeIndex[
                (index - 1 + source.length) % source.length
              ]
            : undefined,
        sourceDistanceFromNextSegmentStart:
          role === 'join'
            ? options.sourcePathSampleMetadata
                ?.sourceEdgeStartDistanceFromSegmentStartByEdgeIndex[index]
            : undefined,
        sourceVertexIndex:
          role === 'join'
            ? options.sourcePathSampleMetadata?.sourceVertexIndexByPointIndex[
                index
              ]
            : undefined
      })
    }
  }

  source.forEach((point, index) => {
    const nextIndex = (index + 1) % source.length
    const segment = constrainedSegments[index]
    if (!segment) {
      return
    }

    pushPolygon(
      stroke.position === 'inside'
        ? [point, source[nextIndex], segment.end, segment.start]
        : [segment.start, segment.end, source[nextIndex], point],
      'segment',
      index
    )
  })

  source.forEach((point, index) => {
    const previousIndex = (index - 1 + source.length) % source.length
    const previousSegment = constrainedSegments[previousIndex]
    const nextSegment = constrainedSegments[index]
    if (!previousSegment || !nextSegment) {
      return
    }
    const sourceVertexIndex =
      options.sourcePathSampleMetadata?.sourceVertexIndexByPointIndex[index]
    const joinStroke =
      options.sourcePathSampleMetadata && sourceVertexIndex === undefined
        ? { ...stroke, join: 'bevel' as const }
        : stroke

    pushPolygon(
      buildClosedOneSidedJoinFace(
        point,
        previousSegment,
        nextSegment,
        joinStroke,
        constrainedOffset,
        orientation
      ),
      'join',
      index
    )
  })

  return entries
}

const buildClosedConstrainedStrokePolygons = (
  source: Vec2[],
  constrainedOffset: number,
  orientation: number,
  stroke: Pick<
    RenderableStroke,
    'position' | 'width' | 'join' | 'miterLimit' | 'cap'
  >,
  options: { clipInsideToSourceBoundary?: boolean } = {}
) =>
  buildClosedConstrainedStrokePolygonEntries(
    source,
    constrainedOffset,
    orientation,
    stroke,
    options
  ).map((entry) => entry.polygon)

export const buildClosedConstrainedStrokePolygonEntriesForSource = (
  points: Vec2[],
  stroke: Pick<
    RenderableStroke,
    'position' | 'width' | 'join' | 'miterLimit' | 'cap'
  >
): ClosedConstrainedStrokePolygonEntry[] => {
  const source = normalizeClosed(points)
  if (source.length < 3) {
    return []
  }

  const orientationArea = polygonArea(source)
  const orientation = orientationArea < -EPS ? -1 : 1
  const interiorOffset = orientation > 0 ? stroke.width : -stroke.width
  const constrainedOffset =
    stroke.position === 'inside' ? interiorOffset : -interiorOffset

  return buildClosedConstrainedStrokePolygonEntries(
    source,
    constrainedOffset,
    orientation,
    stroke,
    { clipInsideToSourceBoundary: false }
  )
}

export const buildConstrainedSolidStrokePolygons = (
  points: Vec2[],
  closed: boolean,
  stroke: Pick<
    RenderableStroke,
    'style' | 'position' | 'width' | 'join' | 'miterLimit' | 'cap'
  >,
  options: {
    assumeSimpleOpen?: boolean
    assumeSimpleClosed?: boolean
    assumeNormalizedOpen?: boolean
    selectedSideGuardPoints?: SelectedSideGuardPoint[]
    sourcePath?: Pick<PathGeometry, 'segments' | 'closed'>
    exactBackend?: ExactConstrainedSolidBackend
    fillRule?: FillRule
  } = {}
): Vec2[][] => {
  if (!supportsConstrainedSolidStroke(stroke, closed)) {
    return []
  }

  if (!closed) {
    return buildOpenConstrainedStrokePolygons(points, stroke, {
      assumeSimpleOpen: options.assumeSimpleOpen,
      assumeNormalizedOpen: options.assumeNormalizedOpen
    })
  }

  const source = normalizeClosed(points)
  if (source.length < 3) {
    return []
  }

  const simpleClosed =
    options.assumeSimpleClosed === undefined
      ? isSimpleClosedPolygon(source)
      : options.assumeSimpleClosed

  if (!simpleClosed) {
    return []
  }

  const orientationArea = polygonArea(source)
  if (Math.abs(orientationArea) <= EPS) {
    return []
  }

  const orientation = orientationArea > 0 ? 1 : -1
  const interiorOffset = orientation > 0 ? stroke.width : -stroke.width
  const constrainedOffset =
    stroke.position === 'inside' ? interiorOffset : -interiorOffset

  return buildClosedConstrainedStrokePolygons(
    source,
    constrainedOffset,
    orientation,
    stroke
  )
}

export const buildConstrainedLocalSideStrokePolygons =
  buildConstrainedSolidStrokePolygons
