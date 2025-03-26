import { Subscription } from 'rxjs'
import { filter } from 'rxjs/operators'
import type {
  SceneTreeLoadCompleteEvent,
  AddElementEvent,
  RemoveElementEvent,
  UpdateElementEvent,
  RequestSceneTreeDataEvent
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

export const subscribeToRequestSceneTreeData = (
  subscriber: (event: RequestSceneTreeDataEvent) => void
): Subscription => {
  return getEventBusObserve()
    .pipe(
      filter(
        (event): event is RequestSceneTreeDataEvent =>
          event.type === EventTypes.REQUEST_SCENE_TREE_DATA
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

export const subscribeToUpdateElement = (
  subscriber: (event: UpdateElementEvent) => void
): Subscription => {
  return getEventBusObserve()
    .pipe(
      filter(
        (event): event is UpdateElementEvent =>
          event.type === EventTypes.UPDATE_ELEMENT
      )
    )
    .subscribe(subscriber)
}
