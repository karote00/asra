import { Subscription } from 'rxjs'
import { filter } from 'rxjs/operators'
import type {
  AddPropertyEvent,
  PropChangeCompleteEvent,
  RemovePropertyEvent
} from './events'
import { getEventBusObserve } from '../event-bus'
import { EventTypes } from '../types'

export const subscribeToPropChangeComplete = (
  subscriber: (event: PropChangeCompleteEvent) => void
): Subscription => {
  return getEventBusObserve()
    .pipe(
      filter(
        (event): event is PropChangeCompleteEvent =>
          event.type === EventTypes.PROP_CHANGE_COMPLETE
      )
    )
    .subscribe(subscriber)
}

export const subscribeToAddProperty = (
  subscriber: (event: AddPropertyEvent) => void
): Subscription => {
  return getEventBusObserve()
    .pipe(
      filter(
        (event): event is AddPropertyEvent =>
          event.type === EventTypes.ADD_PROPERTY
      )
    )
    .subscribe(subscriber)
}

export const subscribeToRemoveProperty = (
  subscriber: (event: RemovePropertyEvent) => void
): Subscription => {
  return getEventBusObserve()
    .pipe(
      filter(
        (event): event is RemovePropertyEvent =>
          event.type === EventTypes.REMOVE_PROPERTY
      )
    )
    .subscribe(subscriber)
}
