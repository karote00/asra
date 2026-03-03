import render, { Render } from './render'
import PixiJSRenderer from './pixi-renderer'
import renderSceneTreeStore from './stores/scene-tree'
import renderSelectionStore from './stores/selection'

export { IRenderer, RenderOptions, RenderResult } from './types/renderer'
export { PixiJSRenderer }
export { renderStrategyRegistry } from './render-strategy-registry'
export { interactionHandlerRegistry } from './interaction-handler-registry'
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
