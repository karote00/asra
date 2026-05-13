import { describe, expect, it, vi } from 'vitest'
import {
  TransactionEventTypes,
  subscribeToUserActionCompleted,
  type UpdateTransactionEvent
} from '@asyra/reactive-events'
import DataTransact from '../data-transact'

const createUpdateEvent = (
  options?: UpdateTransactionEvent['options']
): UpdateTransactionEvent => ({
  type: TransactionEventTypes.UPDATE_TRANSACTION,
  eventName: 'test.change',
  payload: {
    id: 'test.change'
  } as unknown as UpdateTransactionEvent['payload'],
  options
})

describe('DataTransact user action completion', () => {
  it('publishes one completion payload when a non-empty action is committed', () => {
    const transact = new DataTransact()
    const subscriber = vi.fn()
    const subscription = subscribeToUserActionCompleted(subscriber)
    subscriber.mockClear()

    transact.start()
    transact.update(createUpdateEvent())
    transact.end()

    expect(subscriber).toHaveBeenCalledTimes(1)
    expect(subscriber.mock.calls[0][0].payload).toMatchObject({
      actionId: 1,
      changeCount: 1
    })
    expect(typeof subscriber.mock.calls[0][0].payload.timestamp).toBe('number')

    subscription.unsubscribe()
  })

  it('does not publish completion payload for no-op transactions', () => {
    const transact = new DataTransact()
    const subscriber = vi.fn()
    const subscription = subscribeToUserActionCompleted(subscriber)
    subscriber.mockClear()

    transact.start()
    transact.end()

    expect(subscriber).not.toHaveBeenCalled()

    subscription.unsubscribe()
  })

  it('routes changes to shared channel when options.shared is set', () => {
    const pushToSharedChannel = vi.fn()
    const transact = new DataTransact({ pushToSharedChannel })

    transact.start()
    transact.update(createUpdateEvent({ shared: 'sceneTree' }))
    transact.end()

    expect(pushToSharedChannel).toHaveBeenCalledTimes(1)
    expect(pushToSharedChannel).toHaveBeenCalledWith(
      'sceneTree',
      expect.objectContaining({ id: 'test.change' })
    )
  })

  it('forwards effective mutation options to shared channel payloads', () => {
    const pushToSharedChannel = vi.fn()
    const transact = new DataTransact({ pushToSharedChannel })

    transact.start()
    transact.update(createUpdateEvent({ undoable: false, shared: 'sceneTree' }))
    transact.end()

    expect(pushToSharedChannel).toHaveBeenCalledWith(
      'sceneTree',
      expect.objectContaining({
        id: 'test.change',
        options: { undoable: false }
      })
    )
    expect(pushToSharedChannel.mock.calls[0][1].options).not.toHaveProperty(
      'shared'
    )
  })

  it('keeps transaction local when options.shared is omitted', () => {
    const pushToSharedChannel = vi.fn()
    const transact = new DataTransact({ pushToSharedChannel })

    transact.start()
    transact.update(createUpdateEvent())
    transact.end()

    expect(pushToSharedChannel).not.toHaveBeenCalled()
  })

  it('keeps transaction local when shared channel is unknown', () => {
    const pushToSharedChannel = vi.fn().mockReturnValue(false)
    const transact = new DataTransact({ pushToSharedChannel })
    const subscriber = vi.fn()
    const subscription = subscribeToUserActionCompleted(subscriber)
    subscriber.mockClear()

    transact.start()
    transact.update(createUpdateEvent({ shared: 'unknown-channel' }))
    transact.end()

    expect(pushToSharedChannel).toHaveBeenCalledWith(
      'unknown-channel',
      expect.objectContaining({ id: 'test.change' })
    )
    expect(subscriber).toHaveBeenCalledTimes(1)

    subscription.unsubscribe()
  })
})
