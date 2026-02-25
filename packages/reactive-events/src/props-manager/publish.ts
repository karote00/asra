import { PropertyComponentRawData, EVENT_OPTIONS } from '@asyra/utils'
import { publishEvent } from '../event-bus'
import { EventTypes } from '../types'

export const addProperty = (
  data: Partial<PropertyComponentRawData>[],
  options?: EVENT_OPTIONS
) => {
  publishEvent({
    type: EventTypes.ADD_PROPERTY,
    payload: {
      data
    },
    options
  })
}

export const removeProperty = (
  data: Partial<PropertyComponentRawData>[],
  options?: EVENT_OPTIONS
) => {
  publishEvent({
    type: EventTypes.REMOVE_PROPERTY,
    payload: {
      data
    },
    options
  })
}

export const updateProperty = (
  data: Partial<PropertyComponentRawData>,
  options?: EVENT_OPTIONS
) => {
  publishEvent({
    type: EventTypes.UPDATE_PROPERTY,
    payload: {
      data
    },
    options
  })
}
