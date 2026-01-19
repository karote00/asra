import { renderIsReady } from '@asra/reactive-events'
import { RenderRawAPIs, RenderRequests } from '../types'

export const createRenderAPIs = (
  renderRequests: RenderRequests
): RenderRawAPIs => {
  return {
    renderIsReady() {
      renderIsReady()
    },
    async initRender(width: number, height: number, color: number) {
      return await renderRequests.initRender(width, height, color)
    }
  }
}
