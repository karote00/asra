import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as Y from 'yjs'
import { Factory } from '../factory'
import type _DataTransact from '../data-transact' // Keep this import for type inference
import {
  EventTypes,
  subscribeToEvents,
  subscribeToUserActionCompleted,
  UpdateTransactionEvent,
  TransactionEventTypes
} from '@asyra/reactive-events'
import { SCENE_TREE_ACTIONS, SharedDataChannelNames } from '@asyra/utils'

describe('Factory', () => {
  let factory: Factory

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetAllMocks()
    factory = new Factory()
    // Spy on the methods of the actual DataTransact instance
    vi.spyOn(factory.transact, 'start')
    vi.spyOn(factory.transact, 'update')
    vi.spyOn(factory.transact, 'end')
    vi.spyOn(factory.transact, 'undo')
    vi.spyOn(factory.transact, 'redo')
  })

  it('should call DataTransact.start when startTransaction is called', () => {
    factory.startTransaction()
    expect(factory.transact.start).toHaveBeenCalledTimes(1)
  })

  it('should call DataTransact.update when updateTransaction is called', () => {
    const mockEvent: UpdateTransactionEvent = {
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: 'test-event',
      payload: { changes: [] }
    }
    factory.updateTransaction(mockEvent)
    expect(factory.transact.update).toHaveBeenCalledTimes(1)
    expect(factory.transact.update).toHaveBeenCalledWith(mockEvent)
  })

  it('should call DataTransact.end when endTransaction is called', () => {
    factory.endTransaction()
    expect(factory.transact.end).toHaveBeenCalledTimes(1)
  })

  it('should call DataTransact.undo when undo is called', () => {
    factory.undo()
    expect(factory.transact.undo).toHaveBeenCalledTimes(1)
  })

  it('should call DataTransact.redo when redo is called', () => {
    factory.redo()
    expect(factory.transact.redo).toHaveBeenCalledTimes(1)
  })

  it('keeps transaction status subscriptions isolated per Factory instance', () => {
    const first = new Factory()
    const second = new Factory()
    const firstStatus = vi.fn()
    const secondStatus = vi.fn()
    const disposeFirst = first.subscribeToTransactionStatus(firstStatus)
    const disposeSecond = second.subscribeToTransactionStatus(secondStatus)

    first.startTransaction()
    first.updateTransaction({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: EventTypes.UPDATE_COMPUTED_DATA,
      payload: { id: 'first', before: 0, after: 1 }
    })
    first.endTransaction()

    expect(firstStatus).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'committed' })
    )
    expect(secondStatus).not.toHaveBeenCalled()

    disposeFirst()
    disposeSecond()
  })

  it('isolates transaction status listener failures from canonical commit', () => {
    const laterStatus = vi.fn()
    factory.subscribeToTransactionStatus(() => {
      throw new Error('diagnostic listener failed')
    })
    factory.subscribeToTransactionStatus(laterStatus)

    factory.startTransaction()
    factory.updateTransaction({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: EventTypes.UPDATE_COMPUTED_DATA,
      payload: { id: 'value', before: 0, after: 1 }
    })

    expect(() => factory.endTransaction()).not.toThrow()
    expect(laterStatus).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'committed' })
    )
  })

  it('reports undo and redo commits on the owning Factory instance', () => {
    const isolatedFactory = new Factory()
    const statuses: { origin: string; status: string }[] = []
    const dispose = isolatedFactory.subscribeToTransactionStatus((status) => {
      statuses.push(status)
    })

    isolatedFactory.startTransaction()
    isolatedFactory.updateTransaction({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: EventTypes.UPDATE_COMPUTED_DATA,
      payload: { id: 'value', before: 0, after: 1 }
    })
    isolatedFactory.endTransaction()
    statuses.length = 0

    isolatedFactory.undo()
    isolatedFactory.redo()

    expect(statuses).toEqual([
      expect.objectContaining({ origin: 'undo', status: 'committed' }),
      expect.objectContaining({ origin: 'redo', status: 'committed' })
    ])

    dispose()
  })

  it('does not bridge custom Factory completion to the global event bus', () => {
    const customFactory = new Factory()
    const subscriber = vi.fn()
    const subscription = subscribeToUserActionCompleted(subscriber)
    subscriber.mockClear()

    customFactory.startTransaction()
    customFactory.updateTransaction({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: EventTypes.UPDATE_COMPUTED_DATA,
      payload: { id: 'custom', before: 0, after: 1 }
    })
    customFactory.endTransaction()

    expect(subscriber).not.toHaveBeenCalled()

    subscription.unsubscribe()
  })

  it('does not register shared data channels implicitly', () => {
    expect(
      factory.hasSharedDataChannel(SharedDataChannelNames.SCENE_TREE)
    ).toBe(false)
    expect(factory.hasSharedDataChannel(SharedDataChannelNames.SELECTION)).toBe(
      false
    )
    expect(factory.hasSharedDataChannel(SharedDataChannelNames.PROPS)).toBe(
      false
    )
  })

  it('notifies channel observers when shared transaction changes are appended', () => {
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      factory.getYjsDataChannel(SharedDataChannelNames.SCENE_TREE)
    )

    const handler = vi.fn()
    const dispose = factory.observeSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      handler
    )
    const sharedEvent: UpdateTransactionEvent = {
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: EventTypes.UPDATE_COMPUTED_DATA,
      payload: { id: 'test-event', before: 0, after: 1 },
      options: { shared: SharedDataChannelNames.SCENE_TREE }
    }

    factory.startTransaction()
    factory.updateTransaction(sharedEvent)
    factory.endTransaction()

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'test-event' })
    )

    dispose()
  })

  it('defers non-undoable shared channel observers without explicit immediate delivery', () => {
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      factory.getYjsDataChannel(SharedDataChannelNames.SCENE_TREE)
    )

    const handler = vi.fn()
    const dispose = factory.observeSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      handler
    )

    factory.startTransaction()
    factory.updateTransaction({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: EventTypes.UPDATE_COMPUTED_DATA,
      payload: {
        id: 'non-undoable-test-event',
        before: 0,
        after: 1
      },
      options: {
        undoable: false,
        shared: SharedDataChannelNames.SCENE_TREE
      }
    })

    expect(handler).not.toHaveBeenCalled()

    factory.endTransaction()

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'non-undoable-test-event' })
    )

    dispose()
  })

  it('delivers each committed journal snapshot once and in order to every observer', () => {
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      factory.getYjsDataChannel(SharedDataChannelNames.SCENE_TREE)
    )

    interface OrderedChange {
      id: string
      owner: 'raw' | 'computed'
      before: number
      after: number
      evidence: { sequence: number }
    }
    const firstObserverChanges: OrderedChange[] = []
    const secondObserverChanges: OrderedChange[] = []
    const disposeFirst = factory.observeSharedDataChannel<OrderedChange>(
      SharedDataChannelNames.SCENE_TREE,
      (change) => firstObserverChanges.push(change)
    )
    const disposeSecond = factory.observeSharedDataChannel<OrderedChange>(
      SharedDataChannelNames.SCENE_TREE,
      (change) => secondObserverChanges.push(change)
    )

    factory.startTransaction()
    ;[1, 2, 3].forEach((sequence) => {
      const payload = {
        action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA,
        id: 'ordered-element',
        owner: sequence % 2 === 0 ? ('raw' as const) : ('computed' as const),
        key: 'x',
        before: sequence - 1,
        after: sequence,
        evidence: { sequence }
      }
      factory.updateTransaction({
        type: TransactionEventTypes.UPDATE_TRANSACTION,
        eventName: EventTypes.UPDATE_COMPUTED_DATA,
        payload,
        options: { shared: SharedDataChannelNames.SCENE_TREE }
      })
      payload.after = 100 + sequence
      payload.evidence.sequence = 100 + sequence
    })

    expect(firstObserverChanges).toEqual([])
    expect(secondObserverChanges).toEqual([])

    factory.endTransaction()

    const expectedChanges = [1, 2, 3].map((sequence) =>
      expect.objectContaining({
        id: 'ordered-element',
        owner: sequence % 2 === 0 ? 'raw' : 'computed',
        before: sequence - 1,
        after: sequence,
        evidence: { sequence }
      })
    )
    expect(firstObserverChanges).toEqual(expectedChanges)
    expect(secondObserverChanges).toEqual(expectedChanges)

    factory.startTransaction()
    factory.updateTransaction({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: EventTypes.UPDATE_COMPUTED_DATA,
      payload: {
        action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA,
        id: 'rolled-back-element',
        owner: 'computed',
        key: 'x',
        before: 0,
        after: 1
      },
      options: { shared: SharedDataChannelNames.SCENE_TREE }
    })
    factory.endTransaction({ outcome: 'rollback' })

    expect(firstObserverChanges).toHaveLength(3)
    expect(secondObserverChanges).toHaveLength(3)

    disposeFirst()
    disposeSecond()
  })

  it('commits undo before notifying shared channel observers', () => {
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      factory.getYjsDataChannel(SharedDataChannelNames.SCENE_TREE)
    )

    const undoStackLengths: number[] = []
    const dispose = factory.observeSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      () => {
        undoStackLengths.push(
          (
            factory.transact as unknown as {
              undoStack: unknown[]
            }
          ).undoStack.length
        )
      }
    )

    factory.startTransaction()
    factory.updateTransaction({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: EventTypes.UPDATE_COMPUTED_DATA,
      payload: { id: 'test-event', before: 0, after: 1 },
      options: { shared: SharedDataChannelNames.SCENE_TREE }
    })
    expect(undoStackLengths).toEqual([])

    factory.endTransaction()

    expect(undoStackLengths).toEqual([1])

    dispose()
  })

  it('isolates shared channel observer failures from later observers', () => {
    const channel = new Y.Doc().getArray(SharedDataChannelNames.SCENE_TREE)
    const laterObserver = vi.fn()
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      channel
    )
    factory.observeSharedDataChannel(SharedDataChannelNames.SCENE_TREE, () => {
      throw new Error('shared observer failed')
    })
    factory.observeSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      laterObserver
    )

    factory.startTransaction()
    expect(() =>
      factory.updateTransaction({
        type: TransactionEventTypes.UPDATE_TRANSACTION,
        eventName: EventTypes.UPDATE_COMPUTED_DATA,
        payload: { id: 'observer-safe', before: 0, after: 1 },
        options: {
          shared: SharedDataChannelNames.SCENE_TREE,
          sharedDelivery: 'immediate'
        }
      })
    ).not.toThrow()
    factory.endTransaction()

    expect(laterObserver).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'observer-safe' })
    )
  })

  it('compensates an immediate append when a raw Yjs observer throws', () => {
    const channel = new Y.Doc().getArray(SharedDataChannelNames.SCENE_TREE)
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      channel
    )
    channel.observe(() => {
      throw new Error('raw Yjs observer failed')
    })

    factory.startTransaction()
    expect(() =>
      factory.updateTransaction({
        type: TransactionEventTypes.UPDATE_TRANSACTION,
        eventName: EventTypes.UPDATE_COMPUTED_DATA,
        payload: { id: 'compensated', before: 0, after: 1 },
        options: {
          shared: SharedDataChannelNames.SCENE_TREE,
          sharedDelivery: 'immediate'
        }
      })
    ).not.toThrow()
    expect(() => factory.endTransaction({ outcome: 'rollback' })).not.toThrow()

    expect(channel.toArray()).toEqual([
      expect.objectContaining({ id: 'compensated', before: 0, after: 1 }),
      expect.objectContaining({ id: 'compensated', before: 1, after: 0 })
    ])
  })

  it('inverts computed patch payloads during undo and replays original patch during redo', () => {
    const observedPatches: unknown[] = []
    const subscription = subscribeToEvents((event) => {
      if (
        event.type === EventTypes.UPDATE_COMPUTED_DATA_PATCH &&
        'payload' in event
      ) {
        observedPatches.push((event.payload as { patch: unknown }).patch)
      }
    })
    observedPatches.length = 0

    const payload = {
      action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_PATCH,
      eventName: EventTypes.UPDATE_COMPUTED_DATA_PATCH,
      id: 'vector-1',
      patch: {
        values: {
          x: { before: 0, after: 10 }
        },
        records: {
          points: {
            set: {
              A: {
                before: { id: 'A', x: 0, y: 0 },
                after: { id: 'A', x: 10, y: 10 }
              },
              U: {
                before: undefined,
                after: { id: 'U', x: 15, y: 15 }
              },
              B: {
                after: { id: 'B', x: 20, y: 20 }
              }
            },
            remove: {
              C: {
                before: { id: 'C', x: 30, y: 30 }
              }
            }
          }
        }
      }
    }

    factory.startTransaction()
    factory.updateTransaction({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: EventTypes.UPDATE_COMPUTED_DATA_PATCH,
      payload
    })
    factory.endTransaction()

    factory.undo()
    factory.redo()

    expect(observedPatches).toEqual([
      {
        values: {
          x: { before: 10, after: 0 }
        },
        records: {
          points: {
            set: {
              A: {
                before: { id: 'A', x: 10, y: 10 },
                after: { id: 'A', x: 0, y: 0 }
              },
              U: {
                before: { id: 'U', x: 15, y: 15 },
                after: undefined
              },
              C: {
                after: { id: 'C', x: 30, y: 30 }
              }
            },
            remove: {
              B: {
                before: { id: 'B', x: 20, y: 20 }
              }
            }
          }
        }
      },
      payload.patch
    ])

    subscription.unsubscribe()
  })
})
