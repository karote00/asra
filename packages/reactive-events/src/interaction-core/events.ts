import {
  SystemContextSnapshot,
  InputSystemEvents,
  DetailType,
  PrimaryToolType,
  PositionData
} from '@asra/utils'
import type { EventTypes } from '../types'

export interface ExecuteActionEvent {
  type: EventTypes
  payload: {
    eventName: InputSystemEvents
    systemContextSnapshot: SystemContextSnapshot
    detail?: DetailType
  }
}

export interface StartSessionEvent {
  type: EventTypes
  payload: {
    eventName: InputSystemEvents
    systemContextSnapshot: SystemContextSnapshot
    detail?: DetailType
  }
}

export interface UpdateSessionEvent {
  type: EventTypes
  payload: {
    eventName: InputSystemEvents
    systemContextSnapshot: SystemContextSnapshot
    detail?: DetailType
  }
}

export interface EndSessionEvent {
  type: EventTypes
  payload: {
    eventName: InputSystemEvents
    systemContextSnapshot: SystemContextSnapshot
    detail?: DetailType
  }
}

export interface DecideToSwitchPrimaryToolEvent {
  type: EventTypes
  payload: {
    primaryTool: PrimaryToolType
  }
}

export interface DecideToCreateElementEvent {
  type: EventTypes
  payload: {
    position: PositionData
    elementType: PrimaryToolType
  }
}

export type InteractionCoreEvents =
  | ExecuteActionEvent
  | StartSessionEvent
  | UpdateSessionEvent
  | EndSessionEvent
  | DecideToSwitchPrimaryToolEvent
  | DecideToCreateElementEvent
