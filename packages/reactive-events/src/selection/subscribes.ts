import { Subscription } from 'rxjs'
import { filter } from 'rxjs/operators'
import type { SelectElementsEvent } from './events'
import { getEventBusObserve } from '../event-bus'
import { EventTypes } from '../types'

export const subscribeToSelectElements = (
  subscriber: (event: SelectElementsEvent) => void
): Subscription => {
  return getEventBusObserve()
    .pipe(
      filter(
        (event): event is SelectElementsEvent =>
          event.type === EventTypes.SELECT_ELEMENTS
      )
    )
    .subscribe(subscriber)
}
