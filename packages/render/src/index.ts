import render, { Render } from './render'
import PixiJSRenderer from './pixi-renderer'
import renderSceneTreeStore from './stores/scene-tree'
import renderSelectionStore from './stores/selection'

export { IRenderer, RenderOptions, RenderResult } from './types/renderer'
export { PixiJSRenderer }
export { renderStrategyRegistry } from './registries/render-strategy'
export { interactionHandlerRegistry } from './registries/interaction-handler'
export {
  createRenderGradientFillStyle,
  type CreateRenderGradientFillOptions,
  type RenderGradientColorStop,
  type RenderGradientPoint,
  type RenderFillStyle
} from './fills/gradient-fill'
export {
  createEvenOddFillStyle
} from './fills/even-odd-fill'
export type {
  EvenOddSegment,
  EvenOddPath,
  EvenOddShape,
  EvenOddFillOptions,
  EvenOddFillResult
} from './fills/even-odd-fill'
export type { RenderStrategy } from './types/render-strategy'
export {
  defaultStrategy,
  defaultRectangleStrategy
} from './strategies/default-strategy'
export {
  createOverlayLayerRegistration,
  type OverlayCanvas,
  type OverlayStrokeStyle,
  type CreateOverlayLayerOptions
} from './layers/overlay-layer'
export { renderSceneTreeStore, renderSelectionStore }

export default render
export { Render }
