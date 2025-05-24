import {
  SystemContextSnapshot,
  InputSystemEvents,
  DetailType,
  PrimaryToolType
} from '@asra/utils'
import { publishEvent } from '../event-bus'
import { EventTypes } from '../types'

export const executeAction = (
  eventName: InputSystemEvents,
  systemContextSnapshot: SystemContextSnapshot,
  detail?: DetailType
) => {
  publishEvent({
    type: EventTypes.EXECUTE_ACTION,
    payload: {
      eventName,
      systemContextSnapshot,
      detail
    }
  })
}

export const startSession = (
  eventName: InputSystemEvents,
  systemContextSnapshot: SystemContextSnapshot,
  detail?: DetailType
) => {
  publishEvent({
    type: EventTypes.START_SESSION,
    payload: {
      eventName,
      systemContextSnapshot,
      detail
    }
  })
}

export const updateSession = (
  eventName: InputSystemEvents,
  systemContextSnapshot: SystemContextSnapshot,
  detail?: DetailType
) => {
  publishEvent({
    type: EventTypes.UPDATE_SESSION,
    payload: {
      eventName,
      systemContextSnapshot,
      detail
    }
  })
}

export const endSession = (
  eventName: InputSystemEvents,
  systemContextSnapshot: SystemContextSnapshot,
  detail?: DetailType
) => {
  publishEvent({
    type: EventTypes.END_SESSION,
    payload: {
      eventName,
      systemContextSnapshot,
      detail
    }
  })
}

export const decideSwitchPrimaryTool = (primaryTool: PrimaryToolType) => {
  publishEvent({
    type: EventTypes.DECIDE_SWITCH_PRIMARY_TOOL,
    payload: {
      primaryTool
    }
  })
}
