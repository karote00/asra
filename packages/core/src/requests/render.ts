import { RenderRequestDeps, RenderRequests } from '../types'

/**
 * Request API for Render data
 * Provides synchronous access to render state with dependency injection
 */

let hasInitRender = false

export const createRenderRequests = (
  deps: RenderRequestDeps
): RenderRequests => ({
  initRender: async (
    width: number,
    height: number,
    color: number
  ): // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Promise<any> => {
    if (hasInitRender) {
      return
    }

    const app = await deps.render.init(width, height, color)
    hasInitRender = true

    return app
  }
})
