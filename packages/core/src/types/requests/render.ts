import { Render } from '@asra/render'

/**
 * Request API for Render data
 * Provides synchronous access to render state
 */

export interface RenderRequests {
  initRender: (width: number, height: number, color: number) => Promise<any>
}

export interface RenderRequestDeps {
  render: Render
}
