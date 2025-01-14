import { Subscription } from 'rxjs'
import { filter } from 'rxjs/operators'
import type { AddRectangleEvent } from './events'
import { getEventBusObserve } from '../event-bus'
import { EventTypes } from '../types'

export const subscribeToAddRectangle = (
  subscriber: (event: AddRectangleEvent) => void
): Subscription => {
  return getEventBusObserve()
    .pipe(
      filter(
        (event): event is AddRectangleEvent =>
          event.type === EventTypes.ADD_ELEMENT
      )
    )
    .subscribe(subscriber)
}
