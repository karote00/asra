import type { EventTypes } from '../types'

export interface RequestElementSelectionEvent {
  type: EventTypes
}

export interface FinishRequestElementSelectionEvent {
  type: EventTypes
  payload: {
    elementSelection: string[]
  }
}

export type UIContextEvents =
  | RequestElementSelectionEvent
  | FinishRequestElementSelectionEvent
