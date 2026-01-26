import {
  decideToEndTransaction,
  decideToStartTransaction
} from '@asyra/reactive-events'
import { InteractionActions, DetailType } from '@asyra/utils'

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
