import { UndoHandler } from './undo'
import { ViewportHandler } from './viewport'
import { CoreAPIs, HandlerDeps } from '../types'
import { RenderHandler } from './render'
import { CreateRectangleData, PrimaryToolType } from '@asra/utils'
import { SiwtchPrimaryToolHandler } from './tool'

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
    renderIsReady: () => apis.renderIsReady(),
    initRender: async (width: number, height: number, color: number) =>
      await apis.initRender(width, height, color),
    addRectangle: (data: CreateRectangleData) => apis.addRectangle(data)
  })

  new SiwtchPrimaryToolHandler(deps.inputSystem, {
    switchPrimaryTool: (tool: PrimaryToolType) => apis.switchPrimaryTool(tool)
  })
}
