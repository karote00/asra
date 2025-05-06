import type { Core } from '../../core'
import { ViewportHandler } from './viewport-handler'

export const initAllHandlers = (core: Core) => {
  new ViewportHandler(core.inputSystem, {
    getViewportPosition: () => core.getViewportPosition(),
    getViewportScale: () => core.getViewportScale(),
    zoomFit: () => core.zoomFit(),
    panTo: (x: number, y: number) => core.panTo(x, y),
    zoomToCenter: (scale: number, centerX: number, centerY: number) =>
      core.zoomToCenter(scale, centerX, centerY)
  })
}
