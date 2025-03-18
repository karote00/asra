import { ReplaySubject, Observable, Subscription, filter, share } from 'rxjs'
import { EventTypes } from './types'
import type { AppEvent } from './app'
import type { SceneTreeEvents } from './scene-tree'
import type { SelectionEvent } from './selection'
import type { PropEvent } from './props-manager'

export type AllEvent = AppEvent | SceneTreeEvents | SelectionEvent | PropEvent

const eventBus = new ReplaySubject<AllEvent>(undefined, 5000)

export const publishEvent = (event: AllEvent) => {
  eventBus.next(event)
}

export const publishTransactCompleted = () => {
  publishEvent({ type: EventTypes.END_TRANSACTION })
}

export const subscribeToEvents = (
  subscriber: (event: AllEvent) => void
): Subscription => {
  return getEventBusObserve().subscribe(subscriber)
}

export const getEventBus = (): ReplaySubject<AllEvent> => eventBus
export const getEventBusObserve = (): Observable<AllEvent> =>
  eventBus.asObservable()

export const createEventStream = <T extends AllEvent>(
  eventType: EventTypes,
  reloadAction?: () => void
) => {
  const eventStream = getEventBusObserve().pipe(
    filter((event): event is T => event.type === eventType),
    share()
  )

  if (reloadAction) {
    eventStream.subscribe(() => reloadAction())
  }

  return eventStream
}
