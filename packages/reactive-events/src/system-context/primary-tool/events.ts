import { EventTypes } from '../../types'

export interface RequestCurrentPrimaryToolEvent {
  type: EventTypes
  payload: {
    requestId: string
  }
}

export interface FinishRequestCurrentPrimaryToolEvent {
  type: EventTypes
  payload: {
    requestId: string
    tool: string
  }
}

export type PrimaryToolEvents =
  | RequestCurrentPrimaryToolEvent
  | FinishRequestCurrentPrimaryToolEvent
