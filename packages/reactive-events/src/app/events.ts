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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any
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

export type AppEvent =
  | RenderIsReadyEvent
  | FileLoadCompleteEvent
  | StartTransactionEvent
  | UpdateTransactionEvent
  | EndTransactionEvent
  | UpdateUndoRedoStatusEvent
  | UndoEvent
  | RedoEvent
