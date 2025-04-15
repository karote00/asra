import { requestRenderZoom, subscribeToZoomFit } from '@asra/reactive-events'
import RenderStore from '../stores/render'

const renderStore = new RenderStore()

let hasInit = false

export const initRenderDataContext = () => {
  if (hasInit) {
    return
  }

  subscribeToZoomFit(async () => {
    const zoom = await requestRenderZoom()
    renderStore.updateZoom(zoom)
  })

  hasInit = true
}
