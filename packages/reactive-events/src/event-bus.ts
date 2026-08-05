import {
  Observable,
  Subscription,
  filter,
  share,
  UnaryFunction,
  OperatorFunction,
  ReplaySubject,
  type Observer
} from 'rxjs'
import { EventTypes } from './types.js'
import { AllEvent } from './constants.js'
import { acknowledgeTransactionReplayApplied } from './transaction-replay.js'

type ObserverEventBatchHandler = (events: readonly AllEvent[]) => void
interface ObserverEventBatchRegistration {
  readonly handler: ObserverEventBatchHandler
  active: boolean
}

const observerEventBatchRegistrations =
  new Set<ObserverEventBatchRegistration>()

const disposeObserverEventBatchRegistrations = (): void => {
  observerEventBatchRegistrations.forEach((registration) => {
    registration.active = false
  })
  observerEventBatchRegistrations.clear()
}

const notifyObserverEventBatch = (events: readonly AllEvent[]): void => {
  const registrations = [...observerEventBatchRegistrations]
  registrations.forEach((registration) => {
    if (!registration.active) return
    try {
      registration.handler(events)
    } catch {
      // Observer projections cannot invalidate an already-applied batch.
    }
  })
}

class OrderedBatchReplaySubject extends ReplaySubject<AllEvent> {
  constructor() {
    super(1)
  }

  override next(event: AllEvent): void {
    this.nextBatch([event])
  }

  nextBatch(sourceEvents: readonly AllEvent[]): void {
    if (sourceEvents.length === 0) return
    if (this.closed) {
      super.next(sourceEvents[0] as AllEvent)
      return
    }
    if (this.isStopped) return

    const events = Object.isFrozen(sourceEvents)
      ? sourceEvents
      : Object.freeze([...sourceEvents])
    const observerSnapshot = [...this.observers]
    // RxJS 7 caches this snapshot internally for one next(). Resetting the
    // same snapshot before each source event keeps one batch registry boundary
    // while retaining ReplaySubject buffering and public next() semantics.
    const subjectState = this as unknown as {
      currentObservers: Observer<AllEvent>[] | null
    }
    try {
      for (const event of events) {
        subjectState.currentObservers = observerSnapshot
        super.next(event)
      }
    } finally {
      subjectState.currentObservers = null
    }
    notifyObserverEventBatch(events)
  }

  override complete(): void {
    super.complete()
    disposeObserverEventBatchRegistrations()
  }

  override error(error: unknown): void {
    super.error(error)
    disposeObserverEventBatchRegistrations()
  }

  override unsubscribe(): void {
    super.unsubscribe()
    disposeObserverEventBatchRegistrations()
  }
}

const eventBus = new OrderedBatchReplaySubject()

type SynchronousEventHandler = (event: AllEvent) => unknown
type SynchronousEventBatchHandler = (events: readonly AllEvent[]) => unknown
const synchronousEventHandlers = new Map<
  AllEvent['type'],
  Set<SynchronousEventHandler>
>()
const synchronousEventBatchHandlers = new Map<
  AllEvent['type'],
  Set<SynchronousEventBatchHandler>
>()

export const publishEventsToObservers = (events: readonly AllEvent[]): void => {
  eventBus.nextBatch(events)
}

export const publishEventToObservers = (event: AllEvent): void =>
  publishEventsToObservers([event])

export const applyEventToSynchronousOwners = (event: AllEvent): boolean => {
  const handlers = synchronousEventHandlers.get(event.type)
  let applied = false
  if (handlers) {
    ;[...handlers].forEach((handler) => {
      const result = handler(event)
      if (result !== false) {
        applied = true
        acknowledgeTransactionReplayApplied()
      }
    })
  }
  return applied
}

export const hasSynchronousEventBatchHandler = (
  type: AllEvent['type']
): boolean => (synchronousEventBatchHandlers.get(type)?.size ?? 0) > 0

export const applyEventBatchToSynchronousOwners = (
  events: readonly AllEvent[]
): boolean => {
  const firstEvent = events[0]
  if (!firstEvent || events.some((event) => event.type !== firstEvent.type)) {
    return false
  }
  const handlers = synchronousEventBatchHandlers.get(firstEvent.type)
  let applied = false
  if (handlers) {
    ;[...handlers].forEach((handler) => {
      const result = handler(events)
      if (result !== false) {
        applied = true
        acknowledgeTransactionReplayApplied()
      }
    })
  }
  return applied
}

export const publishEvent = (event: AllEvent) => {
  const applied = applyEventToSynchronousOwners(event)
  publishEventToObservers(event)
  return applied
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

export const subscribeToSynchronousEventBatch = <T extends AllEvent>(
  type: T['type'],
  subscriber: (events: readonly T[]) => unknown
): Subscription => {
  const handler = subscriber as SynchronousEventBatchHandler
  const handlers = synchronousEventBatchHandlers.get(type) ?? new Set()
  handlers.add(handler)
  synchronousEventBatchHandlers.set(type, handlers)

  return new Subscription(() => {
    handlers.delete(handler)
    if (handlers.size === 0) {
      synchronousEventBatchHandlers.delete(type)
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

export const subscribeToEventBatches = (
  subscriber: ObserverEventBatchHandler
): Subscription => {
  if (eventBus.closed || eventBus.isStopped) {
    return new Subscription()
  }
  const registration: ObserverEventBatchRegistration = {
    handler: subscriber,
    active: true
  }
  observerEventBatchRegistrations.add(registration)
  return new Subscription(() => {
    registration.active = false
    observerEventBatchRegistrations.delete(registration)
  })
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
