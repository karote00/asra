import type { PropertyComponentRawData } from '@asyra/utils'
import type { EVENT_OPTIONS } from '@asyra/utils'
import type { EventTypes } from '../types'

export interface AddPropertyEvent {
  type: EventTypes
  payload: {
    data: Partial<PropertyComponentRawData>[]
  }
  options?: EVENT_OPTIONS
}

export interface RemovePropertyEvent {
  type: EventTypes
  payload: {
    data: Partial<PropertyComponentRawData>[]
  }
  options?: EVENT_OPTIONS
}

export interface UpdatePropertyEvent {
  type: EventTypes
  payload: {
    data: Partial<PropertyComponentRawData>
  }
  options?: EVENT_OPTIONS
}

export type PropEvents =
  | AddPropertyEvent
  | RemovePropertyEvent
  | UpdatePropertyEvent
