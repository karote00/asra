import render, { Render } from './render'
import { initDataContexts } from './subscribes'
import PixiJSRenderer from './pixi-renderer'

initDataContexts()

export { IRenderer, RenderOptions, RenderResult } from './types/renderer'
export { PixiJSRenderer }

export default render
export { Render }
