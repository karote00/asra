import {
  requestRenderZoom,
  subscribeToEmitZoomFit
} from '@asra/reactive-events'
import RenderStore from '../stores/render'

const renderStore = new RenderStore()

let hasInit = false

export const initRenderDataContext = () => {
  if (hasInit) {
    return
  }

  subscribeToEmitZoomFit(async () => {
    const zoom = await requestRenderZoom()
    renderStore.updateZoom(zoom)
  })

  hasInit = true
}
