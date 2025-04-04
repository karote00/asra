import { Subscription } from 'rxjs'
import { filter } from 'rxjs/operators'
import type {
  FinishRequestElementSelectionEvent,
  RequestElementSelectionEvent
} from './events'
import { getEventBusObserve } from '../event-bus'
import { EventTypes } from '../types'

export const subscribeToRequestElementSelection = (
  subscriber: (event: RequestElementSelectionEvent) => void
): Subscription => {
  return getEventBusObserve()
    .pipe(
      filter(
        (event): event is RequestElementSelectionEvent =>
          event.type === EventTypes.REQUEST_ELEMENT_SELECTION
      )
    )
    .subscribe(subscriber)
}

export const subscribeToFinishRequestElementSelection = (
  subscriber: (event: FinishRequestElementSelectionEvent) => void
): Subscription => {
  return getEventBusObserve()
    .pipe(
      filter(
        (event): event is FinishRequestElementSelectionEvent =>
          event.type === EventTypes.FINISH_REQUEST_ELEMENT_SELECTION
      )
    )
    .subscribe(subscriber)
}
