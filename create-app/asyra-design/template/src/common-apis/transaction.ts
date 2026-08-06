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
import {
  getActiveStagedDeliveryController,
  type FactoryMutationDeliverySequence
} from '@asyra/factory'

const configureSharedDeliverySequence = (
  sequence: FactoryMutationDeliverySequence
): void => {
  const controller = getActiveStagedDeliveryController()
  if (!controller) {
    throw new Error(
      '[transaction] shared delivery sequence requires an active transaction'
    )
  }
  controller.setDeliverySequence(sequence)
}

export const transactionApis = {
  startTransaction,
  endTransaction,
  rollbackTransaction,
  runTransaction,
  updateTransaction,
  configureSharedDeliverySequence
}
