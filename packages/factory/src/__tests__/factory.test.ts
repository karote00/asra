import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Factory } from '../factory'
import type _DataTransact from '../data-transact' // Keep this import for type inference
import {
  EventTypes,
  subscribeToEvents,
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
      eventName: 'test-event',
      payload: { id: 'test-event' },
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

  it('notifies non-undoable shared channel observers during the active transaction', () => {
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
      eventName: 'test-event',
      payload: { id: 'non-undoable-test-event' },
      options: {
        undoable: false,
        shared: SharedDataChannelNames.SCENE_TREE
      }
    })

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'non-undoable-test-event' })
    )

    factory.endTransaction()

    dispose()
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
      eventName: 'test-event',
      payload: { id: 'test-event' },
      options: { shared: SharedDataChannelNames.SCENE_TREE }
    })
    expect(undoStackLengths).toEqual([])

    factory.endTransaction()

    expect(undoStackLengths).toEqual([1])

    dispose()
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
