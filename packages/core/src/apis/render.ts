import { initRender, renderIsReady } from '@asra/reactive-events'
import { RenderRawAPIs } from '../types'

export const createRenderAPIs = (): RenderRawAPIs => {
  return {
    renderIsReady() {
      renderIsReady()
    },
    async initRender(width: number, height: number, color: number) {
      return await initRender(width, height, color)
    }
  }
}
