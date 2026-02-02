import {
  requestRenderZoom,
  // subscribeToEmitZoomFit
} from '@asyra/reactive-events'
import RenderStore from '../stores/render'

const renderStore = new RenderStore()

let hasInit = false

export const initRenderDataSubscribe = () => {
  if (hasInit) {
    return
  }

  // subscribeToEmitZoomFit(async () => {
  //   const zoom = await requestRenderZoom()
  //   renderStore.updateZoom(zoom)
  // })

  hasInit = true
}
