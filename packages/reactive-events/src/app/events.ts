import { EVENT_OPTIONS, UNDO } from '@asyra/utils'
import type {
  RenderPointerPayload,
  RenderPointerCapturePayload,
  TransactionBoundaryPayload,
  TransactionStatusPayload
} from '@asyra/utils'
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
  payload: TransactionBoundaryPayload
}

export interface TransactionStatusChangedEvent {
  type: EventTypes
  payload: TransactionStatusPayload
}

export interface UserActionCompletedPayload {
  actionId: number
  changeCount: number
  timestamp: number
}

export interface UserActionCompletedEvent {
  type: EventTypes
  payload: UserActionCompletedPayload
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
  payload: RenderPointerPayload
}

export interface RenderPointerLeaveEvent {
  type: EventTypes
  payload: RenderPointerPayload
}

export interface RenderPointerDownEvent {
  type: EventTypes
  payload: RenderPointerPayload
}

export interface RenderPointerMoveEvent {
  type: EventTypes
  payload: RenderPointerPayload
}

export interface RenderPointerUpEvent {
  type: EventTypes
  payload: RenderPointerPayload
}

export interface RenderPointerCaptureStartEvent {
  type: EventTypes
  payload: RenderPointerCapturePayload
}

export interface RenderPointerCaptureEndEvent {
  type: EventTypes
  payload: RenderPointerCapturePayload
}

export type AppEvent =
  | RenderIsReadyEvent
  | FileLoadCompleteEvent
  | StartTransactionEvent
  | UpdateTransactionEvent
  | EndTransactionEvent
  | TransactionStatusChangedEvent
  | UserActionCompletedEvent
  | UpdateUndoRedoStatusEvent
  | UndoEvent
  | RedoEvent
  | RenderPointerHoverEvent
  | RenderPointerLeaveEvent
  | RenderPointerDownEvent
  | RenderPointerMoveEvent
  | RenderPointerUpEvent
  | RenderPointerCaptureStartEvent
  | RenderPointerCaptureEndEvent
