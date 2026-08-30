import type { PropertyComponentRawData } from '@asyra/utils'
import type { EVENT_OPTIONS } from '@asyra/utils'
import type { EventTypes } from '../types.js'

export interface PropertyCollectionEvent {
  type: EventTypes
  payload: {
    data: Partial<PropertyComponentRawData>[]
  }
  options?: EVENT_OPTIONS
}

export type AddPropertyEvent = PropertyCollectionEvent
export type RemovePropertyEvent = PropertyCollectionEvent

export interface UpdatePropertyEvent {
  type: EventTypes
  payload: {
    data: Partial<PropertyComponentRawData>
  }
  options?: EVENT_OPTIONS
}

export type PropEvents =
  AddPropertyEvent | RemovePropertyEvent | UpdatePropertyEvent
