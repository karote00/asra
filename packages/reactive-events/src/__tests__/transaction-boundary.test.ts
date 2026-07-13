import { describe, expect, it, vi } from 'vitest'
import {
  endTransaction,
  rollbackTransaction,
  runTransaction,
  startTransaction,
  subscribeToEndTransaction,
  subscribeToStartTransaction
} from '../app'
import { updateTransaction } from '../app'
import { registerTransactionOwner } from '../transaction-owner'

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

  it('treats standalone endTransaction as a no-op', () => {
    const endSubscriber = vi.fn()
    const subscription = subscribeToEndTransaction(endSubscriber)
    endSubscriber.mockClear()

    endTransaction()

    expect(endSubscriber).not.toHaveBeenCalled()

    subscription.unsubscribe()
  })

  it('latches a nested rollback until the outer transaction closes', () => {
    const endSubscriber = vi.fn()
    const subscription = subscribeToEndTransaction(endSubscriber)
    endSubscriber.mockClear()

    startTransaction()
    startTransaction()
    rollbackTransaction({ kind: 'explicit', message: 'nested failure' })

    expect(endSubscriber).not.toHaveBeenCalled()

    endTransaction()

    expect(endSubscriber).toHaveBeenCalledTimes(1)
    expect(endSubscriber).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: {
          outcome: 'rollback',
          failure: {
            kind: 'explicit',
            message: 'nested failure'
          }
        }
      })
    )

    subscription.unsubscribe()
  })

  it('latches a nested rollback even when no failure detail is supplied', () => {
    const endSubscriber = vi.fn()
    const subscription = subscribeToEndTransaction(endSubscriber)
    endSubscriber.mockClear()

    startTransaction()
    startTransaction()
    rollbackTransaction()
    endTransaction()

    expect(endSubscriber).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: { outcome: 'rollback' }
      })
    )

    subscription.unsubscribe()
  })

  it('commits a successful synchronous runTransaction', () => {
    const endSubscriber = vi.fn()
    const subscription = subscribeToEndTransaction(endSubscriber)
    endSubscriber.mockClear()

    const result = runTransaction(() => 'complete')

    expect(result).toBe('complete')
    expect(endSubscriber).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: { outcome: 'commit' }
      })
    )

    subscription.unsubscribe()
  })

  it('rolls back and rethrows a synchronous runTransaction failure', () => {
    const endSubscriber = vi.fn()
    const subscription = subscribeToEndTransaction(endSubscriber)
    const failure = new Error('sync failure')
    endSubscriber.mockClear()

    expect(() =>
      runTransaction(() => {
        throw failure
      })
    ).toThrow(failure)

    expect(endSubscriber).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: {
          outcome: 'rollback',
          failure: expect.objectContaining({
            kind: 'explicit',
            message: 'sync failure',
            cause: failure
          })
        }
      })
    )

    subscription.unsubscribe()
  })

  it('rolls back and rethrows an asynchronous runTransaction failure', async () => {
    const endSubscriber = vi.fn()
    const subscription = subscribeToEndTransaction(endSubscriber)
    const failure = new Error('async failure')
    endSubscriber.mockClear()

    await expect(
      runTransaction(async () => {
        throw failure
      })
    ).rejects.toBe(failure)

    expect(endSubscriber).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: {
          outcome: 'rollback',
          failure: expect.objectContaining({
            kind: 'explicit',
            message: 'async failure',
            cause: failure
          })
        }
      })
    )

    subscription.unsubscribe()
  })

  it('surfaces synchronous transaction owner finalization failures to runTransaction', () => {
    const finalizationFailure = new Error('validation failed')
    const endSubscriber = vi.fn()
    const endSubscription = subscribeToEndTransaction(endSubscriber)
    endSubscriber.mockClear()
    const disposeOwner = registerTransactionOwner({
      startTransaction: vi.fn(),
      updateTransaction: vi.fn(),
      endTransaction: () => {
        throw finalizationFailure
      },
      undo: vi.fn(),
      redo: vi.fn()
    })

    try {
      expect(() =>
        runTransaction(() => {
          updateTransaction('test.change', { before: 0, after: 1 })
        })
      ).toThrow(finalizationFailure)
      expect(endSubscriber).toHaveBeenCalledWith(
        expect.objectContaining({ payload: { outcome: 'commit' } })
      )
    } finally {
      disposeOwner()
      endSubscription.unsubscribe()
    }
  })
})
