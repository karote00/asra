/**
 * Transaction APIs - for data modifications
 * Used in: create-element, selection, and many future features
 */

import {
  startTransaction,
  endTransaction,
  rollbackTransaction,
  runTransaction,
  updateTransaction
} from '@asyra/core'

export const transactionApis = {
  startTransaction,
  endTransaction,
  rollbackTransaction,
  runTransaction,
  updateTransaction
}
