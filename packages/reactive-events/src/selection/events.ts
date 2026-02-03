import { EventTypes } from '../types'

export interface SelectElementsEvent {
  type: EventTypes
  payload: {
    after: string[]
  }
}

export type SelectionEvents = SelectElementsEvent
