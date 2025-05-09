import { initRender } from '@asra/reactive-events'
import { RenderAPIs } from '../types/core-apis'

export const createRenderAPIs = (): RenderAPIs => {
  return {
    async initRender(width: number, height: number, color: number) {
      return await initRender(width, height, color)
    }
  }
}
