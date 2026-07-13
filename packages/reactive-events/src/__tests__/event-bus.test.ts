import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  publishEvent,
  createSubscribeEvent,
  subscribeToSynchronousEvent,
  subscribeToEvents,
  getEventBus,
  createEventStream
} from '../event-bus'
import { EventTypes } from '../types'

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
