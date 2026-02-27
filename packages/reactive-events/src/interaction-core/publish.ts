import { SystemContextSnapshot, DetailType } from '@asyra/utils'
import { publishEvent } from '../event-bus'
import { EventTypes } from '../types'

export const executeAction = (
  eventName: string,
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
  eventName: string,
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
  eventName: string,
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
  eventName: string,
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
