import type {
  ExecuteActionEvent,
  DecideToSwitchPrimaryToolEvent,
  StartSessionEvent,
  UpdateSessionEvent,
  EndSessionEvent,
  DecideToCreateElementEvent,
  DecideToUndoRedoEvent,
  DecideToZoomFitEvent,
  DecideToPanZoomEvent
} from './events'
import { createSubscribeEvent } from '../event-bus'
import { EventTypes } from '../types'

export const subscribeToExecuteAction =
  createSubscribeEvent<ExecuteActionEvent>(EventTypes.EXECUTE_ACTION)

export const subscribeToStartSession = createSubscribeEvent<StartSessionEvent>(
  EventTypes.START_SESSION
)

export const subscribeToUpdateSession =
  createSubscribeEvent<UpdateSessionEvent>(EventTypes.UPDATE_SESSION)

export const subscribeToEndSession = createSubscribeEvent<EndSessionEvent>(
  EventTypes.END_SESSION
)

export const subscribeToDecideToSwitchPrimaryTool =
  createSubscribeEvent<DecideToSwitchPrimaryToolEvent>(
    EventTypes.DECIDE_TO_SWITCH_PRIMARY_TOOL
  )

export const subscribeToDecideToCreateElement =
  createSubscribeEvent<DecideToCreateElementEvent>(
    EventTypes.DECIDE_TO_CREATE_ELEMENT
  )

export const subscribeToDecideToUndoRedo =
  createSubscribeEvent<DecideToUndoRedoEvent>(EventTypes.DECIDE_TO_UNDOREDO)

export const subscribeToDecideToZoomFit =
  createSubscribeEvent<DecideToZoomFitEvent>(EventTypes.DECIDE_TO_ZOOM_FIT)

export const subscribeToDecideToPanZoom =
  createSubscribeEvent<DecideToPanZoomEvent>(EventTypes.DECIDE_TO_PAN_ZOOM)
