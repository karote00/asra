import { Subscription } from 'rxjs'
import { filter } from 'rxjs/operators'
import type { AddElementEvent, RemoveElementEvent } from './events'
import { getEventBusObserve } from '../event-bus'
import { EventTypes } from '../types'

export const subscribeToAddElement = (
  subscriber: (event: AddElementEvent) => void
): Subscription => {
  return getEventBusObserve()
    .pipe(
      filter(
        (event): event is AddElementEvent =>
          event.type === EventTypes.ADD_ELEMENT
      )
    )
    .subscribe(subscriber)
}

export const subscribeToRemoveElement = (
  subscriber: (event: RemoveElementEvent) => void
): Subscription => {
  return getEventBusObserve()
    .pipe(
      filter(
        (event): event is RemoveElementEvent =>
          event.type === EventTypes.REMOVE_ELEMENT
      )
    )
    .subscribe(subscriber)
}
