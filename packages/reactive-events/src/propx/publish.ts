import { filter, firstValueFrom } from 'rxjs'
import { publishEvent, getEventBus } from '../event-bus'
import { EventTypes } from '../types'
import { PropChangeCompleteEvent } from './events'

export const addProperty = async (elementId: string, propNames: string[]) => {
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
      propNames
    }
  })

  const response = await firstValueFrom(response$)
  return response.payload.propertyIds
}

export const propChangeComplete = (
  elementId: string,
  propertyIds: string[]
) => {
  publishEvent({
    type: EventTypes.PROP_CHANGE_COMPLETE,
    payload: {
      elementId,
      propertyIds
    }
  })
}
