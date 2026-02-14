import { EVENT_OPTIONS, UNDO } from '@asyra/utils'
import type { EventTypes } from '../types'

export interface RenderIsReadyEvent {
  type: EventTypes
}

export interface FileLoadCompleteEvent {
  type: EventTypes
}

export interface StartTransactionEvent {
  type: EventTypes
}

export interface UpdateTransactionEvent {
  type: EventTypes
  eventName: string
  payload: unknown
  options?: EVENT_OPTIONS
}

export interface EndTransactionEvent {
  type: EventTypes
}

export interface UpdateUndoRedoStatusEvent {
  type: EventTypes
  payload: {
    status: UNDO
  }
}

export interface UndoEvent {
  type: EventTypes
}

export interface RedoEvent {
  type: EventTypes
}

export interface RenderPointerHoverEvent {
  type: EventTypes
  payload: {
    elementId: string
  }
}

export interface RenderPointerLeaveEvent {
  type: EventTypes
  payload: {
    elementId: string
  }
}

export type AppEvent =
  | RenderIsReadyEvent
  | FileLoadCompleteEvent
  | StartTransactionEvent
  | UpdateTransactionEvent
  | EndTransactionEvent
  | UpdateUndoRedoStatusEvent
  | UndoEvent
  | RedoEvent
  | RenderPointerHoverEvent
  | RenderPointerLeaveEvent
