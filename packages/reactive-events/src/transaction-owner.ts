import type { EndTransactionOptions } from '@asyra/utils'
import type { UpdateTransactionEvent } from './app/events'

export interface TransactionOwner {
  startTransaction: () => void
  updateTransactionBatch: (events: readonly UpdateTransactionEvent[]) => void
  endTransaction: (options?: EndTransactionOptions) => void
  undo: () => void
  redo: () => void
}

let transactionOwner: TransactionOwner | null = null
let transactionOwnerOverride: TransactionOwner | null = null

export const registerTransactionOwner = (
  owner: TransactionOwner
): (() => void) => {
  if (transactionOwner) {
    throw new Error('A transaction owner is already registered')
  }
  transactionOwner = owner
  return () => {
    if (transactionOwner === owner) {
      transactionOwner = null
    }
  }
}

export const getTransactionOwner = (): TransactionOwner | null =>
  transactionOwnerOverride ?? transactionOwner

export const runWithTransactionOwner = <T>(
  owner: TransactionOwner,
  callback: () => T
): T => {
  const previousOverride = transactionOwnerOverride
  transactionOwnerOverride = owner
  try {
    return callback()
  } finally {
    transactionOwnerOverride = previousOverride
  }
}
