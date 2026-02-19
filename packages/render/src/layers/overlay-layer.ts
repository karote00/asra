import { Container, Graphics } from 'pixi.js'
import type { PositionData } from '@asyra/utils'
import type { RenderLayerRegistration } from '../types/render-layer'

export interface OverlayStrokeStyle {
  width: number
  color: number
  cap?: 'round' | 'square' | 'butt'
  join?: 'round' | 'bevel' | 'miter'
}

export interface OverlayCanvas {
  clear: () => void
  line: (
    from: PositionData,
    to: PositionData,
    stroke: OverlayStrokeStyle
  ) => void
  circle: (
    center: PositionData,
    radius: number,
    fillColor: number,
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
    circle: (center, radius, fillColor, stroke) => {
      graphics.circle(center.x, center.y, radius).fill(fillColor)
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
