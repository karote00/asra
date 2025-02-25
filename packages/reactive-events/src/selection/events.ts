import { EventTypes } from '../types'

export interface SelectElementsEvent {
  type: EventTypes.SELECT_ELEMENTS
  elementIds: string[]
}

export type SelectionEvent = SelectElementsEvent
