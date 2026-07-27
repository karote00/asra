import { describe, expect, it } from 'vitest'
import {
  endTransaction,
  EventTypes,
  registerTransactionOwner,
  runTransaction,
  updateTransaction
} from '@asyra/reactive-events'
import type { TransactionStatusPayload } from '@asyra/utils'
import { Factory } from '../factory'
import {
  TransactionRollbackError,
  TransactionValidationError
} from '../transaction'

const registerFactoryAsOwner = (factory: Factory) =>
  registerTransactionOwner({
    startTransaction: () => factory.startTransaction(),
    updateTransaction: (event) => factory.updateTransaction(event),
    endTransaction: (options) => factory.endTransaction(options),
    undo: () => factory.undo(),
    redo: () => factory.redo()
  })

describe('Factory transaction owner integration', () => {
  it('surfaces validation failure through runTransaction after rolling back', () => {
    const factory = new Factory()
    const statuses: TransactionStatusPayload[] = []
    const disposeStatus = factory.subscribeToTransactionStatus((status) => {
      statuses.push(status)
    })
    const disposeOwner = registerFactoryAsOwner(factory)
    factory.registerTransactionValidator('cross-store', () => ({
      valid: false,
      code: 'invalid-state',
      message: 'State validation failed'
    }))

    try {
      expect(() =>
        runTransaction(() => {
          updateTransaction(EventTypes.UPDATE_COMPUTED_DATA, {
            id: 'element-1',
            before: 0,
            after: 1
          })
        })
      ).toThrow(TransactionValidationError)
      expect(statuses[statuses.length - 1]).toMatchObject({
        status: 'rolled-back',
        failure: { kind: 'validation-failed' }
      })
    } finally {
      disposeOwner()
      disposeStatus()
    }
  })

  it('surfaces rollback failure through runTransaction and closes the owner', () => {
    const factory = new Factory()
    const statuses: TransactionStatusPayload[] = []
    const disposeStatus = factory.subscribeToTransactionStatus((status) => {
      statuses.push(status)
    })
    const disposeOwner = registerFactoryAsOwner(factory)
    factory.registerTransactionInverter('custom.broken', () => {
      throw new Error('inverse failed')
    })

    try {
      expect(() =>
        runTransaction(() => {
          updateTransaction('custom.broken', { id: 'custom' })
          throw new Error('handler failed')
        })
      ).toThrow(TransactionRollbackError)
      expect(statuses[statuses.length - 1]).toMatchObject({
        status: 'rollback-failed',
        error: expect.any(TransactionRollbackError)
      })
      expect(() => factory.endTransaction()).not.toThrow()
    } finally {
      disposeOwner()
      disposeStatus()
    }
  })

  it('rejects commit and closes its owned boundary when artifact inverse capture fails', () => {
    const factory = new Factory()
    const disposeOwner = registerFactoryAsOwner(factory)
    factory.registerTransactionInverter('custom.broken-undo', () => {
      throw new Error('undo inverse failed')
    })

    try {
      expect(() =>
        runTransaction(() => {
          updateTransaction('custom.broken-undo', { id: 'custom' })
        })
      ).toThrow(TransactionRollbackError)
      expect(
        (
          factory.transact as unknown as {
            isTransacting: number
            undoStack: unknown[]
          }
        ).isTransacting
      ).toBe(0)
      expect(
        (
          factory.transact as unknown as {
            undoStack: unknown[]
          }
        ).undoStack
      ).toHaveLength(0)
      expect(factory.isInUndoRedo()).toBe(false)
    } finally {
      endTransaction({ outcome: 'rollback' })
      factory.transact.reset()
      disposeOwner()
    }
  })
})
