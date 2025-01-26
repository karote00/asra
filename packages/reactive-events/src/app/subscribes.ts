import { Subscription } from 'rxjs'
import { filter } from 'rxjs/operators'
import type {
  StartTransactionEvent,
  UpdateTransactionEvent,
  EndTransactionEvent,
  UndoRedoStatusEvent
} from './events'
import { getEventBusObserve } from '../event-bus'
import { EventTypes } from '../types'

export const subscribeToStartTransaction = (
  subscriber: (event: StartTransactionEvent) => void
): Subscription => {
  return getEventBusObserve()
    .pipe(
      filter(
        (event): event is StartTransactionEvent =>
          event.type === EventTypes.START_TRANSACTION
      )
    )
    .subscribe(subscriber)
}

export const subscribeToUpdateTransaction = (
  subscriber: (event: UpdateTransactionEvent) => void
): Subscription => {
  return getEventBusObserve()
    .pipe(
      filter(
        (event): event is UpdateTransactionEvent =>
          event.type === EventTypes.UPDATE_TRANSACTION
      )
    )
    .subscribe(subscriber)
}

export const subscribeToEndTransaction = (
  subscriber: (event: EndTransactionEvent) => void
): Subscription => {
  return getEventBusObserve()
    .pipe(
      filter(
        (event): event is EndTransactionEvent =>
          event.type === EventTypes.END_TRANSACTION
      )
    )
    .subscribe(subscriber)
}

export const subscribeUndoRedoStatus = (
  subscriber: (event: UndoRedoStatusEvent) => void
): Subscription => {
  return getEventBusObserve()
    .pipe(
      filter(
        (event): event is UndoRedoStatusEvent =>
          event.type === EventTypes.UNDOREDO_STATUS
      )
    )
    .subscribe(subscriber)
}
