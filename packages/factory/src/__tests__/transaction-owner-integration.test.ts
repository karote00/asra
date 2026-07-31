import { describe, expect, it } from 'vitest'
import {
  endTransaction,
  EventTypes,
  registerTransactionOwner,
  runTransaction,
  subscribeToEventBatches,
  type UpdateTransactionEvent,
  updateTransaction,
  updateTransactionBatch
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
    updateTransactionBatch: (events) => {
      factory.updateTransactionBatch(events)
    },
    endTransaction: (options) => factory.endTransaction(options),
    undo: () => factory.undo(),
    redo: () => factory.redo()
  })

describe('Factory transaction owner integration', () => {
  it('publishes no canonical observer prefix when Factory rejects finalization', () => {
    const factory = new Factory()
    const canonicalObserverBatches: string[][] = []
    const disposeOwner = registerFactoryAsOwner(factory)
    const observerSubscription = subscribeToEventBatches((events) => {
      const eventNames = events
        .filter(
          (event): event is UpdateTransactionEvent =>
            event.type === EventTypes.UPDATE_TRANSACTION
        )
        .map(({ eventName }) => eventName)
      if (eventNames.length > 0) {
        canonicalObserverBatches.push(eventNames)
      }
    })
    factory.registerTransactionValidator('cross-store', () => ({
      valid: false,
      code: 'invalid-state',
      message: 'State validation failed'
    }))

    try {
      expect(() =>
        runTransaction(() => {
          updateTransaction({
            type: EventTypes.UPDATE_TRANSACTION,
            eventName: EventTypes.UPDATE_PROPERTY,
            payload: {
              id: 'element-1',
              before: 0,
              after: 1
            }
          })
        })
      ).toThrow(TransactionValidationError)
      expect(canonicalObserverBatches).toEqual([])
    } finally {
      observerSubscription.unsubscribe()
      disposeOwner()
    }
  })

  it('retains one Reactive-issued batch identity through the Factory artifact boundary', () => {
    const factory = new Factory()
    const artifacts: unknown[] = []
    let issuedBatch: readonly UpdateTransactionEvent[] | undefined
    const disposeArtifact = factory.subscribeToMutationBatchArtifact(
      (artifact) => artifacts.push(artifact)
    )
    const disposeOwner = registerTransactionOwner({
      startTransaction: () => factory.startTransaction(),
      updateTransactionBatch: (events) => {
        issuedBatch = events
        factory.updateTransactionBatch(events)
      },
      endTransaction: (options) => factory.endTransaction(options),
      undo: () => factory.undo(),
      redo: () => factory.redo()
    })

    try {
      runTransaction(() => {
        updateTransactionBatch([
          {
            type: EventTypes.UPDATE_TRANSACTION,
            eventName: EventTypes.UPDATE_PROPERTY,
            payload: {
              id: 'element-1',
              before: 0,
              after: 1
            }
          }
        ])
      })

      const artifact = artifacts[0] as
        | {
            changes?: readonly {
              event?: UpdateTransactionEvent
            }[]
          }
        | undefined
      expect(artifact?.changes?.[0]?.event?.payload).toBe(
        issuedBatch?.[0]?.payload
      )
    } finally {
      disposeOwner()
      disposeArtifact()
    }
  })

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
          updateTransaction({
            type: EventTypes.UPDATE_TRANSACTION,
            eventName: EventTypes.UPDATE_PROPERTY,
            payload: {
              id: 'element-1',
              before: 0,
              after: 1
            }
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
          updateTransaction({
            type: EventTypes.UPDATE_TRANSACTION,
            eventName: 'custom.broken',
            payload: { id: 'custom' }
          })
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
          updateTransaction({
            type: EventTypes.UPDATE_TRANSACTION,
            eventName: 'custom.broken-undo',
            payload: { id: 'custom' }
          })
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
