import { transactionApis } from '../common-apis'

interface InteractionTransactionState {
  current: boolean
}

export const startInteractionTransaction = (
  state: InteractionTransactionState,
  canStart: boolean
): void => {
  if (state.current || !canStart) {
    return
  }

  state.current = true
  transactionApis.startTransaction()
}

export const endInteractionTransaction = (
  state: InteractionTransactionState
): void => {
  if (!state.current) {
    return
  }

  state.current = false
  transactionApis.endTransaction()
}
