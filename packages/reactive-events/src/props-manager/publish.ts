import { filter, firstValueFrom } from 'rxjs'
import { publishEvent, getEventBus } from '../event-bus'
import { EventTypes } from '../types'
import { PropChangeCompleteEvent } from './events'
import { PropertyTypes, PropertyComponentRawData } from '@asra/utils'

export const propChangeComplete = (
  propertyIdsMap: Record<PropertyTypes, string>
) => {
  publishEvent({
    type: EventTypes.PROP_CHANGE_COMPLETE,
    payload: {
      propertyIdsMap
    }
  })
}

export const addProperty = async (
  data: Partial<PropertyComponentRawData>[]
) => {
  const response$ = getEventBus().pipe(
    filter(
      (event): event is PropChangeCompleteEvent =>
        event.type === EventTypes.PROP_CHANGE_COMPLETE && 'payload' in event
    )
  )

  publishEvent({
    type: EventTypes.ADD_PROPERTY,
    payload: {
      data
    }
  })

  const response = await firstValueFrom(response$)
  return response.payload.propertyIdsMap
}

export const removeProperty = (data: Partial<PropertyComponentRawData>[]) => {
  publishEvent({
    type: EventTypes.REMOVE_PROPERTY,
    payload: {
      data
    }
  })
}
