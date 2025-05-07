import { Render } from '@asra/render'
import { PositionData } from '@asra/utils'

export interface ViewportAPIs {
  getViewportPosition: () => PositionData
  getViewportScale: () => number
  zoomFit: () => void
  panTo: (x: number, y: number) => void
  zoomToCenter: (scale: number, centerX: number, centerY: number) => void
}

export const createViewportAPIs = (render: Render): ViewportAPIs => {
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
