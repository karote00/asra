import { EventTypes } from '../types'
import { filter, firstValueFrom } from 'rxjs'
import { getEventBus, publishEvent } from '../event-bus'
import { FinishRequestElementSelectionEvent } from './events'

export const requestElementSelection = async () => {
  const response$ = getEventBus().pipe(
    filter(
      (event): event is FinishRequestElementSelectionEvent =>
        event.type === EventTypes.FINISH_REQUEST_ELEMENT_SELECTION &&
        'payload' in event
    )
  )

  publishEvent({
    type: EventTypes.REQUEST_ELEMENT_SELECTION
  })

  const response = await firstValueFrom(response$)
  return response.payload.elementSelection
}

export const finishRequestElementSelection = (
  elementSelection: Set<string>
) => {
  publishEvent({
    type: EventTypes.FINISH_REQUEST_ELEMENT_SELECTION,
    payload: {
      elementSelection
    }
  })
}
