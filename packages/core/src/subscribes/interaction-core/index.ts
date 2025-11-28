import {
  DataTypes,
  DimensionData,
  PositionData,
  PrimaryToolType
} from '@asra/utils'
import { initPrimaryToolHandlers } from './primary-tool'
import { initCreateElementHandlers } from './create-element'
import { initUndoRedoHandlers } from './undoredo'
import { CoreAPIs, HandlerDeps } from '../../types'
import { initViewportHandlers } from './viewport'
import { initResizeElementHandlers } from './resize-element'
import { initResetElementSizeSubscriber } from './reset-element-size'

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

  initResizeElementHandlers(deps.render, {
    changeComputedData: (key: string, data: DataTypes) =>
      apis.changeComputedData(key, data),
    resizeElement: (pos: PositionData, dimension: DimensionData) =>
      apis.resizeElement(pos, dimension)
  })

  initResetElementSizeSubscriber({
    changeComputedData: (key: string, data: DataTypes) =>
      apis.changeComputedData(key, data)
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
