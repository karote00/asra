/**
 * Subscribers - Simple forwarding layer
 */

import {
  subscribeToDecideToPanZoom,
  subscribeToDecideToZoomFit
} from '../events'
import { viewportApis } from '../apis'

export const initViewportSubscribers = () => {
  subscribeToDecideToZoomFit(() => {
    viewportApis.zoomFit()
  })

  subscribeToDecideToPanZoom((payload) => {
    const { panzoom, wheel, mouse } = payload as any
    viewportApis.panZoom(panzoom, mouse, wheel)
  })
}
