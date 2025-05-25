import {
  SystemContextSnapshot,
  InputSystemEvents,
  DetailType,
  PrimaryToolType,
  PositionData,
  UNDO,
  PanZoom,
  MouseSnapshot
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
  | DecideToSwitchPrimaryToolEvent
  | DecideToCreateElementEvent
  | DecideToUndoRedoEvent
  | DecideToZoomFitEvent
  | DecideToPanZoomEvent
