import {
  Observable,
  Subscription,
  filter,
  share,
  UnaryFunction,
  ReplaySubject,
  OperatorFunction
} from 'rxjs'
import { EventTypes } from './types'
import { AllEvent } from './constants'
import { acknowledgeTransactionReplayApplied } from './transaction-replay'

const eventBus = new ReplaySubject<AllEvent>(1)
type SynchronousEventHandler = (event: AllEvent) => unknown
const synchronousEventHandlers = new Map<
  AllEvent['type'],
  Set<SynchronousEventHandler>
>()

export const publishEventToObservers = (event: AllEvent) => {
  eventBus.next(event)
}

export const publishEvent = (event: AllEvent) => {
  const handlers = synchronousEventHandlers.get(event.type)
  if (handlers) {
    ;[...handlers].forEach((handler) => {
      const applied = handler(event)
      if (applied !== false) {
        acknowledgeTransactionReplayApplied()
      }
    })
  }
  publishEventToObservers(event)
}

export const subscribeToSynchronousEvent = <T extends AllEvent>(
  type: T['type'],
  subscriber: (event: T) => unknown
): Subscription => {
  const handler = subscriber as SynchronousEventHandler
  const handlers = synchronousEventHandlers.get(type) ?? new Set()
  handlers.add(handler)
  synchronousEventHandlers.set(type, handlers)

  return new Subscription(() => {
    handlers.delete(handler)
    if (handlers.size === 0) {
      synchronousEventHandlers.delete(type)
    }
  })
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

    // RxJS pipe chain has varying generic types (AllEvent -> T -> AllEvent); reduce cannot infer.
    // Isolated internal boundary: minimal any for accumulator compatibility.
    const initial$ = getEventBusObserve()
    const final$ = pipeline.reduce(
      (observer, op) =>
        observer.pipe(op as OperatorFunction<AllEvent, AllEvent>),
      initial$
    ) as Observable<T>

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

export const disposeEventBus = (): void => {
  eventBus.complete()
}

export const resetEventBus = (): void => {
  disposeEventBus()
}
