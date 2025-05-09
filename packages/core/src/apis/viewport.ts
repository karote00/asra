import { HandlerDeps, ViewportAPIs } from '../types/core-apis'

export const createViewportAPIs = (
  render: HandlerDeps['render']
): ViewportAPIs => {
  return {
    getViewportPosition() {
      return render.getPosition()
    },
    getViewportScale() {
      return render.getScale()
    },
    zoomFit() {
      const centerDiv = document.querySelector('#viewport-anchor')
      const uiBounds = centerDiv?.getBoundingClientRect()
      if (uiBounds) {
        render.zoomFit(uiBounds)
      }
    },
    panTo(x: number, y: number) {
      render.panTo(x, y)
    },
    zoomToCenter(scale: number, centerX: number, centerY: number) {
      render.zoomToCenter(scale, centerX, centerY)
    }
  }
}
