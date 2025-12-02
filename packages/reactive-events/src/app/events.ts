import { EVNET_OPTIONS, UNDO } from '@asra/utils'
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
  option?: EVNET_OPTIONS
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
