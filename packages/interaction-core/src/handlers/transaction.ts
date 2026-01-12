import {
  decideToEndTransaction,
  decideToStartTransaction
} from '@asra/reactive-events'
import { InteractionActions } from '@asra/utils'

export const TransactionHandlers = {
  [InteractionActions.INTERACTION_START_TRANSACTION]: (
    payload?: any,
    options?: any
  ) => {
    decideToStartTransaction()
  },
  [InteractionActions.INTERACTION_END_TRANSACTION]: (
    payload?: any,
    options?: any
  ) => {
    decideToEndTransaction()
  }
}
