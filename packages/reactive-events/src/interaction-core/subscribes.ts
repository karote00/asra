import type {
  ExecuteActionEvent,
  DecideSwitchPrimaryToolEvent,
  StartSessionEvent,
  UpdateSessionEvent,
  EndSessionEvent
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

export const subscribeToDecideSwitchPrimaryTool =
  createSubscribeEvent<DecideSwitchPrimaryToolEvent>(
    EventTypes.DECIDE_SWITCH_PRIMARY_TOOL
  )
