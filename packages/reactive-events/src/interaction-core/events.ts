import {
  SystemContextSnapshot,
  DetailType,
  PositionData,
  UNDO,
  EVENT_OPTIONS
} from '@asyra/utils'
import type { EventTypes } from '../types'

export interface ExecuteActionEvent {
  type: EventTypes
  payload: {
    eventName: string
    systemContextSnapshot: SystemContextSnapshot
    detail?: DetailType
  }
}

export interface StartSessionEvent {
  type: EventTypes
  payload: {
    eventName: string
    systemContextSnapshot: SystemContextSnapshot
    detail?: DetailType
  }
}

export interface UpdateSessionEvent {
  type: EventTypes
  payload: {
    eventName: string
    systemContextSnapshot: SystemContextSnapshot
    detail?: DetailType
  }
}

export interface EndSessionEvent {
  type: EventTypes
  payload: {
    eventName: string
    systemContextSnapshot: SystemContextSnapshot
    detail?: DetailType
  }
}

export interface DecideToStartTransactionEvent {
  type: EventTypes
}

export interface DecideToEndTransactionEvent {
  type: EventTypes
}

export interface DecideToCreateElementEvent {
  type: EventTypes
  payload: {
    position: PositionData
    elementType: string
  }
}

export interface DecideToResizeElementEvent {
  type: EventTypes
  payload: {
    dragStart: PositionData
    position: PositionData
    elementType: string
  }
  options: EVENT_OPTIONS
}

export interface DecideToEndResizeElementEvent {
  type: EventTypes
  payload: {
    position: PositionData
    elementType: string
  }
  options: EVENT_OPTIONS
}

export interface DecideToResetElementSizeEvent {
  type: EventTypes
  payload: {
    dimension: {
      width: number
      height: number
    }
    elementType: string
  }
}

export interface DecideToUndoRedoEvent {
  type: EventTypes
  payload: {
    undoredo: UNDO
  }
}

export type InteractionCoreEvents =
  | ExecuteActionEvent
  | StartSessionEvent
  | UpdateSessionEvent
  | EndSessionEvent
  | DecideToStartTransactionEvent
  | DecideToEndTransactionEvent
  | DecideToCreateElementEvent
  | DecideToResizeElementEvent
  | DecideToEndResizeElementEvent
  | DecideToResetElementSizeEvent
  | DecideToUndoRedoEvent
