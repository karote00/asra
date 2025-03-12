import { filter, firstValueFrom } from 'rxjs'
import { publishEvent, getEventBus } from '../event-bus'
import { EventTypes } from '../types'
import { PropChangeCompleteEvent } from './events'
import { PropertyTypes, PropertyComponentRawData } from '@asra/utils'

export const addProperty = async (
  elementId: string,
  data: Partial<PropertyComponentRawData>[]
) => {
  const response$ = getEventBus().pipe(
    filter(
      (event): event is PropChangeCompleteEvent =>
        event.type === EventTypes.PROP_CHANGE_COMPLETE &&
        'payload' in event &&
        event.payload.elementId === elementId
    )
  )

  publishEvent({
    type: EventTypes.ADD_PROPERTY,
    payload: {
      elementId,
      data
    }
  })

  const response = await firstValueFrom(response$)
  return response.payload.propertyIdsMap
}

export const propChangeComplete = (
  elementId: string,
  propertyIdsMap: Record<PropertyTypes, string>
) => {
  publishEvent({
    type: EventTypes.PROP_CHANGE_COMPLETE,
    payload: {
      elementId,
      propertyIdsMap
    }
  })
}
