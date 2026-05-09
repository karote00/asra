import type { RenderableStroke } from './renderable-stroke'

export interface Vec2 {
  x: number
  y: number
}

export const EPS = 1e-6
const EPS_SQUARED = EPS * EPS

export const distance = (from: Vec2, to: Vec2) =>
  Math.hypot(to.x - from.x, to.y - from.y)

const distanceSquared = (from: Vec2, to: Vec2) => {
  const dx = to.x - from.x
  const dy = to.y - from.y
  return dx * dx + dy * dy
}

export const add = (a: Vec2, b: Vec2): Vec2 => ({
  x: a.x + b.x,
  y: a.y + b.y
})

export const subtract = (a: Vec2, b: Vec2): Vec2 => ({
  x: a.x - b.x,
  y: a.y - b.y
})

export const scale = (point: Vec2, amount: number): Vec2 => ({
  x: point.x * amount,
  y: point.y * amount
})

export const normalize = (point: Vec2): Vec2 | null => {
  const length = Math.hypot(point.x, point.y)
  if (length <= EPS) {
    return null
  }

  return {
    x: point.x / length,
    y: point.y / length
  }
}

interface RoundStrokeArcSamplingOptions {
  maxAngle?: number
  maxLength?: number
}

const ROUND_STROKE_ARC_MAX_ANGLE = Math.PI / 12
const ROUND_STROKE_ARC_MAX_LENGTH = 0.75
export const ROUND_STROKE_CAP_ARC_SAMPLING: RoundStrokeArcSamplingOptions = {
  maxLength: 0.25
}

const getRoundStrokeArcSegmentCount = (
  radius: number,
  sweep: number,
  minSegments: number,
  options: RoundStrokeArcSamplingOptions = {}
) => {
  const absoluteSweep = Math.abs(sweep)
  if (radius <= EPS || absoluteSweep <= EPS) {
    return minSegments
  }
  const maxAngle = options.maxAngle ?? ROUND_STROKE_ARC_MAX_ANGLE
  const maxLength = options.maxLength ?? ROUND_STROKE_ARC_MAX_LENGTH

  return Math.max(
    minSegments,
    Math.ceil(absoluteSweep / maxAngle),
    Math.ceil((absoluteSweep * radius) / maxLength)
  )
}

export const buildRoundStrokeArcPoints = (
  center: Vec2,
  radius: number,
  startAngle: number,
  sweep: number,
  minSegments = 2,
  options: RoundStrokeArcSamplingOptions = {}
) => {
  const segmentCount = getRoundStrokeArcSegmentCount(
    radius,
    sweep,
    minSegments,
    options
  )
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

export const buildRoundStrokeArcPointsBetween = (
  center: Vec2,
  start: Vec2,
  end: Vec2,
  sweepSign: number,
  minSegments = 2,
  options: RoundStrokeArcSamplingOptions = {}
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

  return buildRoundStrokeArcPoints(
    center,
    distance(center, start),
    startAngle,
    sweep,
    minSegments,
    options
  )
}

export const perpendicularLeft = (from: Vec2, to: Vec2): Vec2 | null => {
  const delta = subtract(to, from)
  const normalized = normalize(delta)
  if (!normalized) {
    return null
  }

  return {
    x: -normalized.y,
    y: normalized.x
  }
}

export const dedupeAdjacent = (points: Vec2[]) => {
  if (points.length <= 1) {
    return [...points]
  }

  const result = [points[0]]
  for (let index = 1; index < points.length; index += 1) {
    if (
      distanceSquared(result[result.length - 1], points[index]) > EPS_SQUARED
    ) {
      result.push(points[index])
    }
  }
  return result
}

export const normalizeClosed = (points: Vec2[]) => {
  if (
    points.length > 1 &&
    distanceSquared(points[0], points[points.length - 1]) <= EPS_SQUARED
  ) {
    return points.slice(0, -1)
  }
  return points
}

export const dedupeClosed = (points: Vec2[]) => {
  const deduped = dedupeAdjacent(points)
  if (
    deduped.length > 2 &&
    distance(deduped[0], deduped[deduped.length - 1]) <= EPS
  ) {
    deduped.pop()
  }
  return deduped
}

export const polygonArea = (points: Vec2[]) => {
  if (points.length < 3) {
    return 0
  }

  let area = 0
  for (let index = 0; index < points.length; index += 1) {
    const nextIndex = (index + 1) % points.length
    area +=
      points[index].x * points[nextIndex].y -
      points[nextIndex].x * points[index].y
  }

  return area / 2
}

const cross = (a: Vec2, b: Vec2) => a.x * b.y - a.y * b.x

const orientationOf = (a: Vec2, b: Vec2, c: Vec2) => {
  const value = cross(subtract(b, a), subtract(c, b))
  if (Math.abs(value) <= EPS) {
    return 0
  }
  return value > 0 ? 1 : 2
}

const isPointOnSegment = (a: Vec2, b: Vec2, c: Vec2) =>
  b.x <= Math.max(a.x, c.x) + EPS &&
  b.x + EPS >= Math.min(a.x, c.x) &&
  b.y <= Math.max(a.y, c.y) + EPS &&
  b.y + EPS >= Math.min(a.y, c.y)

const getSegmentBounds = (from: Vec2, to: Vec2) => ({
  minX: Math.min(from.x, to.x),
  minY: Math.min(from.y, to.y),
  maxX: Math.max(from.x, to.x),
  maxY: Math.max(from.y, to.y)
})

const segmentBoundsOverlap = (
  left: ReturnType<typeof getSegmentBounds>,
  right: ReturnType<typeof getSegmentBounds>
) =>
  left.minX <= right.maxX + EPS &&
  left.maxX + EPS >= right.minX &&
  left.minY <= right.maxY + EPS &&
  left.maxY + EPS >= right.minY

const segmentsIntersectInclusive = (a1: Vec2, a2: Vec2, b1: Vec2, b2: Vec2) => {
  const o1 = orientationOf(a1, a2, b1)
  const o2 = orientationOf(a1, a2, b2)
  const o3 = orientationOf(b1, b2, a1)
  const o4 = orientationOf(b1, b2, a2)

  if (o1 !== o2 && o3 !== o4) {
    return true
  }

  return (
    (o1 === 0 && isPointOnSegment(a1, b1, a2)) ||
    (o2 === 0 && isPointOnSegment(a1, b2, a2)) ||
    (o3 === 0 && isPointOnSegment(b1, a1, b2)) ||
    (o4 === 0 && isPointOnSegment(b1, a2, b2))
  )
}

export const isSimpleOpenPath = (points: Vec2[]) => {
  if (points.length < 2) {
    return false
  }

  const segmentBounds = points
    .slice(0, -1)
    .map((point, index) => getSegmentBounds(point, points[index + 1]))

  for (let leftIndex = 0; leftIndex < points.length - 1; leftIndex += 1) {
    const leftStart = points[leftIndex]
    const leftEnd = points[leftIndex + 1]

    for (
      let rightIndex = leftIndex + 1;
      rightIndex < points.length - 1;
      rightIndex += 1
    ) {
      if (rightIndex === leftIndex + 1) {
        continue
      }

      if (
        !segmentBoundsOverlap(
          segmentBounds[leftIndex],
          segmentBounds[rightIndex]
        )
      ) {
        continue
      }

      if (
        segmentsIntersectInclusive(
          leftStart,
          leftEnd,
          points[rightIndex],
          points[rightIndex + 1]
        )
      ) {
        return false
      }
    }
  }

  return true
}

const segmentIntersection = (
  a: Vec2,
  b: Vec2,
  c: Vec2,
  d: Vec2
): Vec2 | null => {
  const r = subtract(b, a)
  const s = subtract(d, c)
  const denominator = cross(r, s)
  if (Math.abs(denominator) <= EPS) {
    return null
  }

  const cma = subtract(c, a)
  const t = cross(cma, s) / denominator
  const u = cross(cma, r) / denominator
  if (t <= EPS || t >= 1 - EPS || u <= EPS || u >= 1 - EPS) {
    return null
  }

  return add(a, scale(r, t))
}

export const isSimpleClosedPolygon = (points: Vec2[]) => {
  const polygon = normalizeClosed(points)
  if (polygon.length < 3) {
    return false
  }
  const segmentBounds = polygon.map((point, index) =>
    getSegmentBounds(point, polygon[(index + 1) % polygon.length])
  )

  for (let i = 0; i < polygon.length; i += 1) {
    const a1 = polygon[i]
    const a2 = polygon[(i + 1) % polygon.length]

    for (let j = i + 1; j < polygon.length; j += 1) {
      const b1 = polygon[j]
      const b2 = polygon[(j + 1) % polygon.length]

      const sameEdge = i === j
      const sharesForwardVertex = (i + 1) % polygon.length === j
      const sharesBackwardVertex = i === (j + 1) % polygon.length
      if (sameEdge || sharesForwardVertex || sharesBackwardVertex) {
        continue
      }

      if (!segmentBoundsOverlap(segmentBounds[i], segmentBounds[j])) {
        continue
      }

      if (segmentIntersection(a1, a2, b1, b2)) {
        return false
      }
    }
  }

  return true
}

const lineIntersection = (
  a1: Vec2,
  a2: Vec2,
  b1: Vec2,
  b2: Vec2
): Vec2 | null => {
  const ax = a2.x - a1.x
  const ay = a2.y - a1.y
  const bx = b2.x - b1.x
  const by = b2.y - b1.y
  const denominator = ax * by - ay * bx
  if (Math.abs(denominator) <= EPS) {
    return null
  }

  const cx = b1.x - a1.x
  const cy = b1.y - a1.y
  const t = (cx * by - cy * bx) / denominator

  return {
    x: a1.x + ax * t,
    y: a1.y + ay * t
  }
}

export interface OffsetSegment {
  start: Vec2
  end: Vec2
}

export const createOffsetSegment = (
  from: Vec2,
  to: Vec2,
  offset: number
): OffsetSegment | null => {
  const normal = perpendicularLeft(from, to)
  if (!normal) {
    return null
  }

  const delta = scale(normal, offset)

  return {
    start: add(from, delta),
    end: add(to, delta)
  }
}

export const buildOffsetSegments = (
  points: Vec2[],
  closed: boolean,
  offset: number
) => {
  const normalized = closed ? normalizeClosed(points) : dedupeAdjacent(points)
  if (normalized.length < 2) {
    return []
  }

  return normalized.map((point, index) => {
    const nextIndex = index + 1
    if (nextIndex >= normalized.length) {
      if (!closed) {
        return null
      }

      return createOffsetSegment(
        normalized[index],
        normalized[(index + 1) % normalized.length],
        offset
      )
    }

    return createOffsetSegment(point, normalized[nextIndex], offset)
  })
}

const resolveJoin = (
  previous: OffsetSegment | null,
  next: OffsetSegment | null,
  original: Vec2,
  stroke: Pick<RenderableStroke, 'join' | 'miterLimit' | 'width'>,
  miterOffsetDistance = stroke.width / 2
) => {
  if (!previous && !next) {
    return original
  }

  if (!previous) {
    return next?.start ?? original
  }

  if (!next) {
    return previous.end
  }

  if (stroke.join === 'bevel') {
    return {
      x: (previous.end.x + next.start.x) / 2,
      y: (previous.end.y + next.start.y) / 2
    }
  }

  const intersection = lineIntersection(
    previous.start,
    previous.end,
    next.start,
    next.end
  )
  if (!intersection) {
    return {
      x: (previous.end.x + next.start.x) / 2,
      y: (previous.end.y + next.start.y) / 2
    }
  }

  const maxDistance = stroke.miterLimit * miterOffsetDistance
  if (distance(original, intersection) > maxDistance + EPS) {
    return {
      x: (previous.end.x + next.start.x) / 2,
      y: (previous.end.y + next.start.y) / 2
    }
  }

  return intersection
}

export const offsetPath = (
  points: Vec2[],
  closed: boolean,
  offset: number,
  stroke: Pick<RenderableStroke, 'join' | 'miterLimit' | 'width'>
) => {
  const normalized = closed ? normalizeClosed(points) : dedupeAdjacent(points)
  if (normalized.length < 2) {
    return []
  }

  const segments = buildOffsetSegments(normalized, closed, offset)
  const miterOffsetDistance = Math.abs(offset)

  if (closed) {
    return normalized.map((point, index) =>
      resolveJoin(
        segments[(index - 1 + normalized.length) % normalized.length],
        segments[index],
        point,
        stroke,
        miterOffsetDistance
      )
    )
  }

  const result: Vec2[] = []
  result.push(segments[0]?.start ?? normalized[0])
  for (let index = 1; index < normalized.length - 1; index += 1) {
    result.push(
      resolveJoin(
        segments[index - 1],
        segments[index],
        normalized[index],
        stroke,
        miterOffsetDistance
      )
    )
  }
  result.push(
    segments[normalized.length - 2]?.end ?? normalized[normalized.length - 1]
  )
  return result
}

export const extendForCap = (
  points: Vec2[],
  stroke: Pick<RenderableStroke, 'cap' | 'width'>
) => {
  if (stroke.cap !== 'square' || points.length < 2) {
    return points
  }

  const startDirection = normalize(subtract(points[1], points[0]))
  const endDirection = normalize(
    subtract(points[points.length - 1], points[points.length - 2])
  )
  if (!startDirection || !endDirection) {
    return points
  }

  const halfWidth = stroke.width / 2
  return [
    add(points[0], scale(startDirection, -halfWidth)),
    ...points.slice(1, -1),
    add(points[points.length - 1], scale(endDirection, halfWidth))
  ]
}
