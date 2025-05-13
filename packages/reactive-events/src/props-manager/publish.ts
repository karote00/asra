import { publishEvent } from '../event-bus'
import { EventTypes } from '../types'
import { PropertyComponentRawData } from '@asra/utils'

export const addProperty = (data: Partial<PropertyComponentRawData>[]) => {
  publishEvent({
    type: EventTypes.ADD_PROPERTY,
    payload: {
      data
    }
  })
}

export const removeProperty = (data: Partial<PropertyComponentRawData>[]) => {
  publishEvent({
    type: EventTypes.REMOVE_PROPERTY,
    payload: {
      data
    }
  })
}

export const updateProperty = (data: Partial<PropertyComponentRawData>) => {
  publishEvent({
    type: EventTypes.UPDATE_PROPERTY,
    payload: {
      data
    }
  })
}
