import { PropertyTypes, PropertyComponentRawData } from '@asra/utils'
import type { EventTypes } from '../types'

export interface PropChangeCompleteEvent {
  type: EventTypes
  payload: {
    elementId: string
    propertyIdsMap?: Record<PropertyTypes, string>
  }
}

export interface AddPropertyEvent {
  type: EventTypes
  payload: {
    elementId: string
    data: Partial<PropertyComponentRawData>[]
  }
}

export type PropEvent = PropChangeCompleteEvent | AddPropertyEvent
