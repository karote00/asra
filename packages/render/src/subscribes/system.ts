import {
  finishInitRender,
  finishRequestRenderZoom,
  subscribeToInitRender,
  subscribeToRequestRenderZoom,
  subscribeToZoomFit
} from '@asra/reactive-events'
import render from '../render'

let hasInit = false

export const initSystemContext = () => {
  if (hasInit) {
    return
  }

  subscribeToInitRender(async ({ payload }) => {
    const { width, height, color } = payload
    const newApp = await render.init(width, height, color)
    finishInitRender(newApp)
  })

  subscribeToZoomFit(({ payload }) => {
    render.zoomFit(payload.rect)
  })

  subscribeToRequestRenderZoom(() => {
    const zoom = render.getScale()
    finishRequestRenderZoom(zoom)
  })

  hasInit = true
}
