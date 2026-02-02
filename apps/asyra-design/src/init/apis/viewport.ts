/**
 * App-level viewport behaviors
 */

import { MouseSnapshot, PanZoom, ZOOM_SMOOTH_RATIO } from "@asyra/utils"
import { render } from "../../contexts"

export const viewportApis = {
  zoomFit: () => {
    const centerDiv = document.querySelector('#viewport-anchor')
    const uiBounds = centerDiv?.getBoundingClientRect()
    if (uiBounds) {
      render.zoomFit(uiBounds)
    }
  },
  pan: (x: number, y: number) => {
    const currentPosition = render.getViewportPosition()
    render.panTo(currentPosition.x - x, currentPosition.y - y)
  },
  zoomToCenter: (
    scale: number,
    clientX: number,
    clientY: number
  ) => {
    render.zoomToCenter(scale, clientX, clientY)
  },
  panZoom: (
    panzoom: PanZoom,
    mouse: MouseSnapshot['position'],
    wheel: MouseSnapshot['delta']
  ) => {
    switch (panzoom) {
      case PanZoom.PAN: {
        viewportApis.pan(wheel.x, wheel.y)
        break
      }
      case PanZoom.ZOOM: {
        const currentScale = render.getViewportScale()
        const newScale =
          currentScale *
          (wheel.y < 0 ? 1 + ZOOM_SMOOTH_RATIO : 1 - ZOOM_SMOOTH_RATIO)
        viewportApis.zoomToCenter(newScale, mouse.x, mouse.y)
        break
      }
    }
  }
}
