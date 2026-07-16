import type { RenderElementData } from '../types'
import type { RenderGraphics } from './render-object'

/**
 * @deprecated Use `RenderGraphics`. This independent structural facade keeps
 * existing Pixi-annotated callbacks source-compatible without importing Pixi.
 */
export interface RenderStrategyGraphic {
  bezierCurveTo(
    controlPoint1X: number,
    controlPoint1Y: number,
    controlPoint2X: number,
    controlPoint2Y: number,
    destinationX: number,
    destinationY: number
  ): RenderStrategyGraphic
  clear(): RenderStrategyGraphic
  closePath(): RenderStrategyGraphic
  ellipse(
    x: number,
    y: number,
    radiusX: number,
    radiusY: number
  ): RenderStrategyGraphic
  fill(style: unknown): RenderStrategyGraphic
  lineTo(x: number, y: number): RenderStrategyGraphic
  moveTo(x: number, y: number): RenderStrategyGraphic
  rect(
    x: number,
    y: number,
    width: number,
    height: number
  ): RenderStrategyGraphic
  hitArea?: unknown
  renderable: boolean
  visible: boolean
  x: number
  y: number
}

export type EngineNeutralRenderStrategy = (
  graphic: RenderGraphics,
  data: RenderElementData
) => void

/**
 * @deprecated Use `EngineNeutralRenderStrategy`. This bivariant compatibility
 * signature keeps existing explicitly annotated Graphics-like callbacks
 * assignable during the migration window without importing a concrete SDK.
 */
export type RenderStrategy = {
  bivarianceHack(graphic: RenderStrategyGraphic, data: RenderElementData): void
}['bivarianceHack']
