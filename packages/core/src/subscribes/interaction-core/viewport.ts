import {
  subscribeToDecideToPanZoom,
  subscribeToDecideToZoomFit
} from '@asyra/reactive-events'
import { ViewportAPIs } from '../../types'
import { PanZoom, ZOOM_SMOOTH_RATIO } from '@asyra/utils'

export const initViewportHandlers = (apis: ViewportAPIs) => {
  subscribeToDecideToZoomFit(() => {
    apis.zoomFit()
  })

  subscribeToDecideToPanZoom(({ payload }) => {
    switch (payload.panzoom) {
      case PanZoom.PAN: {
        const { x, y } = payload.wheel
        const currentPosition = apis.getViewportPosition()
        apis.panTo(currentPosition.x - x, currentPosition.y - y)
        break
      }
      case PanZoom.ZOOM: {
        const { x: clientX, y: clientY } = payload.mouse
        const { y: deltaY } = payload.wheel
        const currentScale = apis.getViewportScale()
        // Adjust zoom scale based on wheel direction. deltaY < 0 means scrolling up (zoom in)
        // Using a smaller scale factor (1.05) for smoother zooming
        const newScale =
          currentScale *
          (deltaY < 0 ? 1 + ZOOM_SMOOTH_RATIO : 1 - ZOOM_SMOOTH_RATIO)
        apis.zoomToCenter(newScale, clientX, clientY)
        break
      }
    }
  })
}
