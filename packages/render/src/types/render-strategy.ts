import type { RenderElementData } from '../types'
import type { RenderGraphics } from './render-object'

export type RenderStrategyGraphic = Pick<
  RenderGraphics,
  | 'bezierCurveTo'
  | 'clear'
  | 'closePath'
  | 'ellipse'
  | 'fill'
  | 'hitArea'
  | 'lineTo'
  | 'moveTo'
  | 'rect'
  | 'renderable'
  | 'visible'
  | 'x'
  | 'y'
>

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
