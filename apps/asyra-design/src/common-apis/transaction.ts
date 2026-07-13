/**
 * Transaction APIs - for data modifications
 * Used in: create-element, selection, and many future features
 */

import {
  startTransaction,
  endTransaction,
  updateTransaction
} from '@asyra/reactive-events'

export const transactionApis = {
  startTransaction,
  endTransaction,
  updateTransaction
}
