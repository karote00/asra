import {
  finishRequestRenderZoom,
  finishRequestViewportPosition,
  finishRequestViewportScale,
  // subscribeToPanTo,
  subscribeToRequestRenderZoom,
  subscribeToRequestViewportPosition,
  subscribeToRequestViewportScale,
  // subscribeToZoomFit,
  // subscribeToZoomToCenter
} from '@asyra/reactive-events'
import render from '../render'

let hasInit = false

export const initViewportContext = () => {
  if (hasInit) {
    return
  }

  subscribeToRequestRenderZoom(({ payload }) => {
    const zoom = render.getViewportScale()
    finishRequestRenderZoom(payload.requestId, zoom)
  })

  // subscribeToZoomFit(({ payload }) => {
  //   render.zoomFit(payload.rect)
  // })

  // subscribeToPanTo(({ payload }) => {
  //   const { x, y } = payload
  //   render.panTo(x, y)
  // })

  // subscribeToZoomToCenter(({ payload }) => {
  //   const { scale, centerX, centerY } = payload
  //   render.zoomToCenter(scale, centerX, centerY)
  // })

  subscribeToRequestViewportPosition(({ payload }) => {
    const viewportPosition = render.getViewportPosition()
    finishRequestViewportPosition(payload.requestId, {
      x: viewportPosition.x,
      y: viewportPosition.y
    })
  })

  subscribeToRequestViewportScale(({ payload }) => {
    const viewportScale = render.getViewportScale()
    finishRequestViewportScale(payload.requestId, viewportScale)
  })

  hasInit = true
}
