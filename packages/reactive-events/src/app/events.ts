import { EventTypes } from '../types'

export interface StartTransactionEvent {
  type: EventTypes.START_TRANSACTION
}

export interface UpdateTransactionEvent {
  type: EventTypes.UPDATE_TRANSACTION
  eventName: string
  payload: any
}

export interface EndTransactionEvent {
  type: EventTypes.END_TRANSACTION
}

export type AppEvent =
  | StartTransactionEvent
  | UpdateTransactionEvent
  | EndTransactionEvent
