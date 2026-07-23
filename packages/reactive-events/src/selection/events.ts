import { EventTypes } from '../types'
import type { EVENT_OPTIONS } from '@asyra/utils'

export interface SelectionIdsEvent {
  type: EventTypes
  payload: {
    after: string[]
  }
  options?: EVENT_OPTIONS
}

export type SelectElementsEvent = SelectionIdsEvent
export type SelectVectorPointsEvent = SelectionIdsEvent
export type SelectVectorSegmentsEvent = SelectionIdsEvent

export type SelectionEvents =
  | SelectElementsEvent
  | SelectVectorPointsEvent
  | SelectVectorSegmentsEvent
