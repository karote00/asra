import { Subscription } from 'rxjs'
import { filter } from 'rxjs/operators'
import type {
  SceneTreeLoadCompleteEvent,
  AddElementEvent,
  RemoveElementEvent,
  UpdateComputedDataEvent,
  ChangeComputedDataEvent,
  FinishAddElementEvent
} from './events'
import { getEventBusObserve } from '../event-bus'
import { EventTypes } from '../types'

export const subscribeToSceneTreeLoadComplete = (
  subscriber: (event: SceneTreeLoadCompleteEvent) => void
): Subscription => {
  return getEventBusObserve()
    .pipe(
      filter(
        (event): event is SceneTreeLoadCompleteEvent =>
          event.type === EventTypes.SCENE_TREE_LOAD_COMPLETE
      )
    )
    .subscribe(subscriber)
}

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

export const subscribeToFinishAddElement = (
  subscriber: (event: FinishAddElementEvent) => void
): Subscription => {
  return getEventBusObserve()
    .pipe(
      filter(
        (event): event is FinishAddElementEvent =>
          event.type === EventTypes.FINISH_ADD_ELEMENT
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

export const subscribeToUpdateComputedData = (
  subscriber: (event: UpdateComputedDataEvent) => void
): Subscription => {
  return getEventBusObserve()
    .pipe(
      filter(
        (event): event is UpdateComputedDataEvent =>
          event.type === EventTypes.UPDATE_COMPUTED_DATA
      )
    )
    .subscribe(subscriber)
}

export const subscribeToChangeComputedData = (
  subscriber: (event: ChangeComputedDataEvent) => void
): Subscription => {
  return getEventBusObserve()
    .pipe(
      filter(
        (event): event is ChangeComputedDataEvent =>
          event.type === EventTypes.CHANGE_COMPUTED_DATA
      )
    )
    .subscribe(subscriber)
}
