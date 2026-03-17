import { Container, Graphics } from 'pixi.js'
import type { PositionData } from '@asyra/utils'
import type { RenderLayerRegistration } from '../types/render-layer'

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
  update: (canvas: OverlayCanvas) => void
}

export const createOverlayLayerRegistration = (
  options: CreateOverlayLayerOptions
): RenderLayerRegistration => {
  const layer = new Container()
  layer.label = options.name
  layer.eventMode = 'none'

  const graphics = new Graphics()
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
    bezierCurve: (from, control1, control2, to, stroke) => {
      graphics.moveTo(from.x, from.y)
      graphics.bezierCurveTo(
        control1.x,
        control1.y,
        control2.x,
        control2.y,
        to.x,
        to.y
      )
      if ('stroke' in graphics && typeof graphics.stroke === 'function') {
        graphics.stroke({
          width: stroke.width,
          color: stroke.color,
          cap: stroke.cap || 'round',
          join: stroke.join || 'round'
        })
      }
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
      options.update(canvas)
    }
  }
}
