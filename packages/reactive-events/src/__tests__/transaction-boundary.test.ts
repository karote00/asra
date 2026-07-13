import { describe, expect, it, vi } from 'vitest'
import {
  endTransaction,
  startTransaction,
  subscribeToEndTransaction,
  subscribeToStartTransaction
} from '../app'

describe('transaction boundary publishing', () => {
  it('publishes boundary events only for the outermost transaction', () => {
    const startSubscriber = vi.fn()
    const endSubscriber = vi.fn()
    const startSubscription = subscribeToStartTransaction(startSubscriber)
    const endSubscription = subscribeToEndTransaction(endSubscriber)
    startSubscriber.mockClear()
    endSubscriber.mockClear()

    startTransaction()
    startTransaction()
    endTransaction()

    expect(startSubscriber).toHaveBeenCalledTimes(1)
    expect(endSubscriber).not.toHaveBeenCalled()

    endTransaction()

    expect(startSubscriber).toHaveBeenCalledTimes(1)
    expect(endSubscriber).toHaveBeenCalledTimes(1)

    startSubscription.unsubscribe()
    endSubscription.unsubscribe()
  })

  it('keeps standalone endTransaction compatible for cleanup subscribers', () => {
    const endSubscriber = vi.fn()
    const subscription = subscribeToEndTransaction(endSubscriber)
    endSubscriber.mockClear()

    endTransaction()

    expect(endSubscriber).toHaveBeenCalledTimes(1)

    subscription.unsubscribe()
  })
})
