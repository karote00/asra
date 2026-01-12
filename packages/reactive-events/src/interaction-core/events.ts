import {
  SystemContextSnapshot,
  InputSystemEvents,
  DetailType,
  PrimaryToolType,
  PositionData,
  UNDO,
  PanZoom,
  MouseSnapshot,
  EVENT_OPTIONS
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

export interface DecideToStartTransactionEvent {
  type: EventTypes
}

export interface DecideToEndTransactionEvent {
  type: EventTypes
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

export interface DecideToSelectElementsEvent {
  type: EventTypes
  payload: {
    elementIds: string[]
  }
}

export interface DecideToResizeElementEvent {
  type: EventTypes
  payload: {
    dragStart: PositionData
    position: PositionData
    elementType: PrimaryToolType
  }
  options: EVENT_OPTIONS
}

export interface DecideToEndResizeElementEvent {
  type: EventTypes
  payload: {
    position: PositionData
    elementType: PrimaryToolType
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
    elementType: PrimaryToolType
  }
}

export interface DecideToUndoRedoEvent {
  type: EventTypes
  payload: {
    undoredo: UNDO
  }
}

export interface DecideToZoomFitEvent {
  type: EventTypes
  payload: {
    zoom: number
  }
}

export interface DecideToPanZoomEvent {
  type: EventTypes
  payload: {
    panzoom: PanZoom
    mouse: MouseSnapshot['position']
    wheel: MouseSnapshot['delta']
  }
}

export type InteractionCoreEvents =
  | ExecuteActionEvent
  | StartSessionEvent
  | UpdateSessionEvent
  | EndSessionEvent
  | DecideToStartTransactionEvent
  | DecideToEndTransactionEvent
  | DecideToSwitchPrimaryToolEvent
  | DecideToCreateElementEvent
  | DecideToSelectElementsEvent
  | DecideToResizeElementEvent
  | DecideToEndResizeElementEvent
  | DecideToResetElementSizeEvent
  | DecideToUndoRedoEvent
  | DecideToZoomFitEvent
  | DecideToPanZoomEvent
