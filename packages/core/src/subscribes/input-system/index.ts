import {
  KeySnapshot,
  MouseSnapshot,
  InputSystemEvents,
  DetailType
} from '@asra/utils'
import { UndoHandler } from './undo'
import { ViewportHandler } from './viewport'
import { RenderHandler } from './render'
import { PrimaryToolHandler } from './primary-tool'
import { CoreAPIs, HandlerDeps } from '../../types'

export const initInputSystemHandlers = (deps: HandlerDeps, apis: CoreAPIs) => {
  new UndoHandler(deps.inputSystem, {
    updateKeyState: (keySnapshot: KeySnapshot) =>
      apis.updateKeyState(keySnapshot),
    executeAction: (eventName: InputSystemEvents, detail?: DetailType) =>
      apis.executeAction(eventName, detail)
  })

  new ViewportHandler(deps.inputSystem, {
    updateMouseState: (mouseSnapshot: MouseSnapshot) =>
      apis.updateMouseState(mouseSnapshot),
    updateKeyState: (keySnapshot: KeySnapshot) =>
      apis.updateKeyState(keySnapshot),
    executeAction: (eventName: InputSystemEvents, detail?: DetailType) =>
      apis.executeAction(eventName, detail)
  })

  new RenderHandler(deps.inputSystem, {
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
