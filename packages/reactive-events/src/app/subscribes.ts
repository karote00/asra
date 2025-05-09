import { Subscription } from 'rxjs'
import { filter } from 'rxjs/operators'
import type {
  FileLoadCompleteEvent,
  StartTransactionEvent,
  UpdateTransactionEvent,
  EndTransactionEvent,
  UpdateUndoRedoStatusEvent,
  RenderIsReadyEvent,
  UndoEvent,
  RedoEvent
} from './events'
import { getEventBusObserve } from '../event-bus'
import { EventTypes } from '../types'

export const subscribeToRenderIsReady = (
  subscriber: (event: RenderIsReadyEvent) => void
): Subscription => {
  return getEventBusObserve()
    .pipe(
      filter(
        (event): event is RenderIsReadyEvent =>
          event.type === EventTypes.RENDER_IS_READY
      )
    )
    .subscribe(subscriber)
}

export const subscribeToFileLoadComplete = (
  subscriber: (event: FileLoadCompleteEvent) => void
): Subscription => {
  return getEventBusObserve()
    .pipe(
      filter(
        (event): event is FileLoadCompleteEvent =>
          event.type === EventTypes.FILE_LOAD_COMPLETE
      )
    )
    .subscribe(subscriber)
}

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

export const subscribeToUpdateUndoRedoStatus = (
  subscriber: (event: UpdateUndoRedoStatusEvent) => void
): Subscription => {
  return getEventBusObserve()
    .pipe(
      filter(
        (event): event is UpdateUndoRedoStatusEvent =>
          event.type === EventTypes.UNDOREDO_STATUS
      )
    )
    .subscribe(subscriber)
}

export const subscribeToUndo = (
  subscriber: (event: UndoEvent) => void
): Subscription => {
  return getEventBusObserve()
    .pipe(filter((event): event is UndoEvent => event.type === EventTypes.UNDO))
    .subscribe(subscriber)
}

export const subscribeToRedo = (
  subscriber: (event: RedoEvent) => void
): Subscription => {
  return getEventBusObserve()
    .pipe(filter((event): event is RedoEvent => event.type === EventTypes.REDO))
    .subscribe(subscriber)
}
