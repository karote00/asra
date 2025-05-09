import { UndoHandler } from './undo-handler'
import { ViewportHandler } from './viewport-handler'
import { CoreAPIs, HandlerDeps } from '../../types/core-apis'
import { RenderHandler } from './render'
import { CreateRectangleData, PositionData } from '@asra/utils'

export const initAllHandlers = (deps: HandlerDeps, apis: CoreAPIs) => {
  new UndoHandler(deps.inputSystem, {
    undo: apis.undo,
    redo: apis.redo
  })

  new ViewportHandler(deps.inputSystem, {
    getViewportPosition: async () => await apis.getViewportPosition(),
    getViewportScale: async () => await apis.getViewportScale(),
    zoomFit: () => apis.zoomFit(),
    panTo: (x: number, y: number) => apis.panTo(x, y),
    zoomToCenter: (scale: number, centerX: number, centerY: number) =>
      apis.zoomToCenter(scale, centerX, centerY)
  })

  new RenderHandler(deps.inputSystem, deps.render, {
    initRender: async (width: number, height: number, color: number) =>
      await apis.initRender(width, height, color),
    addRectangle: (data: CreateRectangleData) => apis.addRectangle(data)
  })
}
