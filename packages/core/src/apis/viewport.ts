// import {
//   emitZoomFit,
//   panTo,
//   zoomFit,
//   zoomToCenter
// } from '@asyra/reactive-events'
import { RenderRequests } from '../types'
import { ViewportAPIs } from '../types'

export const createViewportAPIs = (
  renderRequests: RenderRequests
): ViewportAPIs => {
  return {
    getViewportPosition() {
      return renderRequests.getViewportPosition()
    },
    getViewportScale() {
      return renderRequests.getViewportScale()
    }
    // zoomFit() {
    //   const centerDiv = document.querySelector('#viewport-anchor')
    //   const uiBounds = centerDiv?.getBoundingClientRect()
    //   if (uiBounds) {
    //     zoomFit(uiBounds)
    //     emitZoomFit()
    //   }
    // }
  }
}
