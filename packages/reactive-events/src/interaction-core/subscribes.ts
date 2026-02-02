import {
  type ExecuteActionEvent,
  // type DecideToSwitchPrimaryToolEvent,
  type StartSessionEvent,
  type UpdateSessionEvent,
  type EndSessionEvent,
  type DecideToCreateElementEvent,
  type DecideToUndoRedoEvent,
  // type DecideToZoomFitEvent,
  // type DecideToPanZoomEvent,
  type DecideToResizeElementEvent,
  type DecideToEndResizeElementEvent,
  type DecideToResetElementSizeEvent,
  DecideToSelectElementsEvent,
  DecideToStartTransactionEvent,
  DecideToEndTransactionEvent
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

export const subscribeToDecideToStartTransaction =
  createSubscribeEvent<DecideToStartTransactionEvent>(
    EventTypes.DECIDE_TO_START_TRANSACTION
  )

export const subscribeToDecideToEndTransaction =
  createSubscribeEvent<DecideToEndTransactionEvent>(
    EventTypes.DECIDE_TO_END_TRANSACTION
  )

// export const subscribeToDecideToSwitchPrimaryTool =
//   createSubscribeEvent<DecideToSwitchPrimaryToolEvent>(
//     EventTypes.DECIDE_TO_SWITCH_PRIMARY_TOOL
//   )

export const subscribeToDecideToCreateElement =
  createSubscribeEvent<DecideToCreateElementEvent>(
    EventTypes.DECIDE_TO_CREATE_ELEMENT
  )

export const subscribeToDecideToSelectElements =
  createSubscribeEvent<DecideToSelectElementsEvent>(
    EventTypes.DECIDE_TO_SELECT_ELEMENTS
  )

export const subscribeToDecideToResizeElement =
  createSubscribeEvent<DecideToResizeElementEvent>(
    EventTypes.DECIDE_TO_RESIZE_ELEMENT
  )

export const subscribeToDecideToEndResizeElement =
  createSubscribeEvent<DecideToEndResizeElementEvent>(
    EventTypes.DECIDE_TO_END_RESIZE_ELEMENT
  )

export const subscribeToDecideToResetElementSize =
  createSubscribeEvent<DecideToResetElementSizeEvent>(
    EventTypes.DECIDE_TO_RESET_ELEMENT_SIZE
  )

export const subscribeToDecideToUndoRedo =
  createSubscribeEvent<DecideToUndoRedoEvent>(EventTypes.DECIDE_TO_UNDOREDO)

// export const subscribeToDecideToZoomFit =
//   createSubscribeEvent<DecideToZoomFitEvent>(EventTypes.DECIDE_TO_ZOOM_FIT)

// export const subscribeToDecideToPanZoom =
//   createSubscribeEvent<DecideToPanZoomEvent>(EventTypes.DECIDE_TO_PAN_ZOOM)
