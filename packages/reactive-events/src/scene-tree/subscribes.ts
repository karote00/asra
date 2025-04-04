import { Subscription } from 'rxjs'
import { filter } from 'rxjs/operators'
import type {
  SceneTreeLoadCompleteEvent,
  AddElementEvent,
  RemoveElementEvent,
  UpdateElementDataEvent,
  ChangeElementDataEvent
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

export const subscribeToUpdateElementData = (
  subscriber: (event: UpdateElementDataEvent) => void
): Subscription => {
  return getEventBusObserve()
    .pipe(
      filter(
        (event): event is UpdateElementDataEvent =>
          event.type === EventTypes.UPDATE_ELEMENT_DATA
      )
    )
    .subscribe(subscriber)
}

export const subscribeToChangeElementData = (
  subscriber: (event: ChangeElementDataEvent) => void
): Subscription => {
  return getEventBusObserve()
    .pipe(
      filter(
        (event): event is ChangeElementDataEvent =>
          event.type === EventTypes.CHANGE_ELEMENT_DATA
      )
    )
    .subscribe(subscriber)
}
