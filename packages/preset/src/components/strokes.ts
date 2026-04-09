import {
  StrokeJoinTypes,
  StrokePositions,
  StrokeStyles,
  clampOpacity,
  createDefaultStroke,
  createDefaultStrokes,
  parseColor,
  rgbaToColorInt,
  type StrokeAttrs
} from '@asyra/utils'
import {
  createMeshProjection,
  type GeometryModel,
  type MeshProjection
} from '@asyra/render'
import {
  type PathGeometry,
  buildPolylineGeometryModelPath,
  createDashedGeometryModel,
  selectDashedGeometryModelForRender
} from './geometry-model'

interface Vec2 {
  x: number
  y: number
}

export interface StrokeHitSegment {
  kind: 'polygon'
  points: Vec2[]
}

export interface StrokeBandBoundaries {
  outerBoundary: Vec2[]
  innerBoundary: Vec2[]
  centerlinePoints: Vec2[]
  collapsedTailStartIndex?: number | null
}

export interface StrokePathSource {
  geometry: PathGeometry
  sampledPoints: Vec2[]
  closed: boolean
}

export interface ResolvedStrokeGeometryEntry {
  cacheKey: string
  stroke: RenderableStroke
  polygons: Vec2[][]
}

interface StrokeDrawGraphic {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addChild?: (...args: any[]) => unknown
}

interface MeshProjectionCache {
  projection: MeshProjection
  color: number
  alpha: number
  signature: string
}

interface StrokeOverlayHost extends StrokeDrawGraphic {
  __asyraMeshProjectionCache?: Map<string, MeshProjectionCache>
}

export interface RenderableStroke {
  style: StrokeAttrs['style']
  position: StrokeAttrs['position']
  width: number
  dash: number
  gap: number
  join: 'miter' | 'bevel' | 'round'
  miterLimit: number
  cap: 'round' | 'square' | 'none'
  color: number
  alpha: number
}

const EPS = 1e-6
const MIN_RENDERABLE_POLYGON_AREA = 1e-3
const ROUND_CAP_MAX_SAGITTA = 0.05
const MIN_ROUND_CAP_STEP_ANGLE = Math.PI / 32

const normalizeStrokeEntry = (value: unknown): StrokeAttrs | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  return {
    ...createDefaultStroke(),
    ...(value as Partial<StrokeAttrs>)
  }
}

const getStrokeJoin = (
  joinType: StrokeAttrs['joinType']
): RenderableStroke['join'] => {
  if (joinType === StrokeJoinTypes.BEVEL) {
    return 'bevel'
  }

  if (joinType === StrokeJoinTypes.ROUND) {
    return 'round'
  }

  return 'miter'
}

const getStrokeMiterLimit = (angle: number): number => {
  if (!Number.isFinite(angle) || angle <= 0) {
    return 4
  }

  const radians = (angle * Math.PI) / 180
  const sinHalf = Math.sin(radians / 2)
  if (sinHalf <= 0) {
    return 4
  }

  return Math.max(1, 1 / sinHalf)
}

const getRenderableStroke = (stroke: StrokeAttrs): RenderableStroke | null => {
  if (!stroke.visible || stroke.width <= 0) {
    return null
  }

  const parsed = parseColor(stroke.color)
  if (!parsed) {
    return null
  }

  return {
    style: stroke.style,
    position: stroke.position,
    width: stroke.width,
    dash: stroke.dash,
    gap: stroke.gap,
    join: getStrokeJoin(stroke.joinType),
    miterLimit: getStrokeMiterLimit(stroke.miterAngle),
    cap: 'round',
    color: rgbaToColorInt(parsed),
    alpha: clampOpacity(parsed.a * stroke.opacity)
  }
}

export const getRenderableStrokes = (strokes: unknown): RenderableStroke[] => {
  if (!Array.isArray(strokes)) {
    return []
  }

  return strokes.reduce<RenderableStroke[]>((result, rawStroke) => {
    const stroke = normalizeStrokeEntry(rawStroke)
    if (!stroke) {
      return result
    }

    const renderableStroke = getRenderableStroke(stroke)
    if (renderableStroke) {
      result.push(renderableStroke)
    }

    return result
  }, [])
}

export const getStrokeHitWidth = (strokes: unknown): number => {
  const renderableStrokes = getRenderableStrokes(strokes)
  return renderableStrokes.reduce(
    (maxWidth, stroke) => Math.max(maxWidth, stroke.width),
    0
  )
}

export const buildPolylineStrokePathSources = (
  polylines: { points: Vec2[]; closed: boolean }[]
): StrokePathSource[] =>
  polylines.map(({ points, closed }) => ({
    geometry: buildPolylineGeometryModelPath(points, closed),
    sampledPoints: closed ? normalizeClosedPoints(points) : [...points],
    closed
  }))

const distance = (from: Vec2, to: Vec2) =>
  Math.hypot(to.x - from.x, to.y - from.y)

const normalizeClosedPoints = (points: Vec2[]): Vec2[] => {
  if (points.length > 1) {
    const first = points[0]
    const last = points[points.length - 1]
    if (distance(first, last) <= EPS) {
      return points.slice(0, -1)
    }
  }

  return points
}

const polygonArea = (points: Vec2[]): number => {
  let area = 0
  for (let i = 0; i < points.length; i += 1) {
    const next = points[(i + 1) % points.length]
    area += points[i].x * next.y - next.x * points[i].y
  }

  return area / 2
}

const addVec2 = (a: Vec2, b: Vec2): Vec2 => ({
  x: a.x + b.x,
  y: a.y + b.y
})

const subtractVec2 = (a: Vec2, b: Vec2): Vec2 => ({
  x: a.x - b.x,
  y: a.y - b.y
})

const scaleVec2 = (point: Vec2, scalar: number): Vec2 => ({
  x: point.x * scalar,
  y: point.y * scalar
})

const dotVec2 = (a: Vec2, b: Vec2): number => a.x * b.x + a.y * b.y

const distancePointToSegment = (point: Vec2, start: Vec2, end: Vec2) => {
  const segment = subtractVec2(end, start)
  const lengthSquared = dotVec2(segment, segment)
  if (lengthSquared <= EPS) {
    return distance(point, start)
  }

  const projection = Math.max(
    dotVec2(subtractVec2(point, start), segment) / lengthSquared,
    0
  )
  const clampedProjection = Math.min(projection, 1)
  const closest = addVec2(start, scaleVec2(segment, clampedProjection))
  return distance(point, closest)
}

const pointInPolygon = (point: Vec2, polygon: Vec2[]) => {
  let inside = false

  for (
    let index = 0, previous = polygon.length - 1;
    index < polygon.length;
    previous = index++
  ) {
    const current = polygon[index]
    const prev = polygon[previous]
    const intersects =
      current.y > point.y !== prev.y > point.y &&
      point.x <
        ((prev.x - current.x) * (point.y - current.y)) /
          (prev.y - current.y || Number.EPSILON) +
          current.x

    if (intersects) {
      inside = !inside
    }
  }

  return inside
}

const pointNearPolygonBoundary = (
  point: Vec2,
  polygon: Vec2[],
  tolerance: number
) =>
  polygon.some((start, index) => {
    const end = polygon[(index + 1) % polygon.length]
    return distancePointToSegment(point, start, end) <= tolerance
  })

const isPointInsideClosedShape = (
  point: Vec2,
  polygon: Vec2[],
  tolerance = 1e-3
) =>
  pointInPolygon(point, polygon) ||
  pointNearPolygonBoundary(point, polygon, tolerance)

const constrainOffsetPointToClosedShape = (
  originalPoint: Vec2,
  offsetPoint: Vec2,
  polygon: Vec2[]
) => {
  if (isPointInsideClosedShape(offsetPoint, polygon)) {
    return offsetPoint
  }

  let low = 0
  let high = 1
  let best = originalPoint

  for (let iteration = 0; iteration < 24; iteration += 1) {
    const mid = (low + high) / 2
    const candidate = addVec2(
      originalPoint,
      scaleVec2(subtractVec2(offsetPoint, originalPoint), mid)
    )

    if (isPointInsideClosedShape(candidate, polygon)) {
      best = candidate
      low = mid
    } else {
      high = mid
    }
  }

  return best
}

const normalizeVector = (point: Vec2): Vec2 | null => {
  const len = Math.hypot(point.x, point.y)
  if (len <= EPS) {
    return null
  }

  return {
    x: point.x / len,
    y: point.y / len
  }
}

const createUnitLeftNormal = (from: Vec2, to: Vec2): Vec2 | null => {
  const delta = subtractVec2(to, from)
  const len = Math.hypot(delta.x, delta.y)
  if (len <= EPS) {
    return null
  }

  return {
    x: -delta.y / len,
    y: delta.x / len
  }
}

const intersectLines = (
  a1: Vec2,
  a2: Vec2,
  b1: Vec2,
  b2: Vec2
): Vec2 | null => {
  const ax = a2.x - a1.x
  const ay = a2.y - a1.y
  const bx = b2.x - b1.x
  const by = b2.y - b1.y
  const denom = ax * by - ay * bx
  if (Math.abs(denom) <= EPS) {
    return null
  }

  const cx = b1.x - a1.x
  const cy = b1.y - a1.y
  const t = (cx * by - cy * bx) / denom

  return {
    x: a1.x + ax * t,
    y: a1.y + ay * t
  }
}

interface ShiftedSegment {
  start: Vec2
  end: Vec2
  direction: Vec2
  leftNormal: Vec2
}

const createShiftedSegment = (
  from: Vec2,
  to: Vec2,
  signedDistance: number
): ShiftedSegment | null => {
  const normal = createUnitLeftNormal(from, to)
  if (!normal) {
    return null
  }

  const shift = scaleVec2(normal, signedDistance)
  const delta = subtractVec2(to, from)
  const len = Math.hypot(delta.x, delta.y)
  if (len <= EPS) {
    return null
  }

  return {
    start: addVec2(from, shift),
    end: addVec2(to, shift),
    direction: {
      x: delta.x / len,
      y: delta.y / len
    },
    leftNormal: normal
  }
}

const dedupeAdjacentPoints = (points: Vec2[]): Vec2[] => {
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

const dedupeClosedPolygonPoints = (points: Vec2[]): Vec2[] => {
  const deduped = dedupeAdjacentPoints(points)
  if (
    deduped.length > 2 &&
    distance(deduped[0], deduped[deduped.length - 1]) <= EPS
  ) {
    deduped.pop()
  }

  return deduped
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

const isSimplePolygon = (polygon: Vec2[]) => {
  if (polygon.length < 3) {
    return false
  }

  for (let i = 0; i < polygon.length; i += 1) {
    const aStart = polygon[i]
    const aEnd = polygon[(i + 1) % polygon.length]
    for (let j = i + 1; j < polygon.length; j += 1) {
      const bStart = polygon[j]
      const bEnd = polygon[(j + 1) % polygon.length]
      const areAdjacent =
        j === i ||
        (j + 1) % polygon.length === i ||
        (i + 1) % polygon.length === j
      if (areAdjacent) {
        continue
      }

      if (segmentsTouchOrIntersect(aStart, aEnd, bStart, bEnd)) {
        return false
      }
    }
  }

  return true
}

const getArcStepAngle = (radius: number): number => {
  if (!Number.isFinite(radius) || radius <= EPS) {
    return MIN_ROUND_CAP_STEP_ANGLE
  }

  if (radius <= 0.5) {
    return MIN_ROUND_CAP_STEP_ANGLE
  }

  const cosine = 1 - ROUND_CAP_MAX_SAGITTA / radius
  const step = 2 * Math.acos(Math.max(-1, Math.min(1, cosine)))
  if (!Number.isFinite(step) || step <= EPS) {
    return MIN_ROUND_CAP_STEP_ANGLE
  }

  return Math.min(step, MIN_ROUND_CAP_STEP_ANGLE)
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

const getArcSweep = (
  fromAngle: number,
  toAngle: number,
  clockwise: boolean
) => {
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

  return endAngle - fromAngle
}

const getBoundaryCapDirection = (
  boundary: Vec2[],
  fallback: Vec2,
  atStart: boolean
) => {
  if (boundary.length < 2) {
    return fallback
  }

  return atStart
    ? subtractVec2(boundary[0], boundary[1])
    : subtractVec2(boundary[boundary.length - 1], boundary[boundary.length - 2])
}

export const chooseStrokeCapArcClockwise = (
  center: Vec2,
  startPoint: Vec2,
  endPoint: Vec2,
  capDirection: Vec2
) => {
  const startAngle = Math.atan2(
    startPoint.y - center.y,
    startPoint.x - center.x
  )
  const endAngle = Math.atan2(endPoint.y - center.y, endPoint.x - center.x)
  const targetDirection = normalizeVector(capDirection)
  if (!targetDirection) {
    return false
  }

  const ccwSweep = getArcSweep(startAngle, endAngle, false)
  const cwSweep = getArcSweep(startAngle, endAngle, true)
  const ccwMidAngle = startAngle + ccwSweep / 2
  const cwMidAngle = startAngle + cwSweep / 2
  const ccwDot =
    Math.cos(ccwMidAngle) * targetDirection.x +
    Math.sin(ccwMidAngle) * targetDirection.y
  const cwDot =
    Math.cos(cwMidAngle) * targetDirection.x +
    Math.sin(cwMidAngle) * targetDirection.y

  return cwDot > ccwDot
}

export const buildStrokeCapArcPoints = (
  center: Vec2,
  startPoint: Vec2,
  endPoint: Vec2,
  radius: number,
  options?: {
    clockwise?: boolean
  }
) =>
  buildArcPoints(
    center,
    Math.atan2(startPoint.y - center.y, startPoint.x - center.x),
    Math.atan2(endPoint.y - center.y, endPoint.x - center.x),
    radius,
    options?.clockwise ?? false
  )

export const buildStrokeStartCapPolygon = (
  outerBoundary: Vec2[],
  innerBoundary: Vec2[],
  centerlinePoints: Vec2[],
  stroke: Pick<RenderableStroke, 'width' | 'cap'>
) => {
  if (stroke.cap !== 'round') {
    return null
  }

  const radius = stroke.width / 2
  const firstCenter = centerlinePoints[0]
  const firstOuter = outerBoundary[0]
  const firstInner = innerBoundary[0]

  const startCap = dedupeClosedPolygonPoints([
    firstInner,
    ...buildStrokeCapArcPoints(firstCenter, firstInner, firstOuter, radius, {
      clockwise: chooseStrokeCapArcClockwise(
        firstCenter,
        firstInner,
        firstOuter,
        getBoundaryCapDirection(
          outerBoundary,
          subtractVec2(firstCenter, centerlinePoints[1] ?? firstCenter),
          true
        )
      )
    }),
    firstOuter
  ])

  return startCap.length >= 3 ? startCap : null
}

export const buildStrokeEndCapPolygon = (
  outerBoundary: Vec2[],
  innerBoundary: Vec2[],
  centerlinePoints: Vec2[],
  stroke: Pick<RenderableStroke, 'width' | 'cap'>
) => {
  if (stroke.cap !== 'round') {
    return null
  }

  const radius = stroke.width / 2
  const lastCenter = centerlinePoints[centerlinePoints.length - 1]
  const lastOuter = outerBoundary[outerBoundary.length - 1]
  const lastInner = innerBoundary[innerBoundary.length - 1]

  const endCap = dedupeClosedPolygonPoints([
    lastOuter,
    ...buildStrokeCapArcPoints(lastCenter, lastOuter, lastInner, radius, {
      clockwise: chooseStrokeCapArcClockwise(
        lastCenter,
        lastOuter,
        lastInner,
        getBoundaryCapDirection(
          outerBoundary,
          subtractVec2(
            lastCenter,
            centerlinePoints[centerlinePoints.length - 2] ?? lastCenter
          ),
          false
        )
      )
    }),
    lastInner
  ])

  return endCap.length >= 3 ? endCap : null
}

export const buildStrokeStripPolygon = (
  outerBoundary: Vec2[],
  innerBoundary: Vec2[]
) => {
  const stripPolygon = dedupeClosedPolygonPoints([
    ...outerBoundary,
    ...[...innerBoundary].reverse()
  ])

  return stripPolygon.length >= 3 ? stripPolygon : null
}

export const buildOneSidedStrokeShapePolygon = (
  outerBoundary: Vec2[],
  innerBoundary: Vec2[],
  centerlinePoints: Vec2[],
  stroke: Pick<RenderableStroke, 'width' | 'cap'>,
  options: {
    includeStartCap?: boolean
    includeEndCap?: boolean
  } = {}
): Vec2[][] =>
  buildStrokeBandPolygon(
    outerBoundary,
    innerBoundary,
    centerlinePoints,
    stroke,
    options
  )

export const buildStrokeBandConvexPolygons = (
  outerBoundary: Vec2[],
  innerBoundary: Vec2[],
  centerlinePoints: Vec2[],
  stroke: Pick<RenderableStroke, 'width' | 'cap'>,
  options: {
    includeStartCap?: boolean
    includeEndCap?: boolean
  } = {}
): Vec2[][] => {
  const outer = [...outerBoundary]
  const inner = [...innerBoundary]
  const centerline = [...centerlinePoints]
  if (
    outer.length < 2 ||
    inner.length < 2 ||
    centerline.length < 2 ||
    outer.length !== inner.length ||
    outer.length !== centerline.length
  ) {
    return []
  }

  const polygons: Vec2[][] = []

  for (let index = 0; index < outer.length - 1; index += 1) {
    const firstTriangle = dedupeClosedPolygonPoints([
      outer[index],
      outer[index + 1],
      inner[index + 1]
    ])
    if (firstTriangle.length >= 3) {
      polygons.push(firstTriangle)
    }

    const secondTriangle = dedupeClosedPolygonPoints([
      outer[index],
      inner[index + 1],
      inner[index]
    ])
    if (secondTriangle.length >= 3) {
      polygons.push(secondTriangle)
    }
  }

  if (stroke.cap === 'round') {
    if (options.includeStartCap !== false) {
      const startCap = buildStrokeStartCapPolygon(
        outer,
        inner,
        centerline,
        stroke
      )
      if (startCap) {
        polygons.push(startCap)
      }
    }

    if (options.includeEndCap !== false) {
      const endCap = buildStrokeEndCapPolygon(outer, inner, centerline, stroke)
      if (endCap) {
        polygons.push(endCap)
      }
    }
  }

  return polygons
}

const normalizeStrokeBandSamples = (
  outerBoundary: Vec2[],
  innerBoundary: Vec2[],
  centerlinePoints: Vec2[]
) => {
  return {
    outer: dedupeAdjacentPoints(outerBoundary),
    inner: dedupeAdjacentPoints(innerBoundary),
    centerline: dedupeAdjacentPoints(centerlinePoints)
  }
}

export const buildStrokeBandPolygon = (
  outerBoundary: Vec2[],
  innerBoundary: Vec2[],
  centerlinePoints: Vec2[],
  stroke: Pick<RenderableStroke, 'width' | 'cap'>,
  options: {
    includeStartCap?: boolean
    includeEndCap?: boolean
  } = {}
): Vec2[][] => {
  const { outer, inner, centerline } = normalizeStrokeBandSamples(
    outerBoundary,
    innerBoundary,
    centerlinePoints
  )
  if (outer.length < 2 || inner.length < 2 || centerline.length < 2) {
    return []
  }

  const includeStartCap =
    stroke.cap === 'round' && options.includeStartCap !== false
  const includeEndCap =
    stroke.cap === 'round' && options.includeEndCap !== false
  const polygons: Vec2[][] = []
  const mergedRing: Vec2[] = []

  if (includeStartCap) {
    const startCap = buildStrokeStartCapPolygon(
      outer,
      inner,
      centerline,
      stroke
    )
    if (startCap) {
      mergedRing.push(...startCap.slice(0, -1))
    }
    mergedRing.push(...outer.slice(1))
  } else {
    mergedRing.push(...outer)
  }

  if (includeEndCap) {
    const endCap = buildStrokeEndCapPolygon(outer, inner, centerline, stroke)
    if (endCap) {
      mergedRing.push(...endCap.slice(1))
    }
    mergedRing.push(...[...inner.slice(0, -1)].reverse())
  } else {
    mergedRing.push(...[...inner].reverse())
  }

  const mergedPolygon = dedupeClosedPolygonPoints(mergedRing)
  if (
    mergedPolygon.length >= 3 &&
    Math.abs(polygonArea(mergedPolygon)) > EPS &&
    isSimplePolygon(mergedPolygon)
  ) {
    return [mergedPolygon]
  }

  const stripPolygon = buildStrokeStripPolygon(outer, inner)

  if (stripPolygon) {
    polygons.push(stripPolygon)
  }

  if (includeStartCap) {
    const startCap = buildStrokeStartCapPolygon(
      outer,
      inner,
      centerline,
      stroke
    )
    if (startCap) {
      polygons.push(startCap)
    }
  }

  if (includeEndCap) {
    const endCap = buildStrokeEndCapPolygon(outer, inner, centerline, stroke)
    if (endCap) {
      polygons.push(endCap)
    }
  }

  return polygons
}

export const buildCenteredStrokeBandBoundaries = (
  points: Vec2[],
  stroke: Pick<RenderableStroke, 'width'>,
  options: {
    contextStartIndex?: number
    contextPointCount?: number
  } = {}
): StrokeBandBoundaries | null => {
  const normalizedPoints =
    options.contextStartIndex !== undefined ||
    options.contextPointCount !== undefined
      ? [...points]
      : dedupeAdjacentPoints(points)
  if (normalizedPoints.length < 2) {
    return null
  }

  const radius = stroke.width / 2
  if (radius <= EPS) {
    return null
  }

  const leftBoundary = offsetPolyline(normalizedPoints, radius, false, false)
  const rightBoundary = offsetPolyline(normalizedPoints, -radius, false, false)
  if (
    leftBoundary.length !== normalizedPoints.length ||
    rightBoundary.length !== normalizedPoints.length
  ) {
    return null
  }

  const contextStartIndex = Math.max(0, options.contextStartIndex ?? 0)
  const contextPointCount =
    options.contextPointCount ?? normalizedPoints.length - contextStartIndex
  const renderPoints = normalizedPoints.slice(
    contextStartIndex,
    contextStartIndex + contextPointCount
  )
  const renderLeftBoundary = dedupeAdjacentPoints(
    leftBoundary.slice(contextStartIndex, contextStartIndex + contextPointCount)
  )
  const renderRightBoundary = dedupeAdjacentPoints(
    rightBoundary.slice(
      contextStartIndex,
      contextStartIndex + contextPointCount
    )
  )
  const renderCenterlinePoints = dedupeAdjacentPoints(renderPoints)
  if (
    renderCenterlinePoints.length < 2 ||
    renderLeftBoundary.length !== renderCenterlinePoints.length ||
    renderRightBoundary.length !== renderCenterlinePoints.length
  ) {
    return null
  }

  return {
    outerBoundary: renderLeftBoundary,
    innerBoundary: renderRightBoundary,
    centerlinePoints: renderCenterlinePoints
  }
}

const buildStrokeShapePolygons = (
  points: Vec2[],
  stroke: Pick<RenderableStroke, 'width' | 'join' | 'miterLimit' | 'cap'>,
  options: {
    includeStartCap?: boolean
    includeEndCap?: boolean
    contextStartIndex?: number
    contextPointCount?: number
  } = {}
): Vec2[][] => {
  const boundaries = buildCenteredStrokeBandBoundaries(points, stroke, {
    contextStartIndex: options.contextStartIndex,
    contextPointCount: options.contextPointCount
  })
  if (!boundaries) {
    return []
  }

  return buildStrokeBandPolygon(
    boundaries.outerBoundary,
    boundaries.innerBoundary,
    boundaries.centerlinePoints,
    stroke,
    options
  )
}

const createGeometryModelFromPolygons = (polygons: Vec2[][]): GeometryModel => {
  // Convert Vec2[] to GeometryPoint[] format expected by mesh projection
  const geometryPolygons = polygons.map((polygon) =>
    polygon.map((point) => ({
      x: point.x,
      y: point.y
    }))
  )

  // Calculate bounds
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  geometryPolygons.forEach((polygon) =>
    polygon.forEach((point) => {
      minX = Math.min(minX, point.x)
      minY = Math.min(minY, point.y)
      maxX = Math.max(maxX, point.x)
      maxY = Math.max(maxY, point.y)
    })
  )

  return {
    polygons: geometryPolygons,
    bounds: Number.isFinite(minX)
      ? {
          minX,
          minY,
          maxX,
          maxY
        }
      : undefined
  }
}

const fillStrokePolygonsWithMesh = (
  host: StrokeOverlayHost,
  polygons: Vec2[][],
  stroke: RenderableStroke,
  cacheKey: string,
  activeMeshKeys: Set<string>
): boolean => {
  const drawablePolygons = polygons.filter((polygon) => polygon.length >= 3)
  if (drawablePolygons.length === 0) {
    return false
  }

  if (typeof host.addChild !== 'function') {
    return false
  }

  if (!host.__asyraMeshProjectionCache) {
    host.__asyraMeshProjectionCache = new Map()
  }

  const cache = host.__asyraMeshProjectionCache
  const signature = drawablePolygons
    .map((polygon) =>
      polygon
        .map((point) => `${point.x.toFixed(3)},${point.y.toFixed(3)}`)
        .join(';')
    )
    .join('|')

  let projectionCache = cache.get(cacheKey)
  const modelChanged =
    !projectionCache || projectionCache.signature !== signature
  const paintChanged =
    !projectionCache ||
    projectionCache.color !== stroke.color ||
    projectionCache.alpha !== stroke.alpha

  if (!projectionCache) {
    const geometryModel = createGeometryModelFromPolygons(drawablePolygons)
    const projection = createMeshProjection({
      model: geometryModel,
      paint: {
        kind: 'solid',
        color: stroke.color,
        alpha: stroke.alpha
      }
    })

    projectionCache = {
      projection,
      color: stroke.color,
      alpha: stroke.alpha,
      signature
    }
    cache.set(cacheKey, projectionCache)

    const attachSuccess = projection.attach(host)
    if (!attachSuccess) {
      cache.delete(cacheKey)
      projection.dispose()
      return false
    }
  } else if (modelChanged || paintChanged) {
    projectionCache.projection.update({
      model: createGeometryModelFromPolygons(drawablePolygons),
      paint: {
        kind: 'solid',
        color: stroke.color,
        alpha: stroke.alpha
      }
    })
    projectionCache.signature = signature
    projectionCache.color = stroke.color
    projectionCache.alpha = stroke.alpha
    projectionCache.projection.setVisible(true)
  } else {
    projectionCache.projection.setVisible(true)
  }

  activeMeshKeys.add(cacheKey)
  return true
}

const getJoinedOffsetPoint = (
  prevSegment: ShiftedSegment | null,
  nextSegment: ShiftedSegment | null,
  originalPoint: Vec2,
  validateIntersection: boolean
): Vec2 => {
  if (!prevSegment && !nextSegment) {
    return originalPoint
  }

  if (!prevSegment) {
    return nextSegment?.start ?? originalPoint
  }

  if (!nextSegment) {
    return prevSegment.end
  }

  const intersection = intersectLines(
    prevSegment.start,
    prevSegment.end,
    nextSegment.start,
    nextSegment.end
  )

  if (intersection) {
    if (!validateIntersection) {
      return intersection
    }

    // Special handling for acute angles: use the intersection directly
    // Compute angle between the two segment directions
    const cosAngle = dotVec2(prevSegment.direction, nextSegment.direction)
    // If angle < ~30 degrees (cosAngle > 0.866), treat as acute and use intersection
    const isAcuteAngle = cosAngle > 0.87

    if (isAcuteAngle) {
      return intersection
    }

    const prevBackward = dotVec2(
      subtractVec2(prevSegment.end, intersection),
      prevSegment.direction
    )
    const nextForward = dotVec2(
      subtractVec2(intersection, nextSegment.start),
      nextSegment.direction
    )

    if (prevBackward >= -EPS && nextForward >= -EPS) {
      return intersection
    }
  }

  return scaleVec2(addVec2(prevSegment.end, nextSegment.start), 0.5)
}

export const offsetPolyline = (
  points: Vec2[],
  signedDistance: number,
  closed: boolean,
  validateIntersection: boolean
): Vec2[] => {
  if (points.length < 2 || Math.abs(signedDistance) <= EPS) {
    return closed ? normalizeClosedPoints(points) : [...points]
  }

  const normalized = closed ? normalizeClosedPoints(points) : [...points]
  if (normalized.length < 2) {
    return normalized
  }

  const segments = normalized.map((point, index) => {
    const nextIndex = index + 1
    if (nextIndex >= normalized.length) {
      if (!closed) {
        return null
      }

      return createShiftedSegment(
        normalized[index],
        normalized[(index + 1) % normalized.length],
        signedDistance
      )
    }

    return createShiftedSegment(point, normalized[nextIndex], signedDistance)
  })

  if (closed) {
    return normalized.map((point, index) =>
      getJoinedOffsetPoint(
        segments[(index - 1 + normalized.length) % normalized.length],
        segments[index],
        point,
        validateIntersection
      )
    )
  }

  const firstSegment = segments[0]
  const lastSegment = segments[normalized.length - 2]
  const offsetPoints: Vec2[] = []

  offsetPoints.push(firstSegment?.start ?? normalized[0])

  for (let i = 1; i < normalized.length - 1; i += 1) {
    offsetPoints.push(
      getJoinedOffsetPoint(
        segments[i - 1],
        segments[i],
        normalized[i],
        validateIntersection
      )
    )
  }

  offsetPoints.push(lastSegment?.end ?? normalized[normalized.length - 1])
  return offsetPoints
}

export const getStrokeCenterlineOffset = (
  points: Vec2[],
  closed: boolean,
  stroke: RenderableStroke
): number => {
  if (!closed || stroke.position === StrokePositions.CENTER) {
    return 0
  }

  const normalized = normalizeClosedPoints(points)
  if (normalized.length < 3) {
    return 0
  }

  const orientation = polygonArea(normalized) >= 0 ? 1 : -1
  const halfWidth = stroke.width / 2

  return stroke.position === StrokePositions.INSIDE
    ? halfWidth * orientation
    : -halfWidth * orientation
}

export const buildStrokeHitSegments = (
  polylines: { points: Vec2[]; closed: boolean }[],
  strokes: unknown
): StrokeHitSegment[] =>
  buildStrokeHitSegmentsFromResolvedGeometry(
    buildResolvedStrokeGeometryFromSources(
      buildPolylineStrokePathSources(polylines),
      strokes
    )
  )

export const buildStrokeHitSegmentsFromResolvedGeometry = (
  geometryEntries: ResolvedStrokeGeometryEntry[]
): StrokeHitSegment[] =>
  geometryEntries.flatMap((entry) =>
    entry.polygons.flatMap((polygon) =>
      polygon.length >= 3
        ? [
            {
              kind: 'polygon' as const,
              points: polygon
            }
          ]
        : []
    )
  )

export const buildResolvedStrokeGeometryFromSources = (
  sources: StrokePathSource[],
  strokes: unknown
): ResolvedStrokeGeometryEntry[] => {
  const renderableStrokes = getRenderableStrokes(strokes)
  if (renderableStrokes.length === 0) {
    return []
  }

  const geometryEntries: ResolvedStrokeGeometryEntry[] = []

  renderableStrokes.forEach((stroke, strokeIndex) => {
    if (stroke.width <= 0) {
      return
    }

    sources.forEach(({ geometry, sampledPoints, closed }, sourceIndex) => {
      const strokePoints = closed
        ? normalizeClosedPoints(sampledPoints)
        : [...sampledPoints]
      if (strokePoints.length < 2) {
        return
      }

      if (stroke.style === StrokeStyles.DASHED) {
        const dashedGeometry =
          selectDashedGeometryModelForRender(geometry, stroke) ??
          createDashedGeometryModel(geometry, stroke)
        geometryEntries.push({
          cacheKey: `dashed_${strokeIndex}_${sourceIndex}`,
          stroke,
          polygons: dashedGeometry?.model?.polygons ?? []
        })
        return
      }

      geometryEntries.push({
        cacheKey: `solid_${strokeIndex}_${sourceIndex}`,
        stroke,
        polygons: buildSolidStrokePolygons(strokePoints, closed, stroke)
      })
    })
  })

  return geometryEntries
}

export const buildStrokeHitSegmentsFromSources = (
  sources: StrokePathSource[],
  strokes: unknown
): StrokeHitSegment[] =>
  buildStrokeHitSegmentsFromResolvedGeometry(
    buildResolvedStrokeGeometryFromSources(sources, strokes)
  )

function buildClosedStrokePolygons(
  points: Vec2[],
  stroke: Pick<RenderableStroke, 'width'>
): Vec2[][] {
  const normalizedPoints = normalizeClosedPoints(points)
  if (normalizedPoints.length < 3) {
    return []
  }

  const radius = stroke.width / 2
  if (radius <= EPS) {
    return []
  }

  const outerBoundary = offsetPolyline(normalizedPoints, radius, true, false)
  const innerBoundary = offsetPolyline(normalizedPoints, -radius, true, false)
  if (
    outerBoundary.length !== normalizedPoints.length ||
    innerBoundary.length !== normalizedPoints.length
  ) {
    return []
  }

  const polygon = dedupeClosedPolygonPoints([
    ...outerBoundary,
    ...[...innerBoundary].reverse()
  ])

  return polygon.length >= 3 ? [polygon] : []
}

function buildClosedInsideSolidStrokePolygons(
  points: Vec2[],
  stroke: RenderableStroke,
  insideOrientation: 1 | -1
): Vec2[][] {
  const normalizedPoints = normalizeClosedPoints(points)
  if (normalizedPoints.length < 3) {
    return []
  }

  const innerBoundary = offsetPolyline(
    normalizedPoints,
    stroke.width * insideOrientation,
    true,
    true
  )
  if (innerBoundary.length !== normalizedPoints.length) {
    return []
  }
  const constrainedInnerBoundary = innerBoundary.map((point, index) =>
    constrainOffsetPointToClosedShape(
      normalizedPoints[index],
      point,
      normalizedPoints
    )
  )

  const directRing = dedupeClosedPolygonPoints([
    ...normalizedPoints,
    ...[...constrainedInnerBoundary].reverse()
  ])
  if (
    directRing.length >= 3 &&
    Math.abs(polygonArea(directRing)) > EPS &&
    isSimplePolygon(directRing)
  ) {
    return [directRing]
  }

  const centerlinePoints = offsetPolyline(
    normalizedPoints,
    (stroke.width / 2) * insideOrientation,
    true,
    true
  )
  if (centerlinePoints.length !== normalizedPoints.length) {
    return []
  }

  const fallbackPolygons = buildStrokeBandConvexPolygons(
    normalizedPoints,
    constrainedInnerBoundary,
    centerlinePoints,
    stroke,
    {
      includeStartCap: false,
      includeEndCap: false
    }
  ).filter(
    (polygon) =>
      polygon.length >= 3 &&
      Math.abs(polygonArea(polygon)) >= MIN_RENDERABLE_POLYGON_AREA
  )
  return fallbackPolygons
}

function buildSolidStrokePolygons(
  points: Vec2[],
  closed: boolean,
  stroke: RenderableStroke
): Vec2[][] {
  const strokePoints = closed ? normalizeClosedPoints(points) : [...points]
  if (strokePoints.length < 2) {
    return []
  }

  const centerlineOffset = getStrokeCenterlineOffset(
    strokePoints,
    closed,
    stroke
  )
  const insideOrientation =
    closed && stroke.position === StrokePositions.INSIDE
      ? polygonArea(normalizeClosedPoints(strokePoints)) >= 0
        ? 1
        : -1
      : 0
  if (insideOrientation !== 0) {
    return buildClosedInsideSolidStrokePolygons(
      strokePoints,
      stroke,
      insideOrientation
    )
  }

  const validateIntersection =
    closed && stroke.position === StrokePositions.INSIDE
  const renderPoints = offsetPolyline(
    strokePoints,
    centerlineOffset,
    closed,
    validateIntersection
  )

  const polygons = closed
    ? buildClosedStrokePolygons(renderPoints, stroke)
    : buildStrokeShapePolygons(renderPoints, stroke)
  return polygons
}

export const renderPolylineStrokes = (
  graphic: StrokeDrawGraphic,
  polylines: { points: Vec2[]; closed: boolean }[],
  strokes: unknown
) =>
  renderResolvedStrokeGeometry(
    graphic,
    buildResolvedStrokeGeometryFromSources(
      buildPolylineStrokePathSources(polylines),
      strokes
    )
  )

export const renderResolvedStrokeGeometry = (
  graphic: StrokeDrawGraphic,
  geometryEntries: ResolvedStrokeGeometryEntry[]
) => {
  const graphicHost = graphic as StrokeOverlayHost

  if (!graphicHost.__asyraMeshProjectionCache) {
    graphicHost.__asyraMeshProjectionCache = new Map()
  }
  const activeMeshKeys = new Set<string>()

  if (geometryEntries.length === 0) {
    graphicHost.__asyraMeshProjectionCache.forEach((projectionCache) => {
      projectionCache.projection.dispose()
    })
    graphicHost.__asyraMeshProjectionCache.clear()
    return
  }

  geometryEntries.forEach((entry) => {
    fillStrokePolygonsWithMesh(
      graphicHost,
      entry.polygons,
      entry.stroke,
      entry.cacheKey,
      activeMeshKeys
    )
  })

  graphicHost.__asyraMeshProjectionCache.forEach((projectionCache, key) => {
    if (activeMeshKeys.has(key)) {
      return
    }
    projectionCache.projection.dispose()
    graphicHost.__asyraMeshProjectionCache?.delete(key)
  })
}

export const renderStrokeSources = (
  graphic: StrokeDrawGraphic,
  sources: StrokePathSource[],
  strokes: unknown
) =>
  renderResolvedStrokeGeometry(
    graphic,
    buildResolvedStrokeGeometryFromSources(sources, strokes)
  )

export const DEFAULT_RECTANGLE_STROKES: StrokeAttrs[] = []
export const DEFAULT_OVAL_STROKES: StrokeAttrs[] = []
export const DEFAULT_GROUP_STROKES: StrokeAttrs[] = []
export const DEFAULT_FRAME_STROKES = createDefaultStrokes({ color: '#000000' })
