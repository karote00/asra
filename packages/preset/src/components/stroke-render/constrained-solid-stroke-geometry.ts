import type { RenderableStroke } from './renderable-stroke'
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

  const maxOffsetDistance = Math.max(
    Math.abs(offset),
    Math.min(stroke.miterLimit * Math.abs(offset), Math.abs(offset) * 1.75)
  )
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

    const averagedDirection = averagedOffset
      ? normalize(averagedOffset)
      : null

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
  return polygon.length >= 3 &&
    Math.abs(polygonArea(polygon)) > EPS
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
  if (options.assumeNormalizedOpen === true && source.length > 3) {
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
      const currentInside = isPointInsideClipEdge(
        current,
        edge,
        orientation
      )
      const previousInside = isPointInsideClipEdge(
        previous,
        edge,
        orientation
      )

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

const buildClosedConstrainedStrokePolygons = (
  source: Vec2[],
  constrainedOffset: number,
  orientation: number,
  stroke: Pick<
    RenderableStroke,
    'position' | 'width' | 'join' | 'miterLimit' | 'cap'
  >,
  options: { clipInsideToSourceBoundary?: boolean } = {}
) => {
  const constrainedSegments = buildOffsetSegments(
    source,
    true,
    constrainedOffset
  )
  if (constrainedSegments.length === 0) {
    return []
  }

  const polygons: Vec2[][] = []
  const clipEdges =
    stroke.position === 'inside' && options.clipInsideToSourceBoundary !== false
      ? buildClipEdges(source)
      : []
  const pushPolygon = (rawPoints: Vec2[]) => {
    const polygon =
      stroke.position === 'inside' &&
      options.clipInsideToSourceBoundary !== false
        ? clipPolygonToInsideBoundary(rawPoints, clipEdges, orientation)
        : dedupeClosed(rawPoints.map(normalizePoint))
    if (polygon.length >= 3) {
      polygons.push(polygon)
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
        : [segment.start, segment.end, source[nextIndex], point]
    )
  })

  source.forEach((point, index) => {
    const previousIndex = (index - 1 + source.length) % source.length
    const previousSegment = constrainedSegments[previousIndex]
    const nextSegment = constrainedSegments[index]
    if (!previousSegment || !nextSegment) {
      return
    }

    pushPolygon(
      buildClosedOneSidedJoinFace(
        point,
        previousSegment,
        nextSegment,
        stroke,
        constrainedOffset,
        orientation
      )
    )
  })

  return polygons
}

const buildSelfIntersectingClosedConstrainedStrokePolygons = (
  source: Vec2[],
  stroke: Pick<
    RenderableStroke,
    'position' | 'width' | 'join' | 'miterLimit' | 'cap'
  >
) => {
  const orientationArea = polygonArea(source)
  const localOrientation = orientationArea < -EPS ? -1 : 1
  const interiorOffset =
    localOrientation > 0 ? stroke.width : -stroke.width
  const constrainedOffset =
    stroke.position === 'inside' ? interiorOffset : -interiorOffset

  return buildClosedConstrainedStrokePolygons(
    source,
    constrainedOffset,
    localOrientation,
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
    return buildSelfIntersectingClosedConstrainedStrokePolygons(source, stroke)
  }

  const orientationArea = polygonArea(source)
  if (Math.abs(orientationArea) <= EPS) {
    return []
  }

  const orientation = orientationArea > 0 ? 1 : -1
  const interiorOffset = orientation > 0 ? stroke.width : -stroke.width
  const constrainedOffset =
    stroke.position === 'inside' ? interiorOffset : -interiorOffset

  if (stroke.position === 'outside' && stroke.join !== 'round') {
    const constrainedBoundary = offsetPath(
      source,
      true,
      constrainedOffset,
      stroke
    )
    if (constrainedBoundary.length !== source.length) {
      return []
    }

    const constrainedSegments =
      stroke.join === 'bevel'
        ? buildOffsetSegments(source, true, constrainedOffset)
        : null

    return source.flatMap((_, index) => {
      const nextIndex = (index + 1) % source.length
      const segment = constrainedSegments?.[index] ?? null
      const polygon = segment
        ? dedupeClosed([
            segment.start,
            segment.end,
            source[nextIndex],
            source[index]
          ])
        : dedupeClosed([
            constrainedBoundary[index],
            constrainedBoundary[nextIndex],
            source[nextIndex],
            source[index]
          ])

      return polygon.length >= 3 ? [polygon] : []
    })
  }

  return buildClosedConstrainedStrokePolygons(
    source,
    constrainedOffset,
    orientation,
    stroke
  )
}
