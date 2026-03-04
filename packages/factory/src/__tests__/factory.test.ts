import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Factory } from '../factory'
import type _DataTransact from '../data-transact' // Keep this import for type inference
import {
  UpdateTransactionEvent,
  TransactionEventTypes
} from '@asyra/reactive-events'
import { SharedDataChannelNames } from '@asyra/utils'

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
})
