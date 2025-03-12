import { UNDO } from '@asra/utils'
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
  payload: any & { undoable: UNDO }
}

export interface EndTransactionEvent {
  type: EventTypes
}

export interface UndoRedoStatusEvent {
  type: EventTypes
  status: UNDO
}

export type AppEvent =
  | RenderIsReadyEvent
  | FileLoadCompleteEvent
  | StartTransactionEvent
  | UpdateTransactionEvent
  | EndTransactionEvent
  | UndoRedoStatusEvent
