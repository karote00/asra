import {
  endTransaction,
  startTransaction,
  subscribeToSelectElements,
  updateTransaction
} from '@asra/reactive-events'
import { elementSelection } from '../selections/element-selection'

export const initElementSelectionSubscribes = () => {
  subscribeToSelectElements(({ payload }) => {
    elementSelection.select(payload.after)

    startTransaction()

    elementSelection.changes.forEach((change) => {
      updateTransaction(change.eventName, change)
    })
    elementSelection.cleanChanges()

    endTransaction()
  })
}
