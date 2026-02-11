import {
  finishRequestRenderZoom,
  finishRequestViewportPosition,
  finishRequestViewportScale,
  subscribeToRequestRenderZoom,
  subscribeToRequestViewportPosition,
  subscribeToRequestViewportScale
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
