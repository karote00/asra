import {
  SystemContextSnapshot,
  DetailType,
  PositionData,
  UNDO,
  EVENT_OPTIONS
} from '@asyra/utils'
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

export const decideToStartTransaction = () => {
  publishEvent({
    type: EventTypes.DECIDE_TO_START_TRANSACTION
  })
}

export const decideToEndTransaction = () => {
  publishEvent({
    type: EventTypes.DECIDE_TO_END_TRANSACTION
  })
}

export const decideToCreateElement = (
  position: PositionData,
  elementType: string
) => {
  publishEvent({
    type: EventTypes.DECIDE_TO_CREATE_ELEMENT,
    payload: {
      position,
      elementType
    }
  })
}

export const decideToSelectElements = (elementIds: string[]) => {
  publishEvent({
    type: EventTypes.DECIDE_TO_SELECT_ELEMENTS,
    payload: {
      elementIds
    }
  })
}

export const decideToResizeElement = (
  dragStart: PositionData,
  position: PositionData,
  elementType: string,
  options?: EVENT_OPTIONS
) => {
  publishEvent({
    type: EventTypes.DECIDE_TO_RESIZE_ELEMENT,
    payload: {
      dragStart,
      position,
      elementType
    },
    options
  })
}

export const decideToEndResizeElement = (
  position: PositionData,
  elementType: string
) => {
  publishEvent({
    type: EventTypes.DECIDE_TO_END_RESIZE_ELEMENT,
    payload: {
      position,
      elementType
    }
  })
}

export const decideToResetElementSize = (
  dimension: { width: number; height: number },
  elementType: string
) => {
  publishEvent({
    type: EventTypes.DECIDE_TO_RESET_ELEMENT_SIZE,
    payload: {
      dimension,
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
