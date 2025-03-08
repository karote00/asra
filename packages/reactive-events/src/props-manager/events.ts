import { PropertyTypes } from '@asra/utils'
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
    propNames: PropertyTypes[]
  }
}

export type PropEvent = PropChangeCompleteEvent | AddPropertyEvent
