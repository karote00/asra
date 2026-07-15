import type { RenderElementData } from '../types'
import type { RenderGraphics } from './render-object'

export type RenderStrategy = (
  graphic: RenderGraphics,
  data: RenderElementData
) => void
