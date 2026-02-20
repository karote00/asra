import render, { Render } from './render'
import { initDataContexts } from './subscribes'
import PixiJSRenderer from './pixi-renderer'

initDataContexts()

export { IRenderer, RenderOptions, RenderResult } from './types/renderer'
export { PixiJSRenderer }
export { renderRegistry } from './render-registry'
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

export default render
export { Render }
