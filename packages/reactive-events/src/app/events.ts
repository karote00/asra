import { EVENT_OPTIONS, UNDO } from '@asyra/utils'
import type {
  RenderPointerPayload,
  RenderPointerCapturePayload,
  TransactionBoundaryPayload,
  TransactionStatusPayload
} from '@asyra/utils'
import type { EventTypes } from '../types.js'

export interface RenderIsReadyEvent {
  type: EventTypes
}

export interface FileLoadCompleteEvent {
  type: EventTypes
}

export interface StartTransactionEvent {
  type: EventTypes
}

export interface TransactionCanonicalRecordEvidence {
  readonly orderedIds: readonly string[]
  readonly payload: object
}

export interface TransactionCanonicalEvidence {
  readonly orderedIds: readonly string[]
  readonly sharedRecords?: readonly TransactionCanonicalRecordEvidence[]
}

export interface ReplaceLatestHistoryCandidate {
  readonly key: string
  readonly events: readonly UpdateTransactionEvent[]
  readonly eventKeys?: readonly string[]
}

export interface UpdateTransactionEvent {
  type: EventTypes
  eventName: string
  payload: unknown
  options?: EVENT_OPTIONS
  canonicalEvidence?: TransactionCanonicalEvidence
  historyCandidate?: ReplaceLatestHistoryCandidate
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

export interface RenderPointerEvent<TPayload> {
  type: EventTypes
  payload: TPayload
}

export type RenderPointerHoverEvent = RenderPointerEvent<RenderPointerPayload>
export type RenderPointerLeaveEvent = RenderPointerEvent<RenderPointerPayload>
export type RenderPointerDownEvent = RenderPointerEvent<RenderPointerPayload>
export type RenderPointerMoveEvent = RenderPointerEvent<RenderPointerPayload>
export type RenderPointerUpEvent = RenderPointerEvent<RenderPointerPayload>
export type RenderPointerCaptureStartEvent =
  RenderPointerEvent<RenderPointerCapturePayload>
export type RenderPointerCaptureEndEvent =
  RenderPointerEvent<RenderPointerCapturePayload>

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
