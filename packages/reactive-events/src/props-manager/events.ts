import type { PropertyComponentRawData } from '@asra/utils'
import type { EventTypes } from '../types'

export interface AddPropertyEvent {
  type: EventTypes
  payload: {
    data: Partial<PropertyComponentRawData>[]
  }
}

export interface RemovePropertyEvent {
  type: EventTypes
  payload: {
    data: Partial<PropertyComponentRawData>[]
  }
}

export interface UpdatePropertyEvent {
  type: EventTypes
  payload: {
    data: Partial<PropertyComponentRawData>
  }
}

export type PropEvents =
  | AddPropertyEvent
  | RemovePropertyEvent
  | UpdatePropertyEvent
