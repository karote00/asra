import {
  createRenderResourceStyle,
  type RenderResourceStyle
} from '../types/render-object'

export interface RenderGradientPoint {
  x: number
  y: number
}

export interface RenderGradientColorStop {
  offset: number
  color: string
}

export interface CreateRenderGradientFillOptions {
  type: 'linear' | 'radial' | 'angular' | 'diamond'
  colorStops: RenderGradientColorStop[]
  textureSpace?: 'local' | 'global'
  start?: RenderGradientPoint
  end?: RenderGradientPoint
  center?: RenderGradientPoint
  outerCenter?: RenderGradientPoint
  innerRadius?: number
  outerRadius?: number
  /** Secondary radius for elliptical radial gradients (perpendicular to primary axis). */
  radiusY?: number
  /** Rotation angle in radians for the radial gradient ellipse. */
  rotation?: number
}

export interface RenderFillStyle {
  fill: RenderResourceStyle
}

export const createRenderGradientFillStyle = (
  options: CreateRenderGradientFillOptions
): RenderFillStyle => ({
  fill: createRenderResourceStyle({
    kind: 'gradient',
    data: options
  }).style
})
