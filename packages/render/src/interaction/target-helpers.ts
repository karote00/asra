import type { PositionData, RenderInteractionCaptureMode } from '@asyra/utils'
import type {
  RenderInteractionTarget,
  RenderInteractionTargetBounds,
  RenderInteractionTargetSpace
} from '../types/render-interaction'

interface BaseTargetOptions {
  id: string
  type: string
  zIndex?: number
  space?: RenderInteractionTargetSpace
  capture?: RenderInteractionCaptureMode
  meta?: Record<string, unknown>
}

export interface PointTargetOptions extends BaseTargetOptions {
  center: PositionData
  radius: number
}

export interface CircleTargetOptions extends BaseTargetOptions {
  center: PositionData
  radius: number
}

export interface SegmentTargetOptions extends BaseTargetOptions {
  start: PositionData
  end: PositionData
  hitRadius: number
}

export interface PolylineTargetOptions extends BaseTargetOptions {
  points: PositionData[]
  hitRadius: number
  closed?: boolean
}

const createBoundsForPoints = (
  points: PositionData[],
  padding = 0
): RenderInteractionTargetBounds => {
  const bounds = {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity
  }

  for (const point of points) {
    bounds.minX = Math.min(bounds.minX, point.x)
    bounds.minY = Math.min(bounds.minY, point.y)
    bounds.maxX = Math.max(bounds.maxX, point.x)
    bounds.maxY = Math.max(bounds.maxY, point.y)
  }

  if (padding) {
    bounds.minX -= padding
    bounds.minY -= padding
    bounds.maxX += padding
    bounds.maxY += padding
  }

  return bounds
}

const distanceSquared = (a: PositionData, b: PositionData) => {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return dx * dx + dy * dy
}

const distanceSquaredToSegment = (
  point: PositionData,
  start: PositionData,
  end: PositionData
) => {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSq = dx * dx + dy * dy
  if (lengthSq === 0) {
    return distanceSquared(point, start)
  }

  const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq
  const clamped = Math.max(0, Math.min(1, t))
  const proj = {
    x: start.x + clamped * dx,
    y: start.y + clamped * dy
  }

  return distanceSquared(point, proj)
}

export const createRenderInteractionPointTarget = (
  options: PointTargetOptions
): RenderInteractionTarget => {
  const radiusSquared = options.radius * options.radius
  const bounds = createBoundsForPoints([options.center], options.radius)

  return {
    id: options.id,
    type: options.type,
    zIndex: options.zIndex,
    space: options.space,
    bounds,
    capture: options.capture,
    meta: options.meta,
    hitTest: (point) => distanceSquared(point, options.center) <= radiusSquared
  }
}

export const createRenderInteractionCircleTarget = (
  options: CircleTargetOptions
): RenderInteractionTarget => {
  const radiusSquared = options.radius * options.radius
  const bounds = createBoundsForPoints([options.center], options.radius)

  return {
    id: options.id,
    type: options.type,
    zIndex: options.zIndex,
    space: options.space,
    bounds,
    capture: options.capture,
    meta: options.meta,
    hitTest: (point) => distanceSquared(point, options.center) <= radiusSquared
  }
}

export const createRenderInteractionSegmentTarget = (
  options: SegmentTargetOptions
): RenderInteractionTarget => {
  const radiusSquared = options.hitRadius * options.hitRadius
  const bounds = createBoundsForPoints(
    [options.start, options.end],
    options.hitRadius
  )

  return {
    id: options.id,
    type: options.type,
    zIndex: options.zIndex,
    space: options.space,
    bounds,
    capture: options.capture,
    meta: options.meta,
    hitTest: (point) =>
      distanceSquaredToSegment(point, options.start, options.end) <=
      radiusSquared
  }
}

export const createRenderInteractionPolylineTarget = (
  options: PolylineTargetOptions
): RenderInteractionTarget => {
  const points = options.points.slice()
  const closed = options.closed ?? false
  const radiusSquared = options.hitRadius * options.hitRadius
  const bounds = createBoundsForPoints(points, options.hitRadius)

  const segments: { start: PositionData; end: PositionData }[] = []
  for (let i = 0; i < points.length - 1; i += 1) {
    segments.push({ start: points[i], end: points[i + 1] })
  }
  if (closed && points.length > 2) {
    segments.push({ start: points[points.length - 1], end: points[0] })
  }

  return {
    id: options.id,
    type: options.type,
    zIndex: options.zIndex,
    space: options.space,
    bounds,
    capture: options.capture,
    meta: options.meta,
    hitTest: (point) => {
      for (const segment of segments) {
        const dist = distanceSquaredToSegment(point, segment.start, segment.end)
        if (dist <= radiusSquared) {
          return true
        }
      }
      return false
    }
  }
}
