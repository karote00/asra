import type InputSystem from '@asra/input-system'
import { UndoHandler } from './undo-handler'
import { ViewportHandler } from './viewport-handler'
import { CoreAPIs } from '../../types/core-apis'

export const initAllHandlers = (inputSystem: InputSystem, apis: CoreAPIs) => {
  new UndoHandler(inputSystem, {
    undo: apis.undo,
    redo: apis.redo
  })

  new ViewportHandler(inputSystem, {
    getViewportPosition: () => apis.getViewportPosition(),
    getViewportScale: () => apis.getViewportScale(),
    zoomFit: () => apis.zoomFit(),
    panTo: (x: number, y: number) => apis.panTo(x, y),
    zoomToCenter: (scale: number, centerX: number, centerY: number) =>
      apis.zoomToCenter(scale, centerX, centerY)
  })
}
