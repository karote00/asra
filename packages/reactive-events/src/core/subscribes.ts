import { Subscription } from 'rxjs'
import { filter } from 'rxjs/operators'
import type { CoreAddElementEvent } from './events'
import { getEventBusObserve } from '../event-bus'
import { EventTypes } from '../types'

export const subscribeToCoreAddElement = (
  subscriber: (event: CoreAddElementEvent) => void
): Subscription => {
  return getEventBusObserve()
    .pipe(
      filter(
        (event): event is CoreAddElementEvent =>
          event.type === EventTypes.CORE_ADD_ELEMENT
      )
    )
    .subscribe(subscriber)
}
