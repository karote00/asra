import {
  subscribeToDecideToEndTransaction,
  subscribeToDecideToStartTransaction
} from '@asra/reactive-events'
import { TransactionActionAPIs } from '../../types'

export const initTransactionHandlers = (apis: TransactionActionAPIs) => {
  subscribeToDecideToStartTransaction(() => {
    apis.startTransaction()
  })

  subscribeToDecideToEndTransaction(() => {
    apis.endTransaction()
  })
}
