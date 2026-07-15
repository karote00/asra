import type { RenderElementData } from '../types'
import type { RenderStrategy, RenderStrategyGraphic } from './render-strategy'

type Assert<T extends true> = T

interface LegacyPixiGraphicsLike extends RenderStrategyGraphic {
  readonly legacyPixiGraphicsBrand: 'legacy-pixi-graphics'
}

type LegacyAnnotatedStrategy = (
  graphic: LegacyPixiGraphicsLike,
  data: RenderElementData
) => void

type _RenderStrategyAcceptsLegacyAnnotatedGraphic = Assert<
  LegacyAnnotatedStrategy extends RenderStrategy ? true : false
>
