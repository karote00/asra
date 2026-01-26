import {
  subscribeToDecideToEndTransaction,
  subscribeToDecideToStartTransaction
} from '@asyra/reactive-events'
import { TransactionActionAPIs } from '../../types'

export const initTransactionHandlers = (apis: TransactionActionAPIs) => {
  subscribeToDecideToStartTransaction(() => {
    apis.startTransaction()
  })

  subscribeToDecideToEndTransaction(() => {
    apis.endTransaction()
  })
}
