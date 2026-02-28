import { describe, expect, it, vi } from 'vitest'
import {
  TransactionEventTypes,
  subscribeToUserActionCompleted,
  type UpdateTransactionEvent
} from '@asyra/reactive-events'
import { OWNER } from '@asyra/utils'
import DataTransact from '../data-transact'

const createUpdateEvent = (): UpdateTransactionEvent => ({
  type: TransactionEventTypes.UPDATE_TRANSACTION,
  eventName: 'test.change',
  payload: {
    owner: OWNER.SCENE_TREE
  } as unknown as UpdateTransactionEvent['payload']
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
})
