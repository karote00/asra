import {
  CreateRectangleData,
  KeySnapshot,
  MouseSnapshot,
  InputSystemEvents,
  DetailType
} from '@asra/utils'
import { UndoHandler } from './undo'
import { ViewportHandler } from './viewport'
import { RenderHandler } from './render'
import { PrimaryToolHandler } from './tool'
import { CoreAPIs, HandlerDeps } from '../../types'

export const initInputSystemHandlers = (deps: HandlerDeps, apis: CoreAPIs) => {
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
    addRectangle: (data: CreateRectangleData) => apis.addRectangle(data),
    updateMouseState: (mouseSnapshot: MouseSnapshot) =>
      apis.updateMouseState(mouseSnapshot),
    updateKeyState: (keySnapshot: KeySnapshot) =>
      apis.updateKeyState(keySnapshot),
    startSession: (eventName: InputSystemEvents, detail?: DetailType) =>
      apis.startSession(eventName, detail),
    updateSession: (eventName: InputSystemEvents, detail?: DetailType) =>
      apis.updateSession(eventName, detail),
    endSession: (eventName: InputSystemEvents, detail?: DetailType) =>
      apis.endSession(eventName, detail)
  })

  new PrimaryToolHandler(deps.inputSystem, {
    executeAction: (eventName: InputSystemEvents, detail?: DetailType) =>
      apis.executeAction(eventName, detail)
  })
}
