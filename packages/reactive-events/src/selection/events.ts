import { EventTypes } from '../types'
import type { EVENT_OPTIONS } from '@asyra/utils'

export interface SelectElementsEvent {
  type: EventTypes
  payload: {
    after: string[]
  }
  options?: EVENT_OPTIONS
}

export type SelectionEvents = SelectElementsEvent
