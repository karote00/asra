import render, { Render } from './render'
import { initDataContexts } from './subscribes'
import PixiJSRenderer from './pixi-renderer'

initDataContexts()

export { IRenderer, RenderOptions, RenderResult } from './types/renderer'
export { PixiJSRenderer }
export { renderRegistry } from './render-registry'
export { RenderStrategy } from './types/render-strategy'
export {
  defaultStrategy,
  defaultRectangleStrategy
} from './strategies/default-strategy'

export default render
export { Render }
