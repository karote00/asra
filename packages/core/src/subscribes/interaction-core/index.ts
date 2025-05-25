import { PositionData, PrimaryToolType } from '@asra/utils'
import { initPrimaryToolHandlers } from './primary-tool'
import { initCreateElementHandlers } from './create-element'
import { initUndoRedoHandlers } from './undoredo'
import { CoreAPIs, HandlerDeps } from '../../types'
import { initViewportHandlers } from './viewport'

export const initInteractionCoreHandlers = (
  deps: HandlerDeps,
  apis: CoreAPIs
) => {
  initPrimaryToolHandlers({
    switchPrimaryTool: (primaryTool: PrimaryToolType) =>
      apis.switchPrimaryTool(primaryTool)
  })

  initCreateElementHandlers(deps.render, {
    addRectangle: (pos: PositionData) => apis.addRectangle(pos)
  })

  initUndoRedoHandlers({
    undo: () => apis.undo(),
    redo: () => apis.redo()
  })

  initViewportHandlers({
    getViewportPosition: async () => await apis.getViewportPosition(),
    getViewportScale: async () => await apis.getViewportScale(),
    zoomFit: () => apis.zoomFit(),
    panTo: (x: number, y: number) => apis.panTo(x, y),
    zoomToCenter: (scale: number, centerX: number, centerY: number) =>
      apis.zoomToCenter(scale, centerX, centerY)
  })
}
