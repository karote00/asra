import {
  panTo,
  requestViewportPosition,
  requestViewportScale,
  zoomFit,
  zoomToCenter
} from '@asra/reactive-events'
import { ViewportAPIs } from '../types/core-apis'

export const createViewportAPIs = (): ViewportAPIs => {
  return {
    async getViewportPosition() {
      return await requestViewportPosition()
    },
    async getViewportScale() {
      return requestViewportScale()
    },
    zoomFit() {
      const centerDiv = document.querySelector('#viewport-anchor')
      const uiBounds = centerDiv?.getBoundingClientRect()
      if (uiBounds) {
        zoomFit(uiBounds)
      }
    },
    panTo(x: number, y: number) {
      panTo(x, y)
    },
    zoomToCenter(scale: number, centerX: number, centerY: number) {
      zoomToCenter(scale, centerX, centerY)
    }
  }
}
