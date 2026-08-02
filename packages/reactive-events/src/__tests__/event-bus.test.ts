import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  applyEventToSynchronousOwners,
  publishEvent,
  publishEventsToObservers,
  publishEventToObservers,
  createSubscribeEvent,
  subscribeToSynchronousEvent,
  subscribeToEventBatches,
  subscribeToEvents,
  getEventBus,
  createEventStream
} from '../event-bus'
import { EventTypes } from '../types'
import {
  acknowledgeTransactionReplayApplied,
  runInTransactionReplayMode,
  wasTransactionReplayApplied
} from '../transaction-replay'

// Mock event for testing
interface TestEvent {
  type: EventTypes
  payload: { message: string }
}

describe('Event Bus - Communication Backbone', () => {
  beforeEach(() => {
    // Clear any existing events
    const _eventBus = getEventBus()
    // Note: ReplaySubject doesn't have a clear method, but we can work with it
  })

  describe('publishEvent', () => {
    it('should demonstrate how events are published to the system', () => {
      // Demonstrates: How components publish events to communicate
      const mockSubscriber = vi.fn()

      // Subscribe to all events
      const subscription = subscribeToEvents(mockSubscriber)

      // Publish a test event
      const testEvent: TestEvent = {
        type: EventTypes.ADD_ELEMENT,
        payload: { message: 'Element created' }
      }

      publishEvent(testEvent)

      // Verify the event was received
      expect(mockSubscriber).toHaveBeenCalledWith(testEvent)

      subscription.unsubscribe()
    })

    it('returns the aggregate synchronous canonical apply result', () => {
      const noOp = subscribeToSynchronousEvent<TestEvent>(
        EventTypes.ADD_PROPERTY,
        () => false
      )
      let applied: ReturnType<typeof subscribeToSynchronousEvent> | undefined
      try {
        expect(
          publishEvent({
            type: EventTypes.ADD_PROPERTY,
            payload: { message: 'no-op' }
          })
        ).toBe(false)

        applied = subscribeToSynchronousEvent<TestEvent>(
          EventTypes.ADD_PROPERTY,
          () => true
        )

        expect(
          publishEvent({
            type: EventTypes.ADD_PROPERTY,
            payload: { message: 'applied' }
          })
        ).toBe(true)
      } finally {
        applied?.unsubscribe()
        noOp.unsubscribe()
      }
    })

    it('applies synchronous canonical owners without publishing observer evidence', () => {
      const synchronousSubscriber = vi.fn(() => true)
      const observerSubscriber = vi.fn()
      const synchronousSubscription = subscribeToSynchronousEvent<TestEvent>(
        EventTypes.ADD_PROPERTY,
        synchronousSubscriber
      )
      const observerSubscription = subscribeToEvents(observerSubscriber)
      observerSubscriber.mockClear()
      const event: TestEvent = {
        type: EventTypes.ADD_PROPERTY,
        payload: { message: 'canonical-only' }
      }

      try {
        expect(applyEventToSynchronousOwners(event)).toBe(true)
      } finally {
        synchronousSubscription.unsubscribe()
        observerSubscription.unsubscribe()
      }

      expect(synchronousSubscriber).toHaveBeenCalledOnce()
      expect(synchronousSubscriber).toHaveBeenCalledWith(event)
      expect(observerSubscriber).not.toHaveBeenCalled()
    })
  })

  describe('createSubscribeEvent', () => {
    it('should demonstrate typed event subscription for specific event types', () => {
      // Demonstrates: How components subscribe to specific event types
      const mockSubscriber = vi.fn()

      // Create a typed subscription for UNDO events (using a fresh event type)
      const subscribeToUndo = createSubscribeEvent<TestEvent>(EventTypes.UNDO)

      const subscription = subscribeToUndo(mockSubscriber)

      // Publish different types of events
      publishEvent({
        type: EventTypes.UNDO,
        payload: { message: 'This should be received' }
      })

      publishEvent({
        type: EventTypes.REDO,
        payload: { message: 'This should be filtered out' }
      })

      // Only UNDO events should be received
      expect(mockSubscriber).toHaveBeenCalledTimes(1)
      expect(mockSubscriber).toHaveBeenCalledWith({
        type: EventTypes.UNDO,
        payload: { message: 'This should be received' }
      })

      subscription.unsubscribe()
    })

    it('should handle multiple subscribers for the same event type', () => {
      // Demonstrates: Multiple components can listen to the same events
      const subscriber1 = vi.fn()
      const subscriber2 = vi.fn()

      const subscribeToSelect = createSubscribeEvent<TestEvent>(
        EventTypes.SELECT_ELEMENTS
      )

      const sub1 = subscribeToSelect(subscriber1)
      const sub2 = subscribeToSelect(subscriber2)

      const selectEvent: TestEvent = {
        type: EventTypes.SELECT_ELEMENTS,
        payload: { message: 'Elements selected' }
      }

      publishEvent(selectEvent)

      // Both subscribers should receive the event
      expect(subscriber1).toHaveBeenCalledWith(selectEvent)
      expect(subscriber2).toHaveBeenCalledWith(selectEvent)

      sub1.unsubscribe()
      sub2.unsubscribe()
    })

    it('synchronously surfaces a typed state-owner apply failure', () => {
      const applyFailure = new Error('state apply failed')
      const subscription = subscribeToSynchronousEvent<TestEvent>(
        EventTypes.UPDATE_COMPUTED_DATA,
        () => {
          throw applyFailure
        }
      )

      try {
        expect(() =>
          publishEvent({
            type: EventTypes.UPDATE_COMPUTED_DATA,
            payload: { message: 'apply' }
          })
        ).toThrow(applyFailure)
      } finally {
        subscription.unsubscribe()
      }
    })

    it('distinguishes pre-apply replay failure from applied-then-failed', () => {
      const preApplyFailure = new Error('failed before apply')
      const preApplySubscription = subscribeToSynchronousEvent<TestEvent>(
        EventTypes.UPDATE_COMPUTED_DATA,
        () => {
          throw preApplyFailure
        }
      )

      try {
        expect(() =>
          runInTransactionReplayMode('undo', () =>
            publishEvent({
              type: EventTypes.UPDATE_COMPUTED_DATA,
              payload: { message: 'pre-apply' }
            })
          )
        ).toThrow(preApplyFailure)
        expect(wasTransactionReplayApplied(preApplyFailure)).toBe(false)
      } finally {
        preApplySubscription.unsubscribe()
      }

      const appliedFailure = new Error('failed after apply')
      const appliedSubscription = subscribeToSynchronousEvent<TestEvent>(
        EventTypes.UPDATE_COMPUTED_DATA,
        () => {
          acknowledgeTransactionReplayApplied()
          throw appliedFailure
        }
      )

      try {
        expect(() =>
          runInTransactionReplayMode('undo', () =>
            publishEvent({
              type: EventTypes.UPDATE_COMPUTED_DATA,
              payload: { message: 'applied' }
            })
          )
        ).toThrow(appliedFailure)
        expect(wasTransactionReplayApplied(appliedFailure)).toBe(true)
      } finally {
        appliedSubscription.unsubscribe()
      }
    })

    it('does not acknowledge a synchronous handler that reports a semantic no-op', () => {
      const cleanupFailure = new Error('cleanup failed after no-op')
      const noOpSubscription = subscribeToSynchronousEvent<TestEvent>(
        EventTypes.UPDATE_COMPUTED_DATA,
        () => false
      )
      const failingSubscription = subscribeToSynchronousEvent<TestEvent>(
        EventTypes.UPDATE_COMPUTED_DATA,
        () => {
          throw cleanupFailure
        }
      )

      try {
        expect(() =>
          runInTransactionReplayMode('undo', () =>
            publishEvent({
              type: EventTypes.UPDATE_COMPUTED_DATA,
              payload: { message: 'no-op' }
            })
          )
        ).toThrow(cleanupFailure)
        expect(wasTransactionReplayApplied(cleanupFailure)).toBe(false)
      } finally {
        noOpSubscription.unsubscribe()
        failingSubscription.unsubscribe()
      }
    })

    it('does not reuse applied acknowledgement for the same error in a later replay', () => {
      const reusedFailure = new Error('reused failure')
      const appliedSubscription = subscribeToSynchronousEvent<TestEvent>(
        EventTypes.UPDATE_COMPUTED_DATA,
        () => {
          acknowledgeTransactionReplayApplied()
          throw reusedFailure
        }
      )

      try {
        expect(() =>
          runInTransactionReplayMode('undo', () =>
            publishEvent({
              type: EventTypes.UPDATE_COMPUTED_DATA,
              payload: { message: 'applied first' }
            })
          )
        ).toThrow(reusedFailure)
        expect(wasTransactionReplayApplied(reusedFailure)).toBe(true)
      } finally {
        appliedSubscription.unsubscribe()
      }

      const preApplySubscription = subscribeToSynchronousEvent<TestEvent>(
        EventTypes.UPDATE_COMPUTED_DATA,
        () => {
          throw reusedFailure
        }
      )

      try {
        expect(() =>
          runInTransactionReplayMode('undo', () =>
            publishEvent({
              type: EventTypes.UPDATE_COMPUTED_DATA,
              payload: { message: 'pre-apply later' }
            })
          )
        ).toThrow(reusedFailure)
        expect(wasTransactionReplayApplied(reusedFailure)).toBe(false)
      } finally {
        preApplySubscription.unsubscribe()
      }
    })

    it('preserves applied acknowledgement when a replay throws a primitive value', () => {
      const primitiveFailure: unknown = 'primitive replay failure'
      const appliedSubscription = subscribeToSynchronousEvent<TestEvent>(
        EventTypes.UPDATE_COMPUTED_DATA,
        () => {
          acknowledgeTransactionReplayApplied()
          throw primitiveFailure
        }
      )

      let capturedFailure: unknown
      try {
        runInTransactionReplayMode('undo', () =>
          publishEvent({
            type: EventTypes.UPDATE_COMPUTED_DATA,
            payload: { message: 'primitive applied failure' }
          })
        )
      } catch (failure) {
        capturedFailure = failure
      } finally {
        appliedSubscription.unsubscribe()
      }

      expect(capturedFailure).toBe(primitiveFailure)
      expect(wasTransactionReplayApplied(capturedFailure)).toBe(true)

      const preApplySubscription = subscribeToSynchronousEvent<TestEvent>(
        EventTypes.UPDATE_COMPUTED_DATA,
        () => {
          throw primitiveFailure
        }
      )
      capturedFailure = undefined
      try {
        runInTransactionReplayMode('undo', () =>
          publishEvent({
            type: EventTypes.UPDATE_COMPUTED_DATA,
            payload: { message: 'primitive pre-apply failure' }
          })
        )
      } catch (failure) {
        capturedFailure = failure
      } finally {
        preApplySubscription.unsubscribe()
      }

      expect(capturedFailure).toBe(primitiveFailure)
      expect(wasTransactionReplayApplied(capturedFailure)).toBe(false)
    })

    it('publishes handled replay to ordinary observers without reapplying synchronous state owners', () => {
      const synchronousSubscriber = vi.fn()
      const observer = vi.fn()
      const synchronousSubscription = subscribeToSynchronousEvent<TestEvent>(
        EventTypes.SELECT_ELEMENTS,
        synchronousSubscriber
      )
      const observerSubscription = subscribeToEvents(observer)
      observer.mockClear()
      const event: TestEvent = {
        type: EventTypes.SELECT_ELEMENTS,
        payload: { message: 'instance-owned replay' }
      }

      publishEventToObservers(event)

      expect(synchronousSubscriber).not.toHaveBeenCalled()
      expect(observer).toHaveBeenCalledWith(event)
      synchronousSubscription.unsubscribe()
      observerSubscription.unsubscribe()
    })

    it('publishes ordered compatibility evidence through one observer batch boundary', () => {
      const batchSubscriber = vi.fn()
      const eventSubscriber = vi.fn()
      const batchSubscription = subscribeToEventBatches(batchSubscriber)
      const eventSubscription = subscribeToEvents(eventSubscriber)
      batchSubscriber.mockClear()
      eventSubscriber.mockClear()
      const events = [
        {
          type: EventTypes.ADD_ELEMENT,
          payload: { message: 'first' }
        },
        {
          type: EventTypes.ADD_ELEMENT,
          payload: { message: 'second' }
        }
      ] as const

      publishEventsToObservers(events)

      expect(batchSubscriber).toHaveBeenCalledOnce()
      expect(batchSubscriber).toHaveBeenCalledWith(events)
      expect(eventSubscriber.mock.calls.map(([event]) => event)).toEqual(events)

      batchSubscription.unsubscribe()
      eventSubscription.unsubscribe()
    })

    it('keeps one observer registry snapshot for the full ordered batch', () => {
      const lateSubscriber = vi.fn()
      let lateSubscription: ReturnType<typeof subscribeToEvents> | undefined
      const firstSubscription = subscribeToEvents((event) => {
        const message = (event as TestEvent).payload?.message
        if (message === 'batch-snapshot-first' && !lateSubscription) {
          lateSubscription = subscribeToEvents(lateSubscriber)
        }
      })
      const events = [
        {
          type: EventTypes.ADD_ELEMENT,
          payload: { message: 'batch-snapshot-first' }
        },
        {
          type: EventTypes.ADD_ELEMENT,
          payload: { message: 'batch-snapshot-second' }
        }
      ] as const

      try {
        publishEventsToObservers(events)
      } finally {
        firstSubscription.unsubscribe()
        lateSubscription?.unsubscribe()
      }

      expect(
        lateSubscriber.mock.calls.map(
          ([event]) => (event as TestEvent).payload.message
        )
      ).toEqual(['batch-snapshot-first'])
    })

    it('does not let one batch observer invalidate canonical delivery to later observers', () => {
      const failure = new Error('batch observer failed')
      const failingSubscription = subscribeToEventBatches(() => {
        throw failure
      })
      const laterSubscriber = vi.fn()
      const laterSubscription = subscribeToEventBatches(laterSubscriber)
      const events = [
        {
          type: EventTypes.ADD_ELEMENT,
          payload: { message: 'observer-isolation' }
        }
      ] as const

      try {
        expect(() => publishEventsToObservers(events)).not.toThrow()
      } finally {
        failingSubscription.unsubscribe()
        laterSubscription.unsubscribe()
      }

      expect(laterSubscriber).toHaveBeenCalledOnce()
      expect(laterSubscriber).toHaveBeenCalledWith(events)
    })

    it('keeps the public ReplaySubject ingress connected to helper subscribers', () => {
      const subscriber = vi.fn()
      const subscription = subscribeToEvents(subscriber)
      subscriber.mockClear()
      const event: TestEvent = {
        type: EventTypes.ADD_ELEMENT,
        payload: { message: 'public-subject-ingress' }
      }

      try {
        getEventBus().next(event)
      } finally {
        subscription.unsubscribe()
      }

      expect(subscriber).toHaveBeenCalledOnce()
      expect(subscriber).toHaveBeenCalledWith(event)
    })

    it('holds one public ReplaySubject observer snapshot across a batch', () => {
      const lateSubscriber = vi.fn()
      let lateSubscription: ReturnType<typeof subscribeToEvents> | undefined
      const firstSubscription = getEventBus().subscribe((event) => {
        if (
          (event as TestEvent).payload?.message === 'legacy-snapshot-first' &&
          !lateSubscription
        ) {
          lateSubscription = getEventBus().subscribe(lateSubscriber)
        }
      })
      const events = [
        {
          type: EventTypes.ADD_ELEMENT,
          payload: { message: 'legacy-snapshot-first' }
        },
        {
          type: EventTypes.ADD_ELEMENT,
          payload: { message: 'legacy-snapshot-second' }
        }
      ] as const

      try {
        publishEventsToObservers(events)
      } finally {
        firstSubscription.unsubscribe()
        lateSubscription?.unsubscribe()
      }

      expect(
        lateSubscriber.mock.calls.map(
          ([event]) => (event as TestEvent).payload.message
        )
      ).toEqual(['legacy-snapshot-first'])
    })

    it('honors batch observer unsubscription against the active snapshot', () => {
      const laterSubscriber = vi.fn()
      const firstSubscription = subscribeToEventBatches(() => {
        laterSubscription.unsubscribe()
      })
      const laterSubscription = subscribeToEventBatches(laterSubscriber)

      try {
        publishEventsToObservers([
          {
            type: EventTypes.ADD_ELEMENT,
            payload: { message: 'unsubscribe-later-batch-observer' }
          }
        ])
      } finally {
        firstSubscription.unsubscribe()
        laterSubscription.unsubscribe()
      }

      expect(laterSubscriber).not.toHaveBeenCalled()
    })

    it('isolates the ordered batch array from observer mutation', () => {
      const source = [
        {
          type: EventTypes.ADD_ELEMENT,
          payload: { message: 'immutable-first' }
        },
        {
          type: EventTypes.ADD_ELEMENT,
          payload: { message: 'immutable-second' }
        }
      ] as TestEvent[]
      const firstSubscription = subscribeToEventBatches((events) => {
        ;(events as TestEvent[]).reverse()
      })
      const laterSubscriber = vi.fn()
      const laterSubscription = subscribeToEventBatches(laterSubscriber)

      try {
        publishEventsToObservers(source)
      } finally {
        firstSubscription.unsubscribe()
        laterSubscription.unsubscribe()
      }

      expect(source.map(({ payload }) => payload.message)).toEqual([
        'immutable-first',
        'immutable-second'
      ])
      expect(
        (laterSubscriber.mock.calls[0]?.[0] as readonly TestEvent[])?.map(
          ({ payload }) => payload.message
        )
      ).toEqual(['immutable-first', 'immutable-second'])
    })
  })

  describe('createEventStream', () => {
    it('should demonstrate reactive event streams for real-time updates', () => {
      // Demonstrates: How to create reactive streams for continuous event monitoring
      const reloadAction = vi.fn()

      // Create a stream for transaction events with reload action
      const transactionStream = createEventStream<TestEvent>(
        EventTypes.START_TRANSACTION,
        reloadAction
      )

      const streamSubscriber = vi.fn()
      const subscription = transactionStream.subscribe(streamSubscriber)

      // Publish transaction events
      const startTransactionEvent: TestEvent = {
        type: EventTypes.START_TRANSACTION,
        payload: { message: 'Transaction started' }
      }

      publishEvent(startTransactionEvent)

      // Both stream subscriber and reload action should be called
      expect(streamSubscriber).toHaveBeenCalledWith(startTransactionEvent)
      expect(reloadAction).toHaveBeenCalled()

      subscription.unsubscribe()
    })

    it('should filter events correctly in streams', () => {
      // Demonstrates: Event streams only receive their specific event types
      const streamSubscriber = vi.fn()

      const undoStream = createEventStream<TestEvent>(EventTypes.UNDO)
      const subscription = undoStream.subscribe(streamSubscriber)

      // Publish various events
      publishEvent({
        type: EventTypes.UNDO,
        payload: { message: 'Undo action' }
      })

      publishEvent({
        type: EventTypes.REDO,
        payload: { message: 'Redo action' }
      })

      publishEvent({
        type: EventTypes.UNDO,
        payload: { message: 'Another undo' }
      })

      // Only UNDO events should be received
      expect(streamSubscriber).toHaveBeenCalledTimes(2)
      expect(streamSubscriber).toHaveBeenNthCalledWith(1, {
        type: EventTypes.UNDO,
        payload: { message: 'Undo action' }
      })
      expect(streamSubscriber).toHaveBeenNthCalledWith(2, {
        type: EventTypes.UNDO,
        payload: { message: 'Another undo' }
      })

      subscription.unsubscribe()
    })
  })

  describe('event system integration', () => {
    it('should demonstrate complete event flow from publish to multiple subscribers', () => {
      // Demonstrates: Complete event communication flow in the system
      const coreSubscriber = vi.fn()
      const uiSubscriber = vi.fn()
      const renderSubscriber = vi.fn()

      // Different components subscribing to the same event
      const subscribeToRender = createSubscribeEvent<TestEvent>(
        EventTypes.INIT_RENDER
      )

      const coreSub = subscribeToRender(coreSubscriber)
      const uiSub = subscribeToRender(uiSubscriber)
      const renderSub = subscribeToRender(renderSubscriber)

      // Simulate render initialization event
      const renderEvent: TestEvent = {
        type: EventTypes.INIT_RENDER,
        payload: { message: 'Render system initializing' }
      }

      publishEvent(renderEvent)

      // All components should receive the event
      expect(coreSubscriber).toHaveBeenCalledWith(renderEvent)
      expect(uiSubscriber).toHaveBeenCalledWith(renderEvent)
      expect(renderSubscriber).toHaveBeenCalledWith(renderEvent)

      // Clean up
      coreSub.unsubscribe()
      uiSub.unsubscribe()
      renderSub.unsubscribe()
    })
  })
})
