import uiContext from '../ui-context'

export default class RenderStore {
  updateZoom(newZoom: number) {
    uiContext.updateZoom(newZoom)
  }
}
