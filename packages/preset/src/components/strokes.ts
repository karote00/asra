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

interface Vec2 {
  x: number
  y: number
}

export interface StrokeHitSegment {
  kind: 'segment' | 'polygon'
  start?: Vec2
  end?: Vec2
  radius?: number
  points?: Vec2[]
}

interface StrokeDrawGraphic {
  moveTo: (x: number, y: number) => void
  lineTo: (x: number, y: number) => void
  closePath?: () => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  stroke: (...args: any[]) => unknown
  beginPath?: () => void
  clear?: () => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fill?: (...args: any[]) => unknown
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addChild?: (...args: any[]) => unknown
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setMask?: (options: any) => unknown
  mask?: unknown
  children?: unknown[]
  visible?: boolean
  renderable?: boolean
}

interface StrokeOverlayCache {
  mask: StrokeDrawGraphic
  inside: StrokeDrawGraphic
  outside: StrokeDrawGraphic
}

interface StrokeOverlayHost extends StrokeDrawGraphic {
  __asyraStrokeOverlayCache?: StrokeOverlayCache
}

export interface RenderableStroke {
  style: StrokeAttrs['style']
  position: StrokeAttrs['position']
  width: number
  dash: number
  gap: number
  join: 'miter' | 'bevel' | 'round'
  miterLimit: number
  cap: 'round'
  color: number
  alpha: number
}

export interface DashedStrokeDebugPart {
  sourcePoints: Vec2[]
  clipPoints: Vec2[]
  renderPoints: Vec2[]
  polygons: Vec2[][]
}

interface DashedStrokePart {
  sourcePoints: Vec2[]
  clipPoints: Vec2[]
  clipStartIndex: number
}

const DASH_LENGTH_FACTOR = 4
const DASH_GAP_FACTOR = 2
const MIN_DASH_LENGTH = 0.1
const EPS = 1e-6

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
    alpha: clampOpacity(parsed.a * stroke.opacity),
    paint: (stroke as any).paint
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

export const applyStrokeStyle = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  graphic: { stroke: (...args: any[]) => unknown },
  stroke: RenderableStroke
) => {
  graphic.stroke({
    width: stroke.width,
    color: stroke.color,
    alpha: stroke.alpha,
    cap: stroke.cap,
    join: stroke.join,
    miterLimit: stroke.miterLimit
  })
}

export const beginStrokePath = (graphic: { beginPath?: () => void }) => {
  graphic.beginPath?.()
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

export const buildOneSidedStrokeShapePolygon = (
  outerBoundary: Vec2[],
  innerBoundary: Vec2[],
  centerlinePoints: Vec2[],
  stroke: Pick<RenderableStroke, 'width' | 'cap'>,
  options: {
    includeStartCap?: boolean
    includeEndCap?: boolean
  } = {}
): Vec2[][] => {
  const outer = dedupeAdjacentPoints(outerBoundary)
  const inner = dedupeAdjacentPoints(innerBoundary)
  const centerline = dedupeAdjacentPoints(centerlinePoints)
  if (outer.length < 2 || inner.length < 2 || centerline.length < 2) {
    return []
  }

  const radius = stroke.width / 2
  const firstCenter = centerline[0]
  const lastCenter = centerline[centerline.length - 1]
  const firstOuter = outer[0]
  const firstInner = inner[0]
  const lastOuter = outer[outer.length - 1]
  const lastInner = inner[inner.length - 1]

  const startCapPoints =
    stroke.cap === 'round' && options.includeStartCap !== false
      ? [
          firstInner,
          ...buildRoundCapPoints(firstCenter, firstInner, firstOuter, radius),
          firstOuter
        ]
      : []
  const endCapPoints =
    stroke.cap === 'round' && options.includeEndCap !== false
      ? [
          lastOuter,
          ...buildRoundCapPoints(lastCenter, lastOuter, lastInner, radius),
          lastInner
        ]
      : []

  const polygon = dedupeClosedPolygonPoints([
    ...outer,
    ...(endCapPoints.length > 0 ? endCapPoints.slice(1) : [lastInner]),
    ...inner.slice(0, -1).reverse(),
    ...(startCapPoints.length > 0
      ? startCapPoints.slice(1, Math.max(1, startCapPoints.length - 1))
      : [])
  ])

  return polygon.length >= 3 ? [polygon] : []
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
  const normalizedPoints =
    options.contextStartIndex !== undefined ||
    options.contextPointCount !== undefined
      ? [...points]
      : dedupeAdjacentPoints(points)
  if (normalizedPoints.length < 2) {
    return []
  }

  const radius = stroke.width / 2
  if (radius <= EPS) {
    return []
  }

  const leftBoundary = offsetPolyline(normalizedPoints, radius, false, false)
  const rightBoundary = offsetPolyline(normalizedPoints, -radius, false, false)
  if (
    leftBoundary.length !== normalizedPoints.length ||
    rightBoundary.length !== normalizedPoints.length
  ) {
    return []
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
    return []
  }

  const firstPoint = renderCenterlinePoints[0]
  const lastPoint = renderCenterlinePoints[renderCenterlinePoints.length - 1]
  const startLeft = renderLeftBoundary[0]
  const startRight = renderRightBoundary[0]
  const endLeft = renderLeftBoundary[renderLeftBoundary.length - 1]
  const endRight = renderRightBoundary[renderRightBoundary.length - 1]

  const polygon = dedupeClosedPolygonPoints([
    ...renderLeftBoundary,
    ...(stroke.cap === 'round' && options.includeEndCap !== false
      ? buildRoundCapPoints(lastPoint, endLeft, endRight, radius)
      : [endRight]),
    ...renderRightBoundary.slice(0, -1).reverse(),
    ...(stroke.cap === 'round' && options.includeStartCap !== false
      ? buildRoundCapPoints(firstPoint, startRight, startLeft, radius)
      : [])
  ])

  return polygon.length >= 3 ? [polygon] : []
}

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
    const currentDistance = dotVec2(
      subtractVec2(current, linePoint),
      inwardNormal
    )
    const previousDistance = dotVec2(
      subtractVec2(previous, linePoint),
      inwardNormal
    )
    const currentInside = currentDistance >= -EPS
    const previousInside = previousDistance >= -EPS

    if (currentInside !== previousInside) {
      const delta = subtractVec2(current, previous)
      const denominator = dotVec2(delta, inwardNormal)
      if (Math.abs(denominator) > EPS) {
        const t =
          dotVec2(subtractVec2(linePoint, previous), inwardNormal) / denominator
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

  return dedupeClosedPolygonPoints(clipped)
}

const clipInsideDashPolygon = (
  polygon: Vec2[],
  originalPoints: Vec2[],
  orientation: 1 | -1
): Vec2[] => {
  let clipped = dedupeClosedPolygonPoints(polygon)
  const normalizedPoints = dedupeAdjacentPoints(originalPoints)

  for (let pass = 0; pass < 3 && clipped.length >= 3; pass += 1) {
    const beforePass = clipped
    for (
      let i = 0;
      i < normalizedPoints.length - 1 && clipped.length >= 3;
      i += 1
    ) {
      const normal = createUnitLeftNormal(
        normalizedPoints[i],
        normalizedPoints[i + 1]
      )
      if (!normal) {
        continue
      }

      clipped = clipPolygonAgainstHalfPlane(
        clipped,
        normalizedPoints[i],
        scaleVec2(normal, orientation)
      )
    }

    if (
      clipped.length === beforePass.length &&
      clipped.every(
        (point, index) =>
          distance(
            point,
            beforePass[index] ?? { x: Number.NaN, y: Number.NaN }
          ) <= EPS
      )
    ) {
      break
    }
  }

  return clipped
}

export const buildExactDashPartPolygons = (
  originalPoints: Vec2[],
  renderPoints: Vec2[],
  stroke: RenderableStroke,
  options?: {
    insideOrientation?: 1 | -1 | 0
    includeStartCap?: boolean
    includeEndCap?: boolean
    skipInsideClip?: boolean
    contextStartIndex?: number
    contextPointCount?: number
  }
): Vec2[][] => {
  const insideOrientation = options?.insideOrientation ?? 0
  const outlines =
    insideOrientation !== 0
      ? buildOneSidedStrokeShapePolygon(
          originalPoints.slice(
            Math.max(0, options?.contextStartIndex ?? 0),
            Math.max(0, options?.contextStartIndex ?? 0) +
              (options?.contextPointCount ??
                Math.max(
                  0,
                  originalPoints.length -
                    Math.max(0, options?.contextStartIndex ?? 0)
                ))
          ),
          offsetPolyline(
            originalPoints,
            stroke.width * insideOrientation,
            false,
            true
          ).slice(
            Math.max(0, options?.contextStartIndex ?? 0),
            Math.max(0, options?.contextStartIndex ?? 0) +
              (options?.contextPointCount ??
                Math.max(
                  0,
                  originalPoints.length -
                    Math.max(0, options?.contextStartIndex ?? 0)
                ))
          ),
          renderPoints,
          stroke,
          {
            includeStartCap: options?.includeStartCap,
            includeEndCap: options?.includeEndCap
          }
        )
      : buildStrokeShapePolygons(renderPoints, stroke, {
          includeStartCap: options?.includeStartCap,
          includeEndCap: options?.includeEndCap,
          contextStartIndex: options?.contextStartIndex,
          contextPointCount: options?.contextPointCount
        })
  if (outlines.length === 0) {
    return []
  }

  if (insideOrientation === 0 || options?.skipInsideClip) {
    return outlines
  }

  return outlines
    .map((outline) =>
      clipInsideDashPolygon(outline, originalPoints, insideOrientation)
    )
    .filter((outline) => outline.length >= 3)
}

export const buildDashedStrokeDebugParts = (
  points: Vec2[],
  closed: boolean,
  stroke: RenderableStroke
): DashedStrokeDebugPart[] => {
  const strokePoints = closed ? normalizeClosedPoints(points) : [...points]
  if (strokePoints.length < 2 || stroke.style !== StrokeStyles.DASHED) {
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
  const validateIntersection =
    closed && stroke.position === StrokePositions.INSIDE

  return buildDashedParts(strokePoints, closed, stroke).map((part) => {
    const renderPoints = buildDashedRenderPoints(
      part,
      centerlineOffset,
      validateIntersection
    )

    return {
      sourcePoints: part.sourcePoints,
      clipPoints: part.clipPoints,
      renderPoints,
      polygons: buildExactDashPartPolygons(
        part.clipPoints,
        renderPoints,
        stroke,
        {
          insideOrientation,
          contextStartIndex: part.clipStartIndex,
          contextPointCount: part.sourcePoints.length
        }
      )
    }
  })
}

const applyStrokeFillStyle = (
  graphic: Pick<StrokeDrawGraphic, 'fill'>,
  stroke: RenderableStroke
) => {
  const fill = graphic.fill
  if (typeof fill !== 'function') {
    return
  }

  if (stroke.alpha >= 1) {
    fill.call(graphic, stroke.color)
    return
  }

  fill.call(graphic, {
    color: stroke.color,
    alpha: stroke.alpha
  })
}

const fillStrokePolygons = (
  graphic: StrokeDrawGraphic,
  polygons: Vec2[][],
  stroke: RenderableStroke
) => {
  if (typeof graphic.fill !== 'function') {
    return false
  }

  const drawablePolygons = polygons.filter((polygon) => polygon.length >= 3)
  if (drawablePolygons.length === 0) {
    return false
  }

  graphic.beginPath?.()
  drawablePolygons.forEach((polygon) => {
    drawPolyline(graphic, polygon, true)
  })
  applyStrokeFillStyle(graphic, stroke)

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

const buildSegmentDistances = (points: Vec2[], closed: boolean) => {
  if (points.length < 2) {
    return {
      path: points,
      distances: [0],
      totalLength: 0
    }
  }

  const path = closed
    ? [...normalizeClosedPoints(points), points[0]]
    : [...points]
  const distances = [0]
  let totalLength = 0

  for (let i = 0; i < path.length - 1; i += 1) {
    totalLength += distance(path[i], path[i + 1])
    distances.push(totalLength)
  }

  return {
    path,
    distances,
    totalLength
  }
}

const pointAtDistance = (
  path: Vec2[],
  distances: number[],
  targetDistance: number
): Vec2 => {
  if (targetDistance <= 0) {
    return path[0]
  }

  const totalLength = distances[distances.length - 1] ?? 0
  if (targetDistance >= totalLength) {
    return path[path.length - 1]
  }

  for (let i = 0; i < distances.length - 1; i += 1) {
    const startDistance = distances[i]
    const endDistance = distances[i + 1]
    if (targetDistance > endDistance) {
      continue
    }

    const segmentLength = endDistance - startDistance
    if (segmentLength <= EPS) {
      return path[i]
    }

    const t = (targetDistance - startDistance) / segmentLength
    return {
      x: path[i].x + (path[i + 1].x - path[i].x) * t,
      y: path[i].y + (path[i + 1].y - path[i].y) * t
    }
  }

  return path[path.length - 1]
}

const extractPolylineSegmentFromPath = (
  path: Vec2[],
  distances: number[],
  totalLength: number,
  startDistance: number,
  endDistance: number
): Vec2[] => {
  if (path.length < 2 || totalLength <= EPS || endDistance <= startDistance) {
    return []
  }

  const segmentPoints: Vec2[] = [
    pointAtDistance(path, distances, startDistance)
  ]

  for (let i = 1; i < distances.length - 1; i += 1) {
    if (distances[i] > startDistance && distances[i] < endDistance) {
      segmentPoints.push(path[i])
    }
  }

  segmentPoints.push(pointAtDistance(path, distances, endDistance))
  return segmentPoints
}

const mergePolylineSegments = (head: Vec2[], tail: Vec2[]): Vec2[] => {
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

const extractPolylineSegmentWithContext = (
  points: Vec2[],
  closed: boolean,
  startDistance: number,
  endDistance: number
): Vec2[] => {
  const { path, distances, totalLength } = buildSegmentDistances(points, closed)
  if (path.length < 2 || totalLength <= EPS || endDistance <= startDistance) {
    return []
  }

  if (!closed || (startDistance >= 0 && endDistance <= totalLength)) {
    return extractPolylineSegmentFromPath(
      path,
      distances,
      totalLength,
      Math.max(0, startDistance),
      Math.min(totalLength, endDistance)
    )
  }

  if (startDistance < 0) {
    return mergePolylineSegments(
      extractPolylineSegmentFromPath(
        path,
        distances,
        totalLength,
        totalLength + startDistance,
        totalLength
      ),
      extractPolylineSegmentFromPath(
        path,
        distances,
        totalLength,
        0,
        Math.min(totalLength, endDistance)
      )
    )
  }

  return mergePolylineSegments(
    extractPolylineSegmentFromPath(
      path,
      distances,
      totalLength,
      Math.max(0, startDistance),
      totalLength
    ),
    extractPolylineSegmentFromPath(
      path,
      distances,
      totalLength,
      0,
      endDistance - totalLength
    )
  )
}

const findPointSequenceStart = (points: Vec2[], sequence: Vec2[]): number => {
  if (sequence.length === 0 || points.length < sequence.length) {
    return -1
  }

  for (let i = 0; i <= points.length - sequence.length; i += 1) {
    let matched = true
    for (let j = 0; j < sequence.length; j += 1) {
      if (distance(points[i + j], sequence[j]) > EPS) {
        matched = false
        break
      }
    }
    if (matched) {
      return i
    }
  }

  return -1
}

const createDashedPartWithContext = (
  points: Vec2[],
  closed: boolean,
  stroke: RenderableStroke,
  startDistance: number,
  endDistance: number
): DashedStrokePart => {
  const sourcePoints = extractPolylineSegmentWithContext(
    points,
    closed,
    startDistance,
    endDistance
  )
  const contextPadding = Math.max(stroke.width, stroke.width / 2 + 1)
  const clipPoints = extractPolylineSegmentWithContext(
    points,
    closed,
    startDistance - contextPadding,
    endDistance + contextPadding
  )
  const clipStartIndex = findPointSequenceStart(clipPoints, sourcePoints)

  return {
    sourcePoints,
    clipPoints,
    clipStartIndex: clipStartIndex >= 0 ? clipStartIndex : 0
  }
}

const buildDashedParts = (
  points: Vec2[],
  closed: boolean,
  stroke: RenderableStroke
) => {
  const { totalLength } = buildSegmentDistances(points, closed)
  if (totalLength <= EPS) {
    return []
  }

  const { dash, gap } = getDashPattern(stroke)
  const parts: DashedStrokePart[] = []
  let cursor = 0
  const cycleLength = dash + gap

  while (cursor < totalLength - EPS) {
    const endDistance = Math.min(totalLength, cursor + dash)
    const part = createDashedPartWithContext(
      points,
      closed,
      stroke,
      cursor,
      endDistance
    )
    if (part.sourcePoints.length >= 2) {
      parts.push(part)
    }
    cursor += cycleLength
  }

  return parts
}

const buildDashedRenderPoints = (
  part: DashedStrokePart,
  centerlineOffset: number,
  validateIntersection: boolean
): Vec2[] => {
  const clippedOffsetPoints = offsetPolyline(
    part.clipPoints,
    centerlineOffset,
    false,
    validateIntersection
  )

  return clippedOffsetPoints
}

const buildHitSegments = (
  points: Vec2[],
  closed: boolean,
  radius: number
): StrokeHitSegment[] => {
  if (points.length < 2 || radius <= 0) {
    return []
  }

  const segments: StrokeHitSegment[] = []
  for (let i = 0; i < points.length - 1; i += 1) {
    segments.push({
      kind: 'segment',
      start: points[i],
      end: points[i + 1],
      radius
    })
  }

  if (closed && points.length > 2) {
    segments.push({
      kind: 'segment',
      start: points[points.length - 1],
      end: points[0],
      radius
    })
  }

  return segments
}

export const buildStrokeHitSegments = (
  polylines: { points: Vec2[]; closed: boolean }[],
  strokes: unknown
): StrokeHitSegment[] => {
  const renderableStrokes = getRenderableStrokes(strokes)
  if (renderableStrokes.length === 0) {
    return []
  }

  const hitSegments: StrokeHitSegment[] = []

  renderableStrokes.forEach((stroke) => {
    const radius = stroke.width / 2
    if (radius <= 0) {
      return
    }

    polylines.forEach(({ points, closed }) => {
      const strokePoints = closed ? normalizeClosedPoints(points) : [...points]
      if (strokePoints.length < 2) {
        return
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
      const validateIntersection =
        closed && stroke.position === StrokePositions.INSIDE

      if (stroke.style === StrokeStyles.DASHED) {
        const dashParts = buildDashedParts(strokePoints, closed, stroke)
        dashParts.forEach((part) => {
          const renderPoints = buildDashedRenderPoints(
            part,
            centerlineOffset,
            validateIntersection
          )
          const polygons = buildExactDashPartPolygons(
            part.clipPoints,
            renderPoints,
            stroke,
            {
              insideOrientation,
              contextStartIndex: part.clipStartIndex,
              contextPointCount: part.sourcePoints.length
            }
          )
          polygons.forEach((polygon) => {
            if (polygon.length >= 3) {
              hitSegments.push({
                kind: 'polygon',
                points: polygon
              })
            }
          })
        })
        return
      }

      const renderPoints = offsetPolyline(
        strokePoints,
        centerlineOffset,
        closed,
        validateIntersection
      )
      hitSegments.push(...buildHitSegments(renderPoints, closed, radius))
    })
  })

  return hitSegments
}

const createGraphicsChild = (
  graphic: StrokeDrawGraphic
): StrokeDrawGraphic | null => {
  if (typeof graphic.addChild !== 'function') {
    return null
  }

  try {
    const GraphicCtor = (
      graphic as StrokeDrawGraphic & {
        constructor?: new () => StrokeDrawGraphic
      }
    ).constructor

    if (typeof GraphicCtor !== 'function') {
      return null
    }

    const child = new GraphicCtor()
    if (
      typeof child.moveTo !== 'function' ||
      typeof child.lineTo !== 'function' ||
      typeof child.stroke !== 'function'
    ) {
      return null
    }

    graphic.addChild(child)
    return child
  } catch {
    return null
  }
}

const getStrokeOverlayCache = (
  graphic: StrokeOverlayHost
): StrokeOverlayCache | null => {
  if (graphic.__asyraStrokeOverlayCache) {
    return graphic.__asyraStrokeOverlayCache
  }

  const mask = createGraphicsChild(graphic)
  const inside = createGraphicsChild(graphic)
  const outside = createGraphicsChild(graphic)

  if (!mask || !inside || !outside) {
    return null
  }

  if (typeof inside.setMask === 'function') {
    inside.setMask({ mask })
  } else {
    inside.mask = mask
  }

  if (typeof outside.setMask === 'function') {
    outside.setMask({ mask, inverse: true })
  }

  const cache = { mask, inside, outside }
  graphic.__asyraStrokeOverlayCache = cache
  return cache
}

const resetOverlayGraphic = (graphic: StrokeDrawGraphic) => {
  graphic.clear?.()
  if ('visible' in graphic) {
    graphic.visible = true
  }
  if ('renderable' in graphic) {
    graphic.renderable = true
  }
}

const clearStrokeOverlayCache = (graphic: StrokeOverlayHost) => {
  const overlayCache = graphic.__asyraStrokeOverlayCache
  if (!overlayCache) {
    return
  }

  resetOverlayGraphic(overlayCache.mask)
  resetOverlayGraphic(overlayCache.inside)
  resetOverlayGraphic(overlayCache.outside)
}

const drawFillMask = (
  graphic: StrokeDrawGraphic,
  polylines: { points: Vec2[]; closed: boolean }[]
) => {
  const fill = graphic.fill
  if (typeof fill !== 'function') {
    return
  }

  polylines.forEach(({ points, closed }) => {
    if (!closed) {
      return
    }

    const normalized = normalizeClosedPoints(points)
    if (normalized.length < 3) {
      return
    }

    graphic.beginPath?.()
    drawPolyline(graphic, normalized, true)
    fill.call(graphic, 0xffffff)
  })
}

const getStrokeTargetGraphics = (
  graphic: StrokeDrawGraphic,
  overlayCache: StrokeOverlayCache | null,
  stroke: RenderableStroke,
  closed: boolean
): StrokeDrawGraphic[] => {
  if (!closed || !overlayCache) {
    return [graphic]
  }

  if (stroke.position === StrokePositions.INSIDE) {
    return [overlayCache.inside]
  }

  if (stroke.position === StrokePositions.CENTER) {
    return [overlayCache.inside, overlayCache.outside]
  }

  return [graphic]
}

const drawPolyline = (
  graphic: Pick<StrokeDrawGraphic, 'moveTo' | 'lineTo' | 'closePath'>,
  points: Vec2[],
  closed: boolean
) => {
  if (points.length < 2) {
    return
  }

  graphic.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i += 1) {
    graphic.lineTo(points[i].x, points[i].y)
  }

  if (closed) {
    graphic.closePath?.()
  }
}

export const renderPolylineStrokes = (
  graphic: StrokeDrawGraphic,
  polylines: { points: Vec2[]; closed: boolean }[],
  strokes: unknown
) => {
  const renderableStrokes = getRenderableStrokes(strokes)
  clearStrokeOverlayCache(graphic as StrokeOverlayHost)

  if (renderableStrokes.length === 0) {
    return
  }

  const needsMaskedOverlay =
    polylines.some((polyline) => polyline.closed) &&
    renderableStrokes.some(
      (stroke) => stroke.position !== StrokePositions.OUTSIDE
    )

  const overlayCache = needsMaskedOverlay
    ? getStrokeOverlayCache(graphic as StrokeOverlayHost)
    : null

  if (overlayCache) {
    resetOverlayGraphic(overlayCache.mask)
    resetOverlayGraphic(overlayCache.inside)
    resetOverlayGraphic(overlayCache.outside)
    drawFillMask(overlayCache.mask, polylines)
  }

  renderableStrokes.forEach((stroke) => {
    polylines.forEach(({ points, closed }) => {
      const strokePoints = closed ? normalizeClosedPoints(points) : [...points]
      if (strokePoints.length < 2) {
        return
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
      const validateIntersection =
        closed && stroke.position === StrokePositions.INSIDE

      const targetGraphics = getStrokeTargetGraphics(
        graphic,
        overlayCache,
        stroke,
        closed
      )

      if (stroke.style === StrokeStyles.DASHED) {
        const dashParts = buildDashedParts(strokePoints, closed, stroke)
        const dashedGeometries = dashParts.map((part) => {
          const renderPoints = buildDashedRenderPoints(
            part,
            centerlineOffset,
            validateIntersection
          )
          return {
            renderPoints,
            polygons: buildExactDashPartPolygons(
              part.clipPoints,
              renderPoints,
              stroke,
              {
                insideOrientation,
                contextStartIndex: part.clipStartIndex,
                contextPointCount: part.sourcePoints.length
              }
            )
          }
        })

        targetGraphics.forEach((targetGraphic) => {
          const strokePolygons = dashedGeometries.flatMap(
            ({ polygons }) => polygons
          )
          if (strokePolygons.length > 0) {
            const filled = fillStrokePolygons(
              targetGraphic,
              strokePolygons,
              stroke
            )
            if (filled) {
              return
            }
          }

          dashedGeometries.forEach(({ renderPoints, polygons }) => {
            if (polygons.length > 0) {
              beginStrokePath(targetGraphic)
              drawPolyline(targetGraphic, renderPoints, false)
              applyStrokeStyle(targetGraphic, stroke)
            }
          })
        })
        return
      }

      const renderPoints = offsetPolyline(
        strokePoints,
        centerlineOffset,
        closed,
        validateIntersection
      )
      targetGraphics.forEach((targetGraphic) => {
        beginStrokePath(targetGraphic)
        drawPolyline(targetGraphic, renderPoints, closed)
        applyStrokeStyle(targetGraphic, stroke)
      })
    })
  })
}

export const DEFAULT_RECTANGLE_STROKES: StrokeAttrs[] = []
export const DEFAULT_OVAL_STROKES: StrokeAttrs[] = []
export const DEFAULT_GROUP_STROKES: StrokeAttrs[] = []
export const DEFAULT_FRAME_STROKES = createDefaultStrokes({ color: '#000000' })
