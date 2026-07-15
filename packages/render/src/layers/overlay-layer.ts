import type { PositionData } from '@asyra/utils'
import type { RenderLayerRegistration } from '../types/render-layer'
import { RenderContainer, RenderGraphics } from '../types/render-object'

const OVERLAY_BEZIER_FLATNESS_TOLERANCE = 0.35
const OVERLAY_BEZIER_MAX_SUBDIVISION_DEPTH = 10

export interface OverlayStrokeStyle {
  width: number
  color: number
  cap?: 'round' | 'square' | 'butt'
  join?: 'round' | 'bevel' | 'miter'
}

export interface OverlayFillStyle {
  color: number
  alpha?: number
}

type OverlayFill = number | OverlayFillStyle

export interface OverlayCanvas {
  clear: () => void
  line: (
    from: PositionData,
    to: PositionData,
    stroke: OverlayStrokeStyle
  ) => void
  polyline: (points: PositionData[], stroke: OverlayStrokeStyle) => void
  bezierCurve: (
    from: PositionData,
    control1: PositionData,
    control2: PositionData,
    to: PositionData,
    stroke: OverlayStrokeStyle
  ) => void
  circle: (
    center: PositionData,
    radius: number,
    fillColor: OverlayFill,
    stroke?: OverlayStrokeStyle
  ) => void
  polygon: (
    points: PositionData[],
    fillColor: OverlayFill,
    stroke?: OverlayStrokeStyle
  ) => void
}

export interface CreateOverlayLayerOptions {
  name: string
  zIndex?: number
  update: (canvas: OverlayCanvas) => boolean | undefined
}

const distancePointToLine = (
  p0: PositionData,
  p1: PositionData,
  point: PositionData
) => {
  const dx = p1.x - p0.x
  const dy = p1.y - p0.y
  const length = Math.hypot(dx, dy)
  if (length <= Number.EPSILON) {
    return Math.hypot(point.x - p0.x, point.y - p0.y)
  }

  return (
    Math.abs(dy * point.x - dx * point.y + p1.x * p0.y - p1.y * p0.x) / length
  )
}

const midpoint = (a: PositionData, b: PositionData): PositionData => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2
})

const isBezierFlatEnough = (
  from: PositionData,
  control1: PositionData,
  control2: PositionData,
  to: PositionData
) =>
  Math.max(
    distancePointToLine(from, to, control1),
    distancePointToLine(from, to, control2)
  ) <= OVERLAY_BEZIER_FLATNESS_TOLERANCE

const subdivideBezier = (
  from: PositionData,
  control1: PositionData,
  control2: PositionData,
  to: PositionData
) => {
  const p01 = midpoint(from, control1)
  const p12 = midpoint(control1, control2)
  const p23 = midpoint(control2, to)
  const p012 = midpoint(p01, p12)
  const p123 = midpoint(p12, p23)
  const splitPoint = midpoint(p012, p123)

  return {
    left: {
      from,
      control1: p01,
      control2: p012,
      to: splitPoint
    },
    right: {
      from: splitPoint,
      control1: p123,
      control2: p23,
      to
    }
  }
}

const collectBezierPolylinePoints = (
  from: PositionData,
  control1: PositionData,
  control2: PositionData,
  to: PositionData,
  depth: number,
  points: PositionData[]
) => {
  if (
    depth >= OVERLAY_BEZIER_MAX_SUBDIVISION_DEPTH ||
    isBezierFlatEnough(from, control1, control2, to)
  ) {
    points.push(to)
    return
  }

  const { left, right } = subdivideBezier(from, control1, control2, to)
  collectBezierPolylinePoints(
    left.from,
    left.control1,
    left.control2,
    left.to,
    depth + 1,
    points
  )
  collectBezierPolylinePoints(
    right.from,
    right.control1,
    right.control2,
    right.to,
    depth + 1,
    points
  )
}

export const sampleOverlayBezierPoints = (
  from: PositionData,
  control1: PositionData,
  control2: PositionData,
  to: PositionData
): PositionData[] => {
  const points: PositionData[] = [from]
  collectBezierPolylinePoints(from, control1, control2, to, 0, points)

  return points
}

export const createOverlayLayerRegistration = (
  options: CreateOverlayLayerOptions
): RenderLayerRegistration => {
  const layer = new RenderContainer()
  layer.label = options.name
  layer.eventMode = 'none'

  const graphics = new RenderGraphics()
  graphics.label = `${options.name}-graphics`
  graphics.eventMode = 'none'
  layer.addChild(graphics)

  const canvas: OverlayCanvas = {
    clear: () => {
      graphics.clear()
    },
    line: (from, to, stroke) => {
      graphics.moveTo(from.x, from.y)
      graphics.lineTo(to.x, to.y)
      if ('stroke' in graphics && typeof graphics.stroke === 'function') {
        graphics.stroke({
          width: stroke.width,
          color: stroke.color,
          cap: stroke.cap || 'round',
          join: stroke.join || 'round'
        })
      }
    },
    polyline: (points, stroke) => {
      if (points.length < 2) {
        return
      }
      graphics.moveTo(points[0].x, points[0].y)
      for (let i = 1; i < points.length; i += 1) {
        graphics.lineTo(points[i].x, points[i].y)
      }
      if ('stroke' in graphics && typeof graphics.stroke === 'function') {
        graphics.stroke({
          width: stroke.width,
          color: stroke.color,
          cap: stroke.cap || 'round',
          join: stroke.join || 'round'
        })
      }
    },
    bezierCurve: (from, control1, control2, to, stroke) => {
      const points = sampleOverlayBezierPoints(from, control1, control2, to)
      canvas.polyline(points, stroke)
    },
    circle: (center, radius, fillColor, stroke) => {
      graphics.circle(center.x, center.y, radius)
      if (typeof fillColor === 'number') {
        graphics.fill(fillColor)
      } else {
        graphics.fill({
          color: fillColor.color,
          alpha: fillColor.alpha
        })
      }
      if (
        stroke &&
        'stroke' in graphics &&
        typeof graphics.stroke === 'function'
      ) {
        graphics.stroke({
          width: stroke.width,
          color: stroke.color,
          cap: stroke.cap || 'round',
          join: stroke.join || 'round'
        })
      }
    },
    polygon: (points, fillColor, stroke) => {
      if (points.length < 3) {
        return
      }

      graphics.moveTo(points[0].x, points[0].y)
      for (let i = 1; i < points.length; i += 1) {
        graphics.lineTo(points[i].x, points[i].y)
      }
      graphics.closePath()
      if (typeof fillColor === 'number') {
        graphics.fill(fillColor)
      } else {
        graphics.fill({
          color: fillColor.color,
          alpha: fillColor.alpha
        })
      }
      if (
        stroke &&
        'stroke' in graphics &&
        typeof graphics.stroke === 'function'
      ) {
        graphics.stroke({
          width: stroke.width,
          color: stroke.color,
          cap: stroke.cap || 'round',
          join: stroke.join || 'round'
        })
      }
    }
  }

  return {
    name: options.name,
    layer,
    zIndex: options.zIndex,
    update: () => {
      return options.update(canvas)
    }
  }
}
