import { KeySnapshot, MouseSnapshot, DetailType } from '@asyra/utils'
import { UndoHandler } from './undo'
import { ViewportHandler } from './viewport'
import { RenderHandler } from './render'
import { PrimaryToolHandler } from './primary-tool'
import { CoreAPIs, HandlerDeps } from '../../types'

export const initInputSystemHandlers = (deps: HandlerDeps, apis: CoreAPIs) => {
  new UndoHandler(deps.inputSystem, {
    updateKeyState: (keySnapshot: KeySnapshot) =>
      apis.updateKeyState(keySnapshot),
    executeAction: (eventName: string, detail?: DetailType) =>
      apis.executeAction(eventName, detail)
  })

  new ViewportHandler(deps.inputSystem, {
    updateMouseState: (mouseSnapshot: MouseSnapshot) =>
      apis.updateMouseState(mouseSnapshot),
    updateKeyState: (keySnapshot: KeySnapshot) =>
      apis.updateKeyState(keySnapshot),
    executeAction: (eventName: string, detail?: DetailType) =>
      apis.executeAction(eventName, detail)
  })

  new RenderHandler(deps.inputSystem, {
    updateMouseState: (mouseSnapshot: MouseSnapshot) =>
      apis.updateMouseState(mouseSnapshot),
    updateKeyState: (keySnapshot: KeySnapshot) =>
      apis.updateKeyState(keySnapshot),
    startSession: (eventName: string, detail?: DetailType) =>
      apis.startSession(eventName, detail),
    updateSession: (eventName: string, detail?: DetailType) =>
      apis.updateSession(eventName, detail),
    endSession: (eventName: string, detail?: DetailType) =>
      apis.endSession(eventName, detail)
  })

  new PrimaryToolHandler(deps.inputSystem, {
    executeAction: (eventName: string, detail?: DetailType) =>
      apis.executeAction(eventName, detail)
  })
}
