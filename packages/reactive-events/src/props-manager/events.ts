import type { EventTypes } from '../types'

export interface PropChangeCompleteEvent {
  type: EventTypes
  payload: {
    elementId: string
    propertyIds?: string[]
  }
}

export interface AddPropertyEvent {
  type: EventTypes
  payload: {
    elementId: string
    propNames: string[]
  }
}

export type PropEvent = PropChangeCompleteEvent | AddPropertyEvent
