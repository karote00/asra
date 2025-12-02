import { endTransaction, startTransaction } from '@asra/reactive-events'
import { TransactionActionAPIs } from '../types'

export const createTransactionAPIs = (): TransactionActionAPIs => {
  return {
    startTransaction() {
      startTransaction()
    },
    endTransaction() {
      endTransaction()
    }
  }
}
