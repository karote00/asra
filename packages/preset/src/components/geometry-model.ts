import { Bezier } from 'bezier-js'
import type { GeometryModel, GeometryPoint } from '@asyra/core'
import type { VectorNetwork, VectorPointNode, VectorSegment } from '@asyra/core'
import { StrokePositions, StrokeStyles } from '@asyra/utils'
import type { RenderableStroke } from './strokes'
import {
  buildExactDashPartPolygons,
  getStrokeCenterlineOffset,
  offsetPolyline
} from './strokes'

interface Vec2 extends GeometryPoint {}

type PathSegment =
  | {
      type: 'line'
      start: Vec2
      end: Vec2
      length: number
    }
  | {
      type: 'cubic'
      start: Vec2
      control1: Vec2
      control2: Vec2
      end: Vec2
      curve: Bezier
      length: number
    }

interface PathGeometry {
  segments: PathSegment[]
  closed: boolean
  totalLength: number
  sampledPoints: Vec2[]
}

interface PathCornerConstraint {
  distance: number
  corner: Vec2
  prevDirection: Vec2
  nextDirection: Vec2
}

interface OneSidedDashSlice {
  sourcePoints: Vec2[]
  centerline: Vec2[]
  outerBoundary: Vec2[]
  innerBoundary: Vec2[]
  startDistance: number
  endDistance: number
}

export interface GeometryModelDebugPart {
  startDistance: number
  endDistance: number
  sourcePoints: Vec2[]
  clipPoints: Vec2[]
  renderPoints: Vec2[]
  polygons: Vec2[][]
}

export interface DashedGeometryModelResult {
  model: GeometryModel
  hitPolygons: Vec2[][]
  debugParts: GeometryModelDebugPart[]
}

interface DashInterval {
  startDistance: number
  endDistance: number
}

const EPS = 1e-6
const DASH_LENGTH_FACTOR = 4
const DASH_GAP_FACTOR = 2
const MIN_DASH_LENGTH = 0.1
const CURVE_TESSELLATION_TOLERANCE = 0.5

const distance = (from: Vec2, to: Vec2) =>
  Math.hypot(to.x - from.x, to.y - from.y)

const samePoint = (a: Vec2, b: Vec2, tolerance = EPS) =>
  distance(a, b) <= tolerance

const dedupeAdjacentPoints = (points: Vec2[]) => {
  if (points.length <= 1) {
    return [...points]
  }

  const result = [points[0]]
  for (let i = 1; i < points.length; i += 1) {
    if (distance(result[result.length - 1], points[i]) > EPS) {
      result.push(points[i])
    }
  }
  return result
}

const dedupeClosedPolygonPoints = (points: Vec2[]) => {
  const deduped = dedupeAdjacentPoints(points)
  if (
    deduped.length > 2 &&
    distance(deduped[0], deduped[deduped.length - 1]) <= EPS
  ) {
    deduped.pop()
  }
  return deduped
}

const polygonArea = (points: Vec2[]): number => {
  if (points.length < 3) {
    return 0
  }

  let area = 0
  for (let i = 0; i < points.length; i += 1) {
    const next = points[(i + 1) % points.length]
    area += points[i].x * next.y - next.x * points[i].y
  }

  return area / 2
}

const pointInPolygon = (point: Vec2, polygon: Vec2[]) => {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x
    const yi = polygon[i].y
    const xj = polygon[j].x
    const yj = polygon[j].y

    const intersects =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi + EPS) + xi

    if (intersects) {
      inside = !inside
    }
  }

  return inside
}

const cross = (origin: Vec2, a: Vec2, b: Vec2) =>
  (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x)

const buildConvexHull = (points: Vec2[]) => {
  const uniquePoints = points.reduce<Vec2[]>((result, point) => {
    if (!result.some((candidate) => distance(candidate, point) <= EPS)) {
      result.push(point)
    }
    return result
  }, [])

  if (uniquePoints.length <= 2) {
    return uniquePoints
  }

  const sorted = [...uniquePoints].sort((a, b) =>
    a.x === b.x ? a.y - b.y : a.x - b.x
  )
  const lower: Vec2[] = []
  sorted.forEach((point) => {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2], lower[lower.length - 1], point) <= EPS
    ) {
      lower.pop()
    }
    lower.push(point)
  })

  const upper: Vec2[] = []
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    const point = sorted[i]
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2], upper[upper.length - 1], point) <= EPS
    ) {
      upper.pop()
    }
    upper.push(point)
  }

  return cleanPolygon([...lower.slice(0, -1), ...upper.slice(0, -1)]) ?? []
}

const pointOnSegment = (
  point: Vec2,
  start: Vec2,
  end: Vec2,
  tolerance = EPS
) => {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared <= tolerance * tolerance) {
    return distance(point, start) <= tolerance
  }

  const t =
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared
  if (t < -tolerance || t > 1 + tolerance) {
    return false
  }

  const projected = {
    x: start.x + dx * Math.max(0, Math.min(1, t)),
    y: start.y + dy * Math.max(0, Math.min(1, t))
  }
  return distance(point, projected) <= tolerance
}

const orientation = (a: Vec2, b: Vec2, c: Vec2) =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)

const segmentsTouchOrIntersect = (a1: Vec2, a2: Vec2, b1: Vec2, b2: Vec2) => {
  const o1 = orientation(a1, a2, b1)
  const o2 = orientation(a1, a2, b2)
  const o3 = orientation(b1, b2, a1)
  const o4 = orientation(b1, b2, a2)

  if (
    ((o1 > EPS && o2 < -EPS) || (o1 < -EPS && o2 > EPS)) &&
    ((o3 > EPS && o4 < -EPS) || (o3 < -EPS && o4 > EPS))
  ) {
    return true
  }

  return (
    (Math.abs(o1) <= EPS && pointOnSegment(b1, a1, a2)) ||
    (Math.abs(o2) <= EPS && pointOnSegment(b2, a1, a2)) ||
    (Math.abs(o3) <= EPS && pointOnSegment(a1, b1, b2)) ||
    (Math.abs(o4) <= EPS && pointOnSegment(a2, b1, b2))
  )
}

const polygonsTouchOrOverlap = (a: Vec2[], b: Vec2[]) => {
  for (const point of a) {
    if (
      pointInPolygon(point, b) ||
      b.some((candidate) => samePoint(point, candidate))
    ) {
      return true
    }
  }

  for (const point of b) {
    if (
      pointInPolygon(point, a) ||
      a.some((candidate) => samePoint(point, candidate))
    ) {
      return true
    }
  }

  for (let i = 0; i < a.length; i += 1) {
    const aStart = a[i]
    const aEnd = a[(i + 1) % a.length]
    for (let j = 0; j < b.length; j += 1) {
      const bStart = b[j]
      const bEnd = b[(j + 1) % b.length]
      if (segmentsTouchOrIntersect(aStart, aEnd, bStart, bEnd)) {
        return true
      }
    }
  }

  return false
}

const getArcStepAngle = (radius: number): number => {
  if (!Number.isFinite(radius) || radius <= EPS) {
    return Math.PI / 8
  }

  if (radius <= 0.5) {
    return Math.PI / 8
  }

  const cosine = 1 - 0.5 / radius
  const step = 2 * Math.acos(Math.max(-1, Math.min(1, cosine)))
  if (!Number.isFinite(step) || step <= EPS) {
    return Math.PI / 8
  }

  return step
}

const buildArcPoints = (
  center: Vec2,
  fromAngle: number,
  toAngle: number,
  radius: number,
  clockwise: boolean
): Vec2[] => {
  let endAngle = toAngle
  if (clockwise) {
    while (endAngle >= fromAngle - EPS) {
      endAngle -= Math.PI * 2
    }
  } else {
    while (endAngle <= fromAngle + EPS) {
      endAngle += Math.PI * 2
    }
  }

  const sweep = endAngle - fromAngle
  const stepAngle = getArcStepAngle(radius)
  const steps = Math.max(1, Math.ceil(Math.abs(sweep) / stepAngle))
  const points: Vec2[] = []

  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps
    const angle = fromAngle + sweep * t
    points.push({
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius
    })
  }

  return points
}

const buildRoundCapPoints = (
  center: Vec2,
  startPoint: Vec2,
  endPoint: Vec2,
  radius: number
) =>
  buildArcPoints(
    center,
    Math.atan2(startPoint.y - center.y, startPoint.x - center.x),
    Math.atan2(endPoint.y - center.y, endPoint.x - center.x),
    radius,
    true
  )

const cleanPolygon = (points: Vec2[]) => {
  const polygon = dedupeClosedPolygonPoints(points)
  return polygon.length >= 3 && Math.abs(polygonArea(polygon)) > EPS
    ? polygon
    : null
}

const buildStripPolygons = (outerBoundary: Vec2[], innerBoundary: Vec2[]) => {
  const polygonCount = Math.min(outerBoundary.length, innerBoundary.length) - 1
  if (polygonCount < 1) {
    return []
  }

  const polygons: Vec2[][] = []
  for (let i = 0; i < polygonCount; i += 1) {
    const polygon = cleanPolygon([
      outerBoundary[i],
      outerBoundary[i + 1],
      innerBoundary[i + 1],
      innerBoundary[i]
    ])
    if (polygon) {
      polygons.push(polygon)
    }
  }

  return polygons
}

const buildCapFanPolygons = (
  center: Vec2,
  boundaryPoints: Vec2[]
): Vec2[][] => {
  if (boundaryPoints.length < 2) {
    return []
  }

  const polygons: Vec2[][] = []
  for (let i = 0; i < boundaryPoints.length - 1; i += 1) {
    const polygon = cleanPolygon([
      center,
      boundaryPoints[i],
      boundaryPoints[i + 1]
    ])
    if (polygon) {
      polygons.push(polygon)
    }
  }

  return polygons
}

const midpoint = (a: Vec2, b: Vec2): Vec2 => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2
})

const inwardNormalForDirection = (
  direction: Vec2,
  insideOrientation: 1 | -1
): Vec2 | null =>
  normalizeVector({
    x: -direction.y * insideOrientation,
    y: direction.x * insideOrientation
  })

const clipCrossSectionToCornerWedge = (
  outer: Vec2,
  inner: Vec2,
  constraint: PathCornerConstraint,
  insideOrientation: 1 | -1
): { outer: Vec2; inner: Vec2 } | null => {
  const firstNormal = inwardNormalForDirection(
    constraint.prevDirection,
    insideOrientation
  )
  const secondNormal = inwardNormalForDirection(
    constraint.nextDirection,
    insideOrientation
  )
  if (!firstNormal || !secondNormal) {
    return { outer, inner }
  }

  let clippedInner = { ...inner }
  const normals = [firstNormal, secondNormal]

  for (const normal of normals) {
    const outerDistance = dot(
      { x: outer.x - constraint.corner.x, y: outer.y - constraint.corner.y },
      normal
    )
    const innerDistance = dot(
      {
        x: clippedInner.x - constraint.corner.x,
        y: clippedInner.y - constraint.corner.y
      },
      normal
    )

    if (innerDistance >= -EPS) {
      continue
    }

    const delta = {
      x: clippedInner.x - outer.x,
      y: clippedInner.y - outer.y
    }
    const denominator = dot(delta, normal)
    if (Math.abs(denominator) <= EPS) {
      clippedInner = { ...outer }
      continue
    }

    const t = -outerDistance / denominator
    clippedInner = {
      x: outer.x + delta.x * Math.max(0, Math.min(1, t)),
      y: outer.y + delta.y * Math.max(0, Math.min(1, t))
    }
  }

  return {
    outer,
    inner: clippedInner
  }
}

const clipSliceEdgeToConstraints = (
  slice: OneSidedDashSlice,
  constraints: PathCornerConstraint[],
  insideOrientation: 1 | -1,
  atStart: boolean
) => {
  if (constraints.length === 0) {
    return false
  }

  const edgeIndex = atStart ? 0 : slice.outerBoundary.length - 1
  const clipped = constraints.reduce<{ outer: Vec2; inner: Vec2 } | null>(
    (current, constraint) => {
      if (!current) {
        return current
      }

      return clipCrossSectionToCornerWedge(
        current.outer,
        current.inner,
        constraint,
        insideOrientation
      )
    },
    {
      outer: slice.outerBoundary[edgeIndex],
      inner: slice.innerBoundary[edgeIndex]
    }
  )

  if (!clipped) {
    return false
  }

  slice.outerBoundary[edgeIndex] = clipped.outer
  slice.innerBoundary[edgeIndex] = clipped.inner
  slice.centerline[edgeIndex] = midpoint(clipped.outer, clipped.inner)

  return true
}

const clipSliceCrossSectionsNearConstraints = (
  slice: OneSidedDashSlice,
  constraints: PathCornerConstraint[],
  insideOrientation: 1 | -1,
  atStart: boolean
) => {
  if (constraints.length === 0) {
    return
  }

  const indices = atStart
    ? Array.from({ length: slice.outerBoundary.length }, (_, index) => index)
    : Array.from(
        { length: slice.outerBoundary.length },
        (_, index) => slice.outerBoundary.length - 1 - index
      )

  for (const edgeIndex of indices) {
    const outer = slice.outerBoundary[edgeIndex]
    const clipped = constraints.reduce<{ outer: Vec2; inner: Vec2 } | null>(
      (current, constraint) => {
        if (!current) {
          return current
        }

        return clipCrossSectionToCornerWedge(
          current.outer,
          current.inner,
          constraint,
          insideOrientation
        )
      },
      {
        outer,
        inner: slice.innerBoundary[edgeIndex]
      }
    )

    if (!clipped) {
      continue
    }

    slice.innerBoundary[edgeIndex] = clipped.inner
    slice.centerline[edgeIndex] = midpoint(outer, clipped.inner)
  }
}

const snapSliceEdgeToCorner = (
  slice: OneSidedDashSlice,
  corner: Vec2,
  atStart: boolean
) => {
  const edgeIndex = atStart ? 0 : slice.outerBoundary.length - 1
  slice.outerBoundary[edgeIndex] = { x: corner.x, y: corner.y }
  slice.centerline[edgeIndex] = midpoint(
    slice.outerBoundary[edgeIndex],
    slice.innerBoundary[edgeIndex]
  )
}

const buildOneSidedSlicePolygons = (
  slice: OneSidedDashSlice,
  stroke: RenderableStroke,
  options: {
    includeStartCap?: boolean
    includeEndCap?: boolean
  }
) => {
  const polygons = buildStripPolygons(slice.outerBoundary, slice.innerBoundary)
  if (polygons.length === 0) {
    return []
  }

  const radius = stroke.width / 2
  if (stroke.cap === 'round' && options.includeStartCap !== false) {
    const startBoundary = [
      slice.innerBoundary[0],
      ...buildRoundCapPoints(
        slice.centerline[0],
        slice.innerBoundary[0],
        slice.outerBoundary[0],
        radius
      ),
      slice.outerBoundary[0]
    ]
    polygons.push(...buildCapFanPolygons(slice.centerline[0], startBoundary))
  }

  if (stroke.cap === 'round' && options.includeEndCap !== false) {
    const lastIndex = slice.centerline.length - 1
    const endBoundary = [
      slice.outerBoundary[lastIndex],
      ...buildRoundCapPoints(
        slice.centerline[lastIndex],
        slice.outerBoundary[lastIndex],
        slice.innerBoundary[lastIndex],
        radius
      ),
      slice.innerBoundary[lastIndex]
    ]
    polygons.push(
      ...buildCapFanPolygons(slice.centerline[lastIndex], endBoundary)
    )
  }

  return polygons
}

const getAnchorNode = (
  points: Record<string, VectorPointNode>,
  pointId: string | undefined
) => {
  if (!pointId) {
    return null
  }
  const point = points[pointId]
  if (!point || point.kind !== 'anchor') {
    return null
  }
  return point
}

const getControlNode = (
  points: Record<string, VectorPointNode>,
  pointId?: string | null
) => {
  if (!pointId) {
    return null
  }
  const point = points[pointId]
  if (!point || point.kind !== 'control') {
    return null
  }
  return point
}

const getDashPattern = (
  stroke: Pick<RenderableStroke, 'width' | 'dash' | 'gap'>
) => {
  const base = Math.max(1, stroke.width)
  return {
    dash: Math.max(
      MIN_DASH_LENGTH,
      Number.isFinite(stroke.dash) ? stroke.dash : base * DASH_LENGTH_FACTOR
    ),
    gap: Math.max(
      MIN_DASH_LENGTH,
      Number.isFinite(stroke.gap) ? stroke.gap : base * DASH_GAP_FACTOR
    )
  }
}

const toBezier = (segment: Extract<PathSegment, { type: 'cubic' }>) =>
  new Bezier(segment.start, segment.control1, segment.control2, segment.end)

const getCurveLengthAtT = (
  segment: Extract<PathSegment, { type: 'cubic' }>,
  t: number
) => {
  if (t <= 0) {
    return 0
  }
  if (t >= 1) {
    return segment.length
  }

  return toBezier(segment).split(0, t).length()
}

const getCurveTAtLength = (
  segment: Extract<PathSegment, { type: 'cubic' }>,
  targetLength: number
) => {
  if (targetLength <= 0) {
    return 0
  }
  if (targetLength >= segment.length) {
    return 1
  }

  let low = 0
  let high = 1
  for (let i = 0; i < 24; i += 1) {
    const mid = (low + high) / 2
    const lengthAtMid = getCurveLengthAtT(segment, mid)
    if (lengthAtMid < targetLength) {
      low = mid
    } else {
      high = mid
    }
  }
  return (low + high) / 2
}

const lineDistanceFromChord = (point: Vec2, start: Vec2, end: Vec2) => {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.hypot(dx, dy)
  if (length <= EPS) {
    return distance(point, start)
  }

  return Math.abs(dx * (start.y - point.y) - (start.x - point.x) * dy) / length
}

const sampleBezierSegment = (
  curve: Bezier,
  tolerance: number,
  depth = 0
): Vec2[] => {
  const points = curve.points as Vec2[]
  if (points.length < 4) {
    return points.map((point) => ({ x: point.x, y: point.y }))
  }

  const flatEnough =
    lineDistanceFromChord(points[1], points[0], points[3]) <= tolerance &&
    lineDistanceFromChord(points[2], points[0], points[3]) <= tolerance

  if (flatEnough || depth >= 12) {
    return [
      { x: points[0].x, y: points[0].y },
      { x: points[3].x, y: points[3].y }
    ]
  }

  const split = curve.split(0.5)
  const left = sampleBezierSegment(split.left, tolerance, depth + 1)
  const right = sampleBezierSegment(split.right, tolerance, depth + 1)
  return [...left.slice(0, -1), ...right]
}

const samplePathSegment = (segment: PathSegment, tolerance: number): Vec2[] => {
  if (segment.type === 'line') {
    return [
      { x: segment.start.x, y: segment.start.y },
      { x: segment.end.x, y: segment.end.y }
    ]
  }

  return dedupeAdjacentPoints(sampleBezierSegment(toBezier(segment), tolerance))
}

const slicePathSegment = (
  segment: PathSegment,
  startLength: number,
  endLength: number,
  tolerance: number
): Vec2[] => {
  if (endLength - startLength <= EPS) {
    return []
  }

  if (segment.type === 'line') {
    const total = Math.max(EPS, segment.length)
    const t0 = Math.max(0, Math.min(1, startLength / total))
    const t1 = Math.max(0, Math.min(1, endLength / total))
    return dedupeAdjacentPoints([
      {
        x: segment.start.x + (segment.end.x - segment.start.x) * t0,
        y: segment.start.y + (segment.end.y - segment.start.y) * t0
      },
      {
        x: segment.start.x + (segment.end.x - segment.start.x) * t1,
        y: segment.start.y + (segment.end.y - segment.start.y) * t1
      }
    ])
  }

  const t0 = getCurveTAtLength(segment, startLength)
  const t1 = getCurveTAtLength(segment, endLength)
  const splitCurve = toBezier(segment).split(t0, t1)
  return dedupeAdjacentPoints(sampleBezierSegment(splitCurve, tolerance))
}

const mergePointLists = (head: Vec2[], tail: Vec2[]) => {
  if (head.length === 0) {
    return [...tail]
  }
  if (tail.length === 0) {
    return [...head]
  }

  const merged = [...head]
  const startIndex = distance(head[head.length - 1], tail[0]) <= EPS ? 1 : 0
  for (let i = startIndex; i < tail.length; i += 1) {
    merged.push(tail[i])
  }
  return dedupeAdjacentPoints(merged)
}

const normalizeVector = (vector: Vec2): Vec2 | null => {
  const length = Math.hypot(vector.x, vector.y)
  if (length <= EPS) {
    return null
  }

  return {
    x: vector.x / length,
    y: vector.y / length
  }
}

const getSegmentStartTangent = (segment: PathSegment): Vec2 | null => {
  if (segment.type === 'line') {
    return normalizeVector({
      x: segment.end.x - segment.start.x,
      y: segment.end.y - segment.start.y
    })
  }

  return (
    normalizeVector({
      x: segment.control1.x - segment.start.x,
      y: segment.control1.y - segment.start.y
    }) ??
    normalizeVector({
      x: segment.control2.x - segment.start.x,
      y: segment.control2.y - segment.start.y
    }) ??
    normalizeVector({
      x: segment.end.x - segment.start.x,
      y: segment.end.y - segment.start.y
    })
  )
}

const getSegmentEndTangent = (segment: PathSegment): Vec2 | null => {
  if (segment.type === 'line') {
    return normalizeVector({
      x: segment.end.x - segment.start.x,
      y: segment.end.y - segment.start.y
    })
  }

  return (
    normalizeVector({
      x: segment.end.x - segment.control2.x,
      y: segment.end.y - segment.control2.y
    }) ??
    normalizeVector({
      x: segment.end.x - segment.control1.x,
      y: segment.end.y - segment.control1.y
    }) ??
    normalizeVector({
      x: segment.end.x - segment.start.x,
      y: segment.end.y - segment.start.y
    })
  )
}

const dot = (a: Vec2, b: Vec2) => a.x * b.x + a.y * b.y

const clipPolygonAgainstHalfPlane = (
  points: Vec2[],
  linePoint: Vec2,
  inwardNormal: Vec2
): Vec2[] => {
  if (points.length < 3) {
    return []
  }

  const clipped: Vec2[] = []

  for (let i = 0; i < points.length; i += 1) {
    const current = points[i]
    const previous = points[(i - 1 + points.length) % points.length]
    const currentDistance = dot(
      { x: current.x - linePoint.x, y: current.y - linePoint.y },
      inwardNormal
    )
    const previousDistance = dot(
      { x: previous.x - linePoint.x, y: previous.y - linePoint.y },
      inwardNormal
    )
    const currentInside = currentDistance >= -EPS
    const previousInside = previousDistance >= -EPS

    if (currentInside !== previousInside) {
      const delta = {
        x: current.x - previous.x,
        y: current.y - previous.y
      }
      const denominator = dot(delta, inwardNormal)
      if (Math.abs(denominator) > EPS) {
        const t =
          dot(
            { x: linePoint.x - previous.x, y: linePoint.y - previous.y },
            inwardNormal
          ) / denominator
        clipped.push({
          x: previous.x + delta.x * t,
          y: previous.y + delta.y * t
        })
      }
    }

    if (currentInside) {
      clipped.push(current)
    }
  }

  return dedupeAdjacentPoints(clipped)
}

const clipPolygonToCornerWedge = (
  polygon: Vec2[],
  constraint: PathCornerConstraint,
  insideOrientation: 1 | -1
) => {
  const firstNormal = inwardNormalForDirection(
    constraint.prevDirection,
    insideOrientation
  )
  const secondNormal = inwardNormalForDirection(
    constraint.nextDirection,
    insideOrientation
  )
  if (!firstNormal || !secondNormal) {
    return cleanPolygon(polygon)
  }

  const firstClipped = clipPolygonAgainstHalfPlane(
    polygon,
    constraint.corner,
    firstNormal
  )
  if (firstClipped.length < 3) {
    return null
  }

  const secondClipped = clipPolygonAgainstHalfPlane(
    firstClipped,
    constraint.corner,
    secondNormal
  )

  return cleanPolygon(secondClipped)
}

const clipPolygonsToCornerWedges = (
  polygons: Vec2[][],
  constraints: PathCornerConstraint[],
  insideOrientation: 1 | -1
) => {
  if (constraints.length === 0 || polygons.length === 0) {
    return polygons
  }

  return polygons.reduce<Vec2[][]>((result, polygon) => {
    let clipped: Vec2[] | null = polygon

    for (const constraint of constraints) {
      if (!clipped) {
        break
      }
      clipped = clipPolygonToCornerWedge(clipped, constraint, insideOrientation)
    }

    if (clipped && clipped.length >= 3) {
      result.push(clipped)
    }

    return result
  }, [])
}

const convexPolygonIntersectionArea = (subject: Vec2[], clip: Vec2[]) => {
  if (subject.length < 3 || clip.length < 3) {
    return 0
  }

  const clipOrientation = polygonArea(clip) >= 0 ? 1 : -1
  let clipped = [...subject]

  for (let i = 0; i < clip.length; i += 1) {
    const start = clip[i]
    const end = clip[(i + 1) % clip.length]
    const edge = {
      x: end.x - start.x,
      y: end.y - start.y
    }
    const inwardNormal =
      clipOrientation >= 0
        ? {
            x: -edge.y,
            y: edge.x
          }
        : {
            x: edge.y,
            y: -edge.x
          }

    clipped = clipPolygonAgainstHalfPlane(clipped, start, inwardNormal)
    if (clipped.length < 3) {
      return 0
    }
  }

  return Math.abs(polygonArea(clipped))
}

const mergeOverlappingConvexPolygons = (
  polygons: Vec2[][],
  canMergeHull: (polygon: Vec2[]) => boolean = () => true
) => {
  const merged = [...polygons]

  let changed = true
  while (changed) {
    changed = false

    for (let i = 0; i < merged.length; i += 1) {
      for (let j = i + 1; j < merged.length; j += 1) {
        const overlapArea = convexPolygonIntersectionArea(merged[i], merged[j])
        if (
          overlapArea <= EPS &&
          !polygonsTouchOrOverlap(merged[i], merged[j])
        ) {
          continue
        }

        const hull = buildConvexHull([...merged[i], ...merged[j]])
        if (hull.length < 3) {
          continue
        }

        const unionArea =
          Math.abs(polygonArea(merged[i])) +
          Math.abs(polygonArea(merged[j])) -
          overlapArea
        const hullArea = Math.abs(polygonArea(hull))

        if (hullArea > unionArea + 1e-3) {
          continue
        }

        if (!canMergeHull(hull)) {
          continue
        }

        merged.splice(j, 1)
        merged.splice(i, 1, hull)
        changed = true
        break
      }

      if (changed) {
        break
      }
    }
  }

  return merged
}

const buildPathCornerConstraints = (
  path: PathGeometry
): PathCornerConstraint[] => {
  const constraints: PathCornerConstraint[] = []
  let cursor = 0

  for (let i = 0; i < path.segments.length; i += 1) {
    const prevSegment = path.segments[i]
    const nextIndex = i + 1
    if (nextIndex >= path.segments.length && !path.closed) {
      cursor += prevSegment.length
      continue
    }

    const nextSegment = path.segments[nextIndex % path.segments.length]
    const cornerDistance = cursor + prevSegment.length
    const prevTangent = getSegmentEndTangent(prevSegment)
    const nextTangent = getSegmentStartTangent(nextSegment)
    cursor = cornerDistance

    if (!prevTangent || !nextTangent) {
      continue
    }

    constraints.push({
      distance: path.closed
        ? ((cornerDistance % path.totalLength) + path.totalLength) %
          path.totalLength
        : cornerDistance,
      corner: { x: prevSegment.end.x, y: prevSegment.end.y },
      prevDirection: prevTangent,
      nextDirection: nextTangent
    })
  }

  return constraints
}

const isActiveInsideCornerConstraint = (constraint: PathCornerConstraint) => {
  const cosine = Math.max(
    -1,
    Math.min(1, dot(constraint.prevDirection, constraint.nextDirection))
  )
  const angle = Math.acos(cosine)
  return angle > 1e-3
}

const isCornerConstraintNearDash = (
  constraintDistance: number,
  dashStart: number,
  dashEnd: number,
  pathLength: number,
  padding: number
) => {
  if (pathLength <= EPS) {
    return false
  }

  const candidates = [
    constraintDistance,
    constraintDistance - pathLength,
    constraintDistance + pathLength
  ]

  return candidates.some(
    (candidate) =>
      candidate >= dashStart - padding - EPS &&
      candidate <= dashEnd + padding + EPS
  )
}

const distanceToRay = (point: Vec2, origin: Vec2, direction: Vec2) => {
  const delta = {
    x: point.x - origin.x,
    y: point.y - origin.y
  }
  const projection = Math.max(0, dot(delta, direction))
  const closest = {
    x: origin.x + direction.x * projection,
    y: origin.y + direction.y * projection
  }
  return distance(point, closest)
}

const doesDashEndpointRequireCornerClip = (
  constraint: PathCornerConstraint,
  renderPoints: Vec2[],
  strokeRadius: number
) => {
  if (renderPoints.length < 2 || strokeRadius <= EPS) {
    return false
  }

  const prevRay = normalizeVector({
    x: -constraint.prevDirection.x,
    y: -constraint.prevDirection.y
  })
  const nextRay = normalizeVector(constraint.nextDirection)
  if (!prevRay || !nextRay) {
    return false
  }

  const endpoints = [renderPoints[0], renderPoints[renderPoints.length - 1]]
  return endpoints.some(
    (point) =>
      distanceToRay(point, constraint.corner, prevRay) <= strokeRadius + EPS ||
      distanceToRay(point, constraint.corner, nextRay) <= strokeRadius + EPS
  )
}

const doesDashEndpointRequireCornerClipAtEdge = (
  constraint: PathCornerConstraint,
  renderPoints: Vec2[],
  strokeRadius: number,
  atStart: boolean
) => {
  if (renderPoints.length < 2 || strokeRadius <= EPS) {
    return false
  }

  const prevRay = normalizeVector({
    x: -constraint.prevDirection.x,
    y: -constraint.prevDirection.y
  })
  const nextRay = normalizeVector(constraint.nextDirection)
  if (!prevRay || !nextRay) {
    return false
  }

  const point = atStart
    ? renderPoints[0]
    : renderPoints[renderPoints.length - 1]
  return (
    distance(point, constraint.corner) <= strokeRadius * 2 + EPS ||
    distanceToRay(point, constraint.corner, prevRay) <= strokeRadius + EPS ||
    distanceToRay(point, constraint.corner, nextRay) <= strokeRadius + EPS
  )
}

const sourceTouchesCorner = (
  sourcePoints: Vec2[],
  corner: Vec2,
  atStart: boolean
) => {
  if (sourcePoints.length === 0) {
    return false
  }

  const point = atStart
    ? sourcePoints[0]
    : sourcePoints[sourcePoints.length - 1]
  return distance(point, corner) <= 1e-3
}

const samplePathInterval = (
  path: PathGeometry,
  startDistance: number,
  endDistance: number,
  tolerance: number
): Vec2[] => {
  if (path.totalLength <= EPS || endDistance - startDistance <= EPS) {
    return []
  }

  const normalizedStart = path.closed
    ? ((startDistance % path.totalLength) + path.totalLength) % path.totalLength
    : Math.max(0, startDistance)
  const normalizedEnd = path.closed
    ? ((endDistance % path.totalLength) + path.totalLength) % path.totalLength
    : Math.min(path.totalLength, endDistance)

  if (
    !path.closed ||
    normalizedStart < normalizedEnd ||
    Math.abs(endDistance - startDistance - path.totalLength) <= EPS
  ) {
    return samplePathIntervalNoWrap(
      path,
      normalizedStart,
      path.closed && normalizedStart > normalizedEnd
        ? path.totalLength
        : normalizedEnd,
      tolerance
    )
  }

  return mergePointLists(
    samplePathIntervalNoWrap(
      path,
      normalizedStart,
      path.totalLength,
      tolerance
    ),
    samplePathIntervalNoWrap(path, 0, normalizedEnd, tolerance)
  )
}

const samplePathIntervalNoWrap = (
  path: PathGeometry,
  startDistance: number,
  endDistance: number,
  tolerance: number
): Vec2[] => {
  let cursor = 0
  let points: Vec2[] = []

  for (const segment of path.segments) {
    const segmentStart = cursor
    const segmentEnd = cursor + segment.length
    cursor = segmentEnd

    if (
      segmentEnd <= startDistance + EPS ||
      segmentStart >= endDistance - EPS
    ) {
      continue
    }

    const localStart = Math.max(0, startDistance - segmentStart)
    const localEnd = Math.min(segment.length, endDistance - segmentStart)
    points = mergePointLists(
      points,
      slicePathSegment(segment, localStart, localEnd, tolerance)
    )
  }

  return dedupeAdjacentPoints(points)
}

const buildPathGeometry = (
  network: VectorNetwork,
  points: Record<string, VectorPointNode>,
  segments: Record<string, VectorSegment>
): PathGeometry => {
  const pathSegments: PathSegment[] = []
  let totalLength = 0

  network.segmentIds.forEach((segmentId) => {
    const segment = segments[segmentId]
    if (!segment) {
      return
    }

    const start = getAnchorNode(points, segment.startId)
    const end = getAnchorNode(points, segment.endId)
    if (!start || !end) {
      return
    }

    const outControl = getControlNode(points, segment.outControlId)
    const inControl = getControlNode(points, segment.inControlId)
    if (!outControl && !inControl) {
      const lineSegment: PathSegment = {
        type: 'line',
        start: { x: start.x, y: start.y },
        end: { x: end.x, y: end.y },
        length: Math.hypot(end.x - start.x, end.y - start.y)
      }
      totalLength += lineSegment.length
      pathSegments.push(lineSegment)
      return
    }

    const cubicSegment: Extract<PathSegment, { type: 'cubic' }> = {
      type: 'cubic',
      start: { x: start.x, y: start.y },
      control1: outControl
        ? { x: outControl.x, y: outControl.y }
        : { x: start.x, y: start.y },
      control2: inControl
        ? { x: inControl.x, y: inControl.y }
        : { x: end.x, y: end.y },
      end: { x: end.x, y: end.y },
      curve: new Bezier(
        { x: start.x, y: start.y },
        outControl
          ? { x: outControl.x, y: outControl.y }
          : { x: start.x, y: start.y },
        inControl ? { x: inControl.x, y: inControl.y } : { x: end.x, y: end.y },
        { x: end.x, y: end.y }
      ),
      length: 0
    }
    cubicSegment.length = cubicSegment.curve.length()
    totalLength += cubicSegment.length
    pathSegments.push(cubicSegment)
  })

  const sampledPoints = dedupeAdjacentPoints(
    pathSegments.reduce<Vec2[]>((result, segment, index) => {
      const sampled = samplePathSegment(segment, CURVE_TESSELLATION_TOLERANCE)
      if (index === 0) {
        return sampled
      }
      return mergePointLists(result, sampled)
    }, [])
  )

  return {
    segments: pathSegments,
    closed: network.closed,
    totalLength,
    sampledPoints
  }
}

export const buildVectorGeometryModelPath = buildPathGeometry

const buildDashIntervals = (
  totalLength: number,
  dashLength: number,
  gapLength: number,
  closed: boolean,
  phaseOffset = 0
): DashInterval[] => {
  if (totalLength <= EPS || dashLength <= EPS) {
    return []
  }

  const cycleLength = dashLength + gapLength
  if (cycleLength <= EPS) {
    return [{ startDistance: 0, endDistance: totalLength }]
  }

  const intervals: DashInterval[] = []
  for (
    let cursor = phaseOffset;
    cursor < totalLength - EPS;
    cursor += cycleLength
  ) {
    const endDistance = Math.min(totalLength, cursor + dashLength)
    if (endDistance - cursor > EPS) {
      intervals.push({
        startDistance: cursor,
        endDistance
      })
    }
  }

  return intervals
}

const getWrappedCycleDistance = (a: number, b: number, cycleLength: number) => {
  const delta = Math.abs(a - b) % cycleLength
  return Math.min(delta, cycleLength - delta)
}

const chooseClosedInsideDashPhase = (
  cycleLength: number,
  dashLength: number,
  cornerConstraints: PathCornerConstraint[]
) => {
  if (cycleLength <= EPS || cornerConstraints.length === 0) {
    return 0
  }

  const candidateOffsets = new Set<number>([0])
  cornerConstraints.forEach((constraint) => {
    const target =
      ((constraint.distance - dashLength - (cycleLength - dashLength) / 2) %
        cycleLength) +
      cycleLength
    candidateOffsets.add(target % cycleLength)
  })

  let bestOffset = 0
  let bestScore = -Infinity

  candidateOffsets.forEach((offset) => {
    const score = cornerConstraints.reduce((minimum, constraint) => {
      const distanceOnCycle =
        ((constraint.distance % cycleLength) + cycleLength) % cycleLength
      const startClearance = getWrappedCycleDistance(
        distanceOnCycle,
        offset,
        cycleLength
      )
      const endClearance = getWrappedCycleDistance(
        distanceOnCycle,
        (offset + dashLength) % cycleLength,
        cycleLength
      )
      return Math.min(minimum, Math.min(startClearance, endClearance))
    }, Infinity)

    if (score > bestScore + EPS) {
      bestScore = score
      bestOffset = offset
    }
  })

  return bestOffset
}

export const createDashedGeometryModel = (
  path: PathGeometry,
  stroke: RenderableStroke
): DashedGeometryModelResult | null => {
  if (
    stroke.style !== StrokeStyles.DASHED ||
    path.totalLength <= EPS ||
    path.sampledPoints.length < 2
  ) {
    return null
  }

  const { dash, gap } = getDashPattern(stroke)
  const insideOrientation =
    path.closed && stroke.position === StrokePositions.INSIDE
      ? polygonArea(path.sampledPoints) >= 0
        ? 1
        : -1
      : 0
  const centerlineOffset = getStrokeCenterlineOffset(
    path.sampledPoints,
    path.closed,
    stroke
  )
  const validateIntersection =
    path.closed && stroke.position === StrokePositions.INSIDE
  const cornerConstraints =
    path.closed && stroke.position === StrokePositions.INSIDE
      ? buildPathCornerConstraints(path).filter(isActiveInsideCornerConstraint)
      : []
  const tessellationTolerance = Math.max(
    0.1,
    Math.min(CURVE_TESSELLATION_TOLERANCE, stroke.width / 8)
  )
  const buildContextPoints = (dashStart: number, dashEnd: number) => {
    const before = samplePathInterval(
      path,
      dashStart - contextPadding,
      dashStart,
      tessellationTolerance
    )
    const source = samplePathInterval(
      path,
      dashStart,
      dashEnd,
      tessellationTolerance
    )
    const after = samplePathInterval(
      path,
      dashEnd,
      dashEnd + contextPadding,
      tessellationTolerance
    )

    if (source.length < 2) {
      return null
    }

    const clipPoints = dedupeAdjacentPoints([
      ...before.slice(0, Math.max(0, before.length - 1)),
      ...source,
      ...after.slice(1)
    ])
    const clipStartIndex = before.length > 0 ? before.length - 1 : 0

    return {
      sourcePoints: source,
      clipPoints,
      clipStartIndex
    }
  }

  const debugParts: GeometryModelDebugPart[] = []
  const polygons: Vec2[][] = []
  const contextPadding = Math.max(stroke.width, stroke.width / 2 + 1)
  const cycleLength = dash + gap
  const dashPhase =
    path.closed &&
    stroke.position === StrokePositions.INSIDE &&
    cornerConstraints.length > 0
      ? chooseClosedInsideDashPhase(cycleLength, dash, cornerConstraints)
      : 0
  const dashIntervals = buildDashIntervals(
    path.totalLength,
    dash,
    gap,
    path.closed,
    dashPhase
  )

  for (const { startDistance: cursor, endDistance } of dashIntervals) {
    let dashPolygons: Vec2[][] = []
    let debugSourcePoints: Vec2[] = []
    let debugClipPoints: Vec2[] = []
    let debugRenderPoints: Vec2[] = []

    if (stroke.position === StrokePositions.INSIDE && insideOrientation !== 0) {
      const splitConstraints = cornerConstraints
        .filter(
          (constraint) =>
            constraint.distance > cursor + EPS &&
            constraint.distance < endDistance - EPS
        )
        .sort((a, b) => a.distance - b.distance)
      const splitDistances = [
        cursor,
        ...splitConstraints.map((constraint) => constraint.distance),
        endDistance
      ]
      const slices: OneSidedDashSlice[] = []

      for (
        let splitIndex = 0;
        splitIndex < splitDistances.length - 1;
        splitIndex += 1
      ) {
        const sliceStart = splitDistances[splitIndex]
        const sliceEnd = splitDistances[splitIndex + 1]
        const sourcePoints = samplePathInterval(
          path,
          sliceStart,
          sliceEnd,
          tessellationTolerance
        )
        if (sourcePoints.length < 2) {
          continue
        }

        const centerline = offsetPolyline(
          sourcePoints,
          centerlineOffset,
          false,
          validateIntersection
        )
        const innerBoundary = offsetPolyline(
          sourcePoints,
          stroke.width * insideOrientation,
          false,
          true
        )

        if (centerline.length < 2 || innerBoundary.length < 2) {
          continue
        }

        const slice: OneSidedDashSlice = {
          sourcePoints,
          centerline,
          outerBoundary: [...sourcePoints],
          innerBoundary,
          startDistance: sliceStart,
          endDistance: sliceEnd
        }
        slices.push(slice)
        debugSourcePoints = mergePointLists(debugSourcePoints, sourcePoints)
        debugClipPoints = mergePointLists(debugClipPoints, sourcePoints)
        debugRenderPoints = mergePointLists(debugRenderPoints, centerline)
      }

      if (slices.length === 0) {
        continue
      }

      const touchingStartConstraints = cornerConstraints.filter((constraint) =>
        sourceTouchesCorner(slices[0].sourcePoints, constraint.corner, true)
      )
      const touchingEndConstraints = cornerConstraints.filter((constraint) =>
        sourceTouchesCorner(
          slices[slices.length - 1].sourcePoints,
          constraint.corner,
          false
        )
      )
      const startClippingConstraints = [...touchingStartConstraints]
      const endClippingConstraints = [...touchingEndConstraints]

      clipSliceEdgeToConstraints(
        slices[0],
        startClippingConstraints,
        insideOrientation,
        true
      )
      clipSliceEdgeToConstraints(
        slices[slices.length - 1],
        endClippingConstraints,
        insideOrientation,
        false
      )
      clipSliceCrossSectionsNearConstraints(
        slices[0],
        startClippingConstraints,
        insideOrientation,
        true
      )
      clipSliceCrossSectionsNearConstraints(
        slices[slices.length - 1],
        endClippingConstraints,
        insideOrientation,
        false
      )
      if (touchingStartConstraints[0]) {
        snapSliceEdgeToCorner(
          slices[0],
          touchingStartConstraints[0].corner,
          true
        )
      }
      if (touchingEndConstraints[0]) {
        snapSliceEdgeToCorner(
          slices[slices.length - 1],
          touchingEndConstraints[0].corner,
          false
        )
      }

      splitConstraints.forEach((constraint, splitIndex) => {
        const prevSlice = slices[splitIndex]
        const nextSlice = slices[splitIndex + 1]
        if (!prevSlice || !nextSlice) {
          return
        }

        clipSliceEdgeToConstraints(
          prevSlice,
          [constraint],
          insideOrientation,
          false
        )
        clipSliceEdgeToConstraints(
          nextSlice,
          [constraint],
          insideOrientation,
          true
        )
        clipSliceCrossSectionsNearConstraints(
          prevSlice,
          [constraint],
          insideOrientation,
          false
        )
        clipSliceCrossSectionsNearConstraints(
          nextSlice,
          [constraint],
          insideOrientation,
          true
        )
        snapSliceEdgeToCorner(prevSlice, constraint.corner, false)
        snapSliceEdgeToCorner(nextSlice, constraint.corner, true)
      })

      const startCapConstraints = cornerConstraints.filter((constraint) =>
        doesDashEndpointRequireCornerClipAtEdge(
          constraint,
          slices[0].sourcePoints,
          stroke.width / 2,
          true
        )
      )
      const endCapConstraints = cornerConstraints.filter((constraint) =>
        doesDashEndpointRequireCornerClipAtEdge(
          constraint,
          slices[slices.length - 1].sourcePoints,
          stroke.width / 2,
          false
        )
      )

      const slicePolygons = slices.map((slice, sliceIndex) => {
        const polygonsForSlice = buildOneSidedSlicePolygons(slice, stroke, {
          includeStartCap:
            sliceIndex === 0 &&
            startClippingConstraints.length === 0 &&
            startCapConstraints.length === 0 &&
            !cornerConstraints.some(
              (constraint) =>
                distance(slice.outerBoundary[0], constraint.corner) <= 1e-3
            ),
          includeEndCap:
            sliceIndex === slices.length - 1 &&
            endClippingConstraints.length === 0 &&
            endCapConstraints.length === 0 &&
            !cornerConstraints.some(
              (constraint) =>
                distance(
                  slice.outerBoundary[slice.outerBoundary.length - 1],
                  constraint.corner
                ) <= 1e-3
            )
        })

        const sliceConstraints = [
          ...(sliceIndex === 0 ? startClippingConstraints : []),
          ...(sliceIndex === slices.length - 1 ? endClippingConstraints : [])
        ]

        return clipPolygonsToCornerWedges(
          polygonsForSlice,
          sliceConstraints,
          insideOrientation
        )
      })

      slicePolygons.forEach((polygonsForSlice) => {
        dashPolygons.push(...polygonsForSlice)
      })
    } else {
      const contextPoints = buildContextPoints(cursor, endDistance)
      if (!contextPoints) {
        continue
      }

      const clippedOffsetPoints = offsetPolyline(
        contextPoints.clipPoints,
        centerlineOffset,
        false,
        validateIntersection
      )
      const renderPoints = clippedOffsetPoints.slice(
        contextPoints.clipStartIndex,
        contextPoints.clipStartIndex + contextPoints.sourcePoints.length
      )
      const effectiveRenderPoints =
        renderPoints.length >= 2
          ? renderPoints
          : offsetPolyline(
              contextPoints.sourcePoints,
              centerlineOffset,
              false,
              validateIntersection
            )
      const cornerClips = cornerConstraints
        .filter((constraint) => {
          return (
            isCornerConstraintNearDash(
              constraint.distance,
              cursor,
              endDistance,
              path.totalLength,
              EPS
            ) ||
            doesDashEndpointRequireCornerClip(
              constraint,
              effectiveRenderPoints,
              stroke.width / 2
            )
          )
        })
        .map((constraint) => constraint)
      const includeStartCap =
        !cornerConstraints.some((constraint) =>
          sourceTouchesCorner(
            contextPoints.sourcePoints,
            constraint.corner,
            true
          )
        ) &&
        !cornerClips.some((constraint) =>
          doesDashEndpointRequireCornerClipAtEdge(
            constraint,
            effectiveRenderPoints,
            stroke.width / 2,
            true
          )
        )
      const includeEndCap =
        !cornerConstraints.some((constraint) =>
          sourceTouchesCorner(
            contextPoints.sourcePoints,
            constraint.corner,
            false
          )
        ) &&
        !cornerClips.some((constraint) =>
          doesDashEndpointRequireCornerClipAtEdge(
            constraint,
            effectiveRenderPoints,
            stroke.width / 2,
            false
          )
        )
      dashPolygons = buildExactDashPartPolygons(
        contextPoints.clipPoints,
        renderPoints.length >= 2 ? clippedOffsetPoints : renderPoints,
        stroke,
        {
          insideOrientation,
          skipInsideClip: true,
          contextStartIndex:
            renderPoints.length >= 2 ? contextPoints.clipStartIndex : undefined,
          contextPointCount:
            renderPoints.length >= 2
              ? contextPoints.sourcePoints.length
              : undefined,
          includeStartCap,
          includeEndCap
        }
      )

      debugSourcePoints = contextPoints.sourcePoints
      debugClipPoints = contextPoints.clipPoints
      debugRenderPoints = effectiveRenderPoints
    }

    if (
      !(stroke.position === StrokePositions.INSIDE && insideOrientation !== 0)
    ) {
      dashPolygons = mergeOverlappingConvexPolygons(dashPolygons)
    }

    if (dashPolygons.length === 0) {
      continue
    }

    polygons.push(...dashPolygons)
    debugParts.push({
      startDistance: cursor,
      endDistance,
      sourcePoints: debugSourcePoints,
      clipPoints: debugClipPoints,
      renderPoints: debugRenderPoints,
      polygons: dashPolygons
    })
  }

  return {
    model: {
      polygons
    },
    hitPolygons: polygons,
    debugParts
  }
}
