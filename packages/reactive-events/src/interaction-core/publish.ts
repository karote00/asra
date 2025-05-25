import {
  SystemContextSnapshot,
  InputSystemEvents,
  DetailType,
  PrimaryToolType,
  PositionData,
  UNDO
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

export const decideToSwitchPrimaryTool = (primaryTool: PrimaryToolType) => {
  publishEvent({
    type: EventTypes.DECIDE_TO_SWITCH_PRIMARY_TOOL,
    payload: {
      primaryTool
    }
  })
}

export const decideToCreateElement = (
  position: PositionData,
  elementType: PrimaryToolType
) => {
  publishEvent({
    type: EventTypes.DECIDE_TO_CREATE_ELEMENT,
    payload: {
      position,
      elementType
    }
  })
}

export const decideToUndoRedo = (undoredo: UNDO) => {
  publishEvent({
    type: EventTypes.DECIDE_TO_UNDOREDO,
    payload: {
      undoredo
    }
  })
}
