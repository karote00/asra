/**
 * Transaction APIs - for data modifications
 * Used in: create-element, selection, and many future features
 */

import {
  type FactoryMutationDeliverySequence,
  startTransaction,
  endTransaction,
  rollbackTransaction,
  runTransaction,
  updateTransaction
} from '@asyra/core'
import core from '../contexts'

const configureSharedDeliverySequence = (
  sequence: FactoryMutationDeliverySequence
): void => {
  core.configureSharedDeliverySequence(sequence)
}

export const transactionApis = {
  startTransaction,
  endTransaction,
  rollbackTransaction,
  runTransaction,
  updateTransaction,
  configureSharedDeliverySequence
}
