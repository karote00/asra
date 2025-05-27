import {
  Observable,
  Subscription,
  filter,
  share,
  UnaryFunction,
  ReplaySubject
} from 'rxjs'
import { EventTypes } from './types'
import { AllEvent } from './constants'

const eventBus = new ReplaySubject<AllEvent>(1)

export const publishEvent = (event: AllEvent) => {
  eventBus.next(event)
}

const DefaultOperator = <T extends AllEvent>(
  type: EventTypes
): UnaryFunction<Observable<T>, Observable<AllEvent>> => {
  return filter((event: AllEvent): event is T => event.type === type)
}

type AppOperatorFunction<T extends AllEvent> = UnaryFunction<
  Observable<T>,
  Observable<AllEvent>
>
export const createSubscribeEvent = <T extends AllEvent>(
  type: EventTypes,
  operators: [...AppOperatorFunction<T>[]] = [],
  defaultIndex = 0
) => {
  return (subscriber: (event: T) => void): Subscription => {
    const pipeline = [...operators]
    pipeline.splice(defaultIndex, 0, DefaultOperator<T>(type))

    const final$ = pipeline.reduce(
      (observer, op) => observer.pipe(op),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      getEventBusObserve() as Observable<any>
    )

    return final$.subscribe(subscriber)
  }
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
