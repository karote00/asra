import type { RenderableStroke } from './renderable-stroke'
import type { StrokeOffsetCap } from './geometry-backend'
import {
  add,
  ROUND_STROKE_CAP_ARC_SAMPLING,
  buildRoundStrokeArcPointsBetween,
  dedupeClosed,
  distance,
  isSimpleClosedPolygon,
  normalize,
  polygonArea,
  scale,
  subtract,
  type Vec2
} from './solid-stroke-geometry-core'
import { getGeometryBackend } from './geometry-backend'

export interface DashedCenterRibbonFrame {
  point: Vec2
  tangent: Vec2
  sharpJoin?: boolean
}

export type DashedCenterRibbonValidityStatus =
  | 'simple-outline'
  | 'backend-offset'
  | 'fail-open-invalid-outline'
  | 'empty'

export interface DashedCenterRibbonGeometry {
  polygons: Vec2[][]
  validityStatus: DashedCenterRibbonValidityStatus
}

export interface DashedCenterRibbonGeometryOptions {
  allowRoundCapBackendOffset?: boolean
  disableBackendOffset?: boolean
  skipSimpleOutlineValidation?: boolean
  suppressStartCap?: boolean
  suppressEndCap?: boolean
}

const EPSILON = 1e-6
const MIN_POLYGON_AREA = 1e-4

const cross = (a: Vec2, b: Vec2) => a.x * b.y - a.y * b.x

const dot = (a: Vec2, b: Vec2) => a.x * b.x + a.y * b.y

const leftNormal = (tangent: Vec2) => ({ x: -tangent.y, y: tangent.x })

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
  if (Math.abs(denominator) <= EPSILON) {
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

const dedupeAdjacentPoints = (points: Vec2[]) => {
  const result: Vec2[] = []
  points.forEach((point) => {
    const previous = result[result.length - 1]
    if (!previous || distance(previous, point) > EPSILON) {
      result.push(point)
    }
  })
  return result
}

const simplifyRail = (points: Vec2[]) => {
  const deduped = dedupeAdjacentPoints(points)
  if (deduped.length <= 2) {
    return deduped
  }

  const simplified: Vec2[] = []
  deduped.forEach((point) => {
    const previous = simplified[simplified.length - 1]
    const beforePrevious = simplified[simplified.length - 2]
    if (!previous || !beforePrevious) {
      simplified.push(point)
      return
    }

    const previousDirection = normalize(subtract(previous, beforePrevious))
    const nextDirection = normalize(subtract(point, previous))
    if (
      previousDirection &&
      nextDirection &&
      Math.abs(cross(previousDirection, nextDirection)) <= EPSILON &&
      dot(previousDirection, nextDirection) > 0
    ) {
      simplified[simplified.length - 1] = point
      return
    }

    simplified.push(point)
  })

  return simplified
}

const getFrameTangent = (frames: DashedCenterRibbonFrame[], index: number) => {
  const tangent = normalize(frames[index].tangent)
  if (tangent) {
    return tangent
  }

  const previous = frames[index - 1]?.point
  const next = frames[index + 1]?.point
  if (previous && next) {
    return normalize(subtract(next, previous)) ?? { x: 1, y: 0 }
  }
  if (next) {
    return normalize(subtract(next, frames[index].point)) ?? { x: 1, y: 0 }
  }
  if (previous) {
    return normalize(subtract(frames[index].point, previous)) ?? { x: 1, y: 0 }
  }

  return { x: 1, y: 0 }
}

const getOffsetPoint = (point: Vec2, tangent: Vec2, offset: number) =>
  add(point, scale(leftNormal(tangent), offset))

const resolveMiterPoint = (
  previousPoint: Vec2,
  point: Vec2,
  nextPoint: Vec2,
  offset: number,
  stroke: Pick<RenderableStroke, 'miterLimit' | 'width'>
) => {
  const previousTangent = normalize(subtract(point, previousPoint))
  const nextTangent = normalize(subtract(nextPoint, point))
  if (!previousTangent || !nextTangent) {
    const defaultTangent = previousTangent ?? nextTangent ?? { x: 1, y: 0 }
    return getOffsetPoint(point, defaultTangent, offset)
  }

  const previousStart = getOffsetPoint(previousPoint, previousTangent, offset)
  const previousEnd = getOffsetPoint(point, previousTangent, offset)
  const nextStart = getOffsetPoint(point, nextTangent, offset)
  const nextEnd = getOffsetPoint(nextPoint, nextTangent, offset)
  const intersection = lineIntersection(
    previousStart,
    previousEnd,
    nextStart,
    nextEnd
  )
  if (!intersection) {
    return {
      x: (previousEnd.x + nextStart.x) / 2,
      y: (previousEnd.y + nextStart.y) / 2
    }
  }

  const maxDistance = stroke.miterLimit * (stroke.width / 2)
  if (distance(point, intersection) > maxDistance + EPSILON) {
    return {
      x: (previousEnd.x + nextStart.x) / 2,
      y: (previousEnd.y + nextStart.y) / 2
    }
  }

  return intersection
}

const resolveOffsetJoinPoint = (
  point: Vec2,
  previousTangent: Vec2,
  nextTangent: Vec2,
  offset: number
) => {
  const previousEnd = getOffsetPoint(point, previousTangent, offset)
  const nextStart = getOffsetPoint(point, nextTangent, offset)
  const intersection = lineIntersection(
    previousEnd,
    add(previousEnd, previousTangent),
    nextStart,
    add(nextStart, nextTangent)
  )

  return (
    intersection ?? {
      x: (previousEnd.x + nextStart.x) / 2,
      y: (previousEnd.y + nextStart.y) / 2
    }
  )
}

const buildArcPoints = (
  center: Vec2,
  start: Vec2,
  end: Vec2,
  sweepSign: number
) => {
  return buildRoundStrokeArcPointsBetween(center, start, end, sweepSign)
}

const buildRoundCapArcPoints = (
  center: Vec2,
  start: Vec2,
  end: Vec2,
  sweepSign: number
) =>
  buildRoundStrokeArcPointsBetween(
    center,
    start,
    end,
    sweepSign,
    2,
    ROUND_STROKE_CAP_ARC_SAMPLING
  )

const buildRibbonRails = (
  frames: DashedCenterRibbonFrame[],
  stroke: Pick<RenderableStroke, 'width' | 'join' | 'miterLimit'>
) => {
  const halfWidth = stroke.width / 2
  const left: Vec2[] = []
  const right: Vec2[] = []

  frames.forEach((frame, index) => {
    const previous = frames[index - 1]
    const next = frames[index + 1]
    const tangent = getFrameTangent(frames, index)

    if (frame.sharpJoin && previous && next) {
      const previousTangent =
        normalize(subtract(frame.point, previous.point)) ?? tangent
      const nextTangent =
        normalize(subtract(next.point, frame.point)) ?? tangent
      const turn = cross(previousTangent, nextTangent)
      const leftPrevious = getOffsetPoint(
        frame.point,
        previousTangent,
        halfWidth
      )
      const leftNext = getOffsetPoint(frame.point, nextTangent, halfWidth)
      const rightPrevious = getOffsetPoint(
        frame.point,
        previousTangent,
        -halfWidth
      )
      const rightNext = getOffsetPoint(frame.point, nextTangent, -halfWidth)
      const leftIsOuter = turn < 0
      const pushInner = (
        rail: Vec2[],
        previousTangent: Vec2,
        nextTangent: Vec2,
        offset: number
      ) => {
        rail.push(
          resolveOffsetJoinPoint(
            frame.point,
            previousTangent,
            nextTangent,
            offset
          )
        )
      }
      const pushOuter = (
        rail: Vec2[],
        previousPoint: Vec2,
        nextPoint: Vec2,
        offset: number
      ) => {
        if (stroke.join === 'bevel') {
          rail.push(previousPoint)
          rail.push(nextPoint)
          return
        }
        if (stroke.join === 'round') {
          rail.push(
            ...buildArcPoints(frame.point, previousPoint, nextPoint, turn)
          )
          return
        }

        rail.push(
          resolveMiterPoint(
            previous.point,
            frame.point,
            next.point,
            offset,
            stroke
          )
        )
      }

      if (leftIsOuter) {
        pushOuter(left, leftPrevious, leftNext, halfWidth)
        pushInner(right, previousTangent, nextTangent, -halfWidth)
        return
      }

      pushInner(left, previousTangent, nextTangent, halfWidth)
      pushOuter(right, rightPrevious, rightNext, -halfWidth)
      return
    }

    left.push(getOffsetPoint(frame.point, tangent, halfWidth))
    right.push(getOffsetPoint(frame.point, tangent, -halfWidth))
  })

  return {
    left: simplifyRail(left),
    right: simplifyRail(right)
  }
}

const applySquareCaps = (
  frames: DashedCenterRibbonFrame[],
  left: Vec2[],
  right: Vec2[],
  halfWidth: number,
  options: Pick<
    DashedCenterRibbonGeometryOptions,
    'suppressStartCap' | 'suppressEndCap'
  > = {}
) => {
  const startTangent = getFrameTangent(frames, 0)
  const endTangent = getFrameTangent(frames, frames.length - 1)
  const startShift = scale(startTangent, -halfWidth)
  const endShift = scale(endTangent, halfWidth)

  if (options.suppressStartCap !== true) {
    left[0] = add(left[0], startShift)
    right[0] = add(right[0], startShift)
  }
  if (options.suppressEndCap !== true) {
    left[left.length - 1] = add(left[left.length - 1], endShift)
    right[right.length - 1] = add(right[right.length - 1], endShift)
  }
}

const normalizeOutputPolygons = (polygons: Vec2[][]) =>
  polygons
    .map((polygon) => dedupeClosed(polygon))
    .filter(
      (polygon) =>
        polygon.length >= 3 && Math.abs(polygonArea(polygon)) > MIN_POLYGON_AREA
    )

const clipPolygonToEndpointHalfPlane = (
  polygon: Vec2[],
  endpoint: Vec2,
  tangent: Vec2,
  directionSign: 1 | -1
) => {
  if (polygon.length < 3) {
    return polygon
  }

  const signedDistance = (point: Vec2) =>
    ((point.x - endpoint.x) * tangent.x + (point.y - endpoint.y) * tangent.y) *
    directionSign
  const isInside = (point: Vec2) => signedDistance(point) >= -EPSILON
  const output: Vec2[] = []

  for (let currentIndex = 0; currentIndex < polygon.length; currentIndex += 1) {
    const current = polygon[currentIndex]
    const previous =
      polygon[(currentIndex - 1 + polygon.length) % polygon.length]
    const currentInside = isInside(current)
    const previousInside = isInside(previous)

    if (currentInside !== previousInside) {
      const previousDistance = signedDistance(previous)
      const currentDistance = signedDistance(current)
      const denominator = previousDistance - currentDistance
      if (Math.abs(denominator) > EPSILON) {
        const t = previousDistance / denominator
        output.push({
          x: previous.x + (current.x - previous.x) * t,
          y: previous.y + (current.y - previous.y) * t
        })
      }
    }

    if (currentInside) {
      output.push(current)
    }
  }

  return dedupeClosed(output)
}

const clipPolygonsToSuppressedEndpointCaps = (
  polygons: Vec2[][],
  frames: DashedCenterRibbonFrame[],
  options: Pick<
    DashedCenterRibbonGeometryOptions,
    'suppressStartCap' | 'suppressEndCap'
  >
) => {
  if (polygons.length === 0) {
    return polygons
  }

  const startEndpoint = frames[0]?.point
  const startTangent =
    options.suppressStartCap === true ? getFrameTangent(frames, 0) : null
  const endIndex = frames.length - 1
  const endEndpoint = frames[endIndex]?.point
  const endTangent =
    options.suppressEndCap === true ? getFrameTangent(frames, endIndex) : null

  if (!startEndpoint && !endEndpoint) {
    return polygons
  }

  return normalizeOutputPolygons(
    polygons.map((polygon) => {
      let clipped = polygon
      if (startEndpoint && startTangent) {
        clipped = clipPolygonToEndpointHalfPlane(
          clipped,
          startEndpoint,
          startTangent,
          1
        )
      }
      if (endEndpoint && endTangent) {
        clipped = clipPolygonToEndpointHalfPlane(
          clipped,
          endEndpoint,
          endTangent,
          -1
        )
      }
      return clipped
    })
  )
}

const toBackendCap = (cap: RenderableStroke['cap']): StrokeOffsetCap =>
  cap === 'none' ? 'butt' : cap

const buildBackendOffsetPolygons = (
  frames: DashedCenterRibbonFrame[],
  stroke: Pick<RenderableStroke, 'width' | 'join' | 'miterLimit' | 'cap'>,
  options: DashedCenterRibbonGeometryOptions = {}
) => {
  if (options.suppressStartCap === true || options.suppressEndCap === true) {
    return []
  }

  if (options.disableBackendOffset === true) {
    return []
  }

  if (stroke.cap === 'round' && options.allowRoundCapBackendOffset !== true) {
    return []
  }

  try {
    const backend = getGeometryBackend()
    if (backend.capabilities.offset !== true) {
      return []
    }

    const centerline = dedupeAdjacentPoints(frames.map((frame) => frame.point))
    if (centerline.length < 2) {
      return []
    }

    return normalizeOutputPolygons(
      backend
        .offset(centerline, stroke.width / 2, {
          width: stroke.width,
          join: stroke.join,
          cap: toBackendCap(stroke.cap),
          closed: false,
          miterLimit: stroke.miterLimit,
          fillRule: 'nonzero'
        })
        .flatMap((region) => region.polygons)
    )
  } catch {
    return []
  }
}

export const buildDashedCenterRibbonGeometry = (
  frames: DashedCenterRibbonFrame[],
  stroke: Pick<RenderableStroke, 'width' | 'join' | 'miterLimit' | 'cap'>,
  options: DashedCenterRibbonGeometryOptions = {}
): DashedCenterRibbonGeometry => {
  if (frames.length < 2 || stroke.width <= 0) {
    return { polygons: [], validityStatus: 'empty' }
  }

  const backendPolygons = buildBackendOffsetPolygons(frames, stroke, options)
  if (backendPolygons.length > 0) {
    return { polygons: backendPolygons, validityStatus: 'backend-offset' }
  }

  const { left, right } = buildRibbonRails(frames, stroke)
  if (left.length < 2 || right.length < 2) {
    return { polygons: [], validityStatus: 'empty' }
  }

  const halfWidth = stroke.width / 2
  if (stroke.cap === 'square') {
    applySquareCaps(frames, left, right, halfWidth, options)
  }

  const outline =
    stroke.cap === 'round'
      ? [
          ...left,
          ...(options.suppressEndCap === true
            ? [right[right.length - 1]]
            : buildRoundCapArcPoints(
                frames[frames.length - 1].point,
                left[left.length - 1],
                right[right.length - 1],
                -1
              ).slice(1)),
          ...[...right].reverse().slice(1),
          ...(options.suppressStartCap === true
            ? [left[0]]
            : buildRoundCapArcPoints(
                frames[0].point,
                right[0],
                left[0],
                -1
              ).slice(1))
        ]
      : [...left, ...[...right].reverse()]

  const polygon = dedupeClosed(outline)
  const outlinePolygons = clipPolygonsToSuppressedEndpointCaps(
    normalizeOutputPolygons([polygon]),
    frames,
    options
  )
  if (options.skipSimpleOutlineValidation === true) {
    return outlinePolygons.length > 0
      ? { polygons: outlinePolygons, validityStatus: 'simple-outline' }
      : { polygons: [], validityStatus: 'empty' }
  }

  if (
    outlinePolygons.length === 1 &&
    isSimpleClosedPolygon(outlinePolygons[0])
  ) {
    return { polygons: outlinePolygons, validityStatus: 'simple-outline' }
  }

  return outlinePolygons.length > 0
    ? {
        polygons: outlinePolygons,
        validityStatus: 'fail-open-invalid-outline'
      }
    : { polygons: [], validityStatus: 'empty' }
}

export const buildDashedCenterRibbonPolygons = (
  frames: DashedCenterRibbonFrame[],
  stroke: Pick<RenderableStroke, 'width' | 'join' | 'miterLimit' | 'cap'>
): Vec2[][] => buildDashedCenterRibbonGeometry(frames, stroke).polygons
