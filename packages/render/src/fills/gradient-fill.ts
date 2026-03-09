import { FillGradient } from 'pixi.js'

export interface RenderGradientPoint {
  x: number
  y: number
}

export interface RenderGradientColorStop {
  offset: number
  color: string
}

export interface CreateRenderGradientFillOptions {
  type: 'linear' | 'radial'
  colorStops: RenderGradientColorStop[]
  textureSpace?: 'local' | 'global'
  start?: RenderGradientPoint
  end?: RenderGradientPoint
  center?: RenderGradientPoint
  outerCenter?: RenderGradientPoint
  innerRadius?: number
  outerRadius?: number
}

export interface RenderFillStyle {
  fill: unknown
}

export const createRenderGradientFillStyle = (
  options: CreateRenderGradientFillOptions
): RenderFillStyle => ({
  fill: new FillGradient(options)
})
