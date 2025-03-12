import { PropertyTypes, PropertyComponentRawData } from '@asra/utils'
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

export type PropEvent = PropChangeCompleteEvent | AddPropertyEvent
