import {
  decideToEndTransaction,
  decideToStartTransaction
} from '@asra/reactive-events'
import { InteractionActions, DetailType } from '@asra/utils'

export const TransactionHandlers = {
  [InteractionActions.INTERACTION_START_TRANSACTION]: (
    payload?: DetailType,
    options?: DetailType
  ) => {
    decideToStartTransaction()
  },
  [InteractionActions.INTERACTION_END_TRANSACTION]: (
    payload?: DetailType,
    options?: DetailType
  ) => {
    decideToEndTransaction()
  }
}
