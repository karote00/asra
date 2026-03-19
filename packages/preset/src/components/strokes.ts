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
    }
  }
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

const offsetPolyline = (
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

const getStrokeCenterlineOffset = (
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

const extractPolylineSegment = (
  points: Vec2[],
  closed: boolean,
  startDistance: number,
  endDistance: number
): Vec2[] => {
  const { path, distances, totalLength } = buildSegmentDistances(points, closed)
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
  const parts: Vec2[][] = []
  let cursor = 0
  const cycleLength = dash + gap

  while (cursor < totalLength - EPS) {
    const part = extractPolylineSegment(
      points,
      closed,
      cursor,
      Math.min(totalLength, cursor + dash)
    )
    if (part.length >= 2) {
      parts.push(part)
    }
    cursor += cycleLength
  }

  return parts
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
        dashParts.forEach((part) => {
          const renderPoints = offsetPolyline(
            part,
            centerlineOffset,
            false,
            validateIntersection
          )
          targetGraphics.forEach((targetGraphic) => {
            beginStrokePath(targetGraphic)
            drawPolyline(targetGraphic, renderPoints, false)
            applyStrokeStyle(targetGraphic, stroke)
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
