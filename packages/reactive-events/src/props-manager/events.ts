import type { PropertyComponentRawData } from '@asra/utils'
import { PropertyTypes } from '@asra/utils'
import type { EventTypes } from '../types'

export interface PropChangeCompleteEvent {
  type: EventTypes
  payload: {
    propertyIdsMap?: Record<PropertyTypes, string>
  }
}

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
  | PropChangeCompleteEvent
  | AddPropertyEvent
  | RemovePropertyEvent
  | UpdatePropertyEvent
