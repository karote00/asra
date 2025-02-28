import { EventTypes } from '../types'

export interface SelectElementsEvent {
  type: EventTypes.SELECT_ELEMENTS
  payload: {
    after: string[]
  }
}

export type SelectionEvent = SelectElementsEvent
