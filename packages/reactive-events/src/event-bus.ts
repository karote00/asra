import {
  ReplaySubject,
  Observable,
  Subscription,
  filter,
  share,
  UnaryFunction
} from 'rxjs'
import { EventTypes } from './types'
import { AllEvent } from './constants'

const eventBus = new ReplaySubject<AllEvent>(undefined, 5000)

export const publishEvent = (event: AllEvent) => {
  eventBus.next(event)
}

const DefaultOperator = <T extends AllEvent>(
  type: EventTypes
): UnaryFunction<Observable<any>, Observable<any>> =>
  filter((event: AllEvent): event is T => event.type === type)

export const createSubscribeEvent =
  <T extends AllEvent>(
    type: EventTypes,
    operators: [...UnaryFunction<Observable<any>, Observable<any>>[]] = [],
    defaultIndex = 0
  ) =>
  (subscriber: (event: T) => void): Subscription => {
    const pipeline = [...operators]
    pipeline.splice(defaultIndex, 0, DefaultOperator<T>(type))
    const final$ = pipeline.reduce(
      (obs, op) => obs.pipe(op),
      getEventBusObserve() as Observable<any>
    )
    return final$.subscribe(subscriber)
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
