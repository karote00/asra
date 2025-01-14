import type { UpdateTransactionEvent } from '@asra/reactive-events'
import {
  subscribeToStartTransaction,
  subscribeToUpdateTransaction,
  subscribeToEndTransaction
} from '@asra/reactive-events'
import factory from './factory'

export const initFactorySubscribe = () => {
  subscribeToStartTransaction(() => {
    factory.startTransaction()
  })

  subscribeToUpdateTransaction((event: UpdateTransactionEvent) => {
    factory.updateTransaction(event)
  })

  subscribeToEndTransaction(() => {
    factory.endTransaction()
  })
}
