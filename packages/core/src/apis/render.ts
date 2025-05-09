import { initRender, renderIsReady } from '@asra/reactive-events'
import { RenderAPIs } from '../types/core-apis'

export const createRenderAPIs = (): RenderAPIs => {
  return {
    renderIsReady() {
      renderIsReady()
    },
    async initRender(width: number, height: number, color: number) {
      return await initRender(width, height, color)
    }
  }
}
