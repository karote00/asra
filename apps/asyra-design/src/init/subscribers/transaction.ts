/**
 * Subscribers - Simple forwarding layer
 * Subscribers don't have logic, they just forward events to behaviors
 */

import {
  subscribeToDecideToStartTransaction,
  subscribeToDecideToEndTransaction
} from '../events'
import {
  startTransactionBehavior,
  endTransactionBehavior
} from './../behaviors/transaction'

export const initTransactionSubscribers = () => {
  subscribeToDecideToStartTransaction(() => {
    startTransactionBehavior()
  })

  subscribeToDecideToEndTransaction(() => {
    endTransactionBehavior()
  })
}
