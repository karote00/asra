import { renderIsReady } from '@asyra/reactive-events'
import type { ObservablePoint } from 'pixi.js'

export interface RenderRequests {
  initRender: (width: number, height: number, color: number) => Promise<unknown>
  getViewportPosition: () => ObservablePoint
  getViewportScale: () => number
}

export const createRenderAPIs = (requests: RenderRequests) => {
  return {
    renderIsReady() {
      renderIsReady()
    },
    async initRender(width: number, height: number, color: number) {
      return await requests.initRender(width, height, color)
    }
  }
}
