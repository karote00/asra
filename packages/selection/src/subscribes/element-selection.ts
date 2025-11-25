import {
  subscribeToSelectElements,
  updateTransaction
} from '@asra/reactive-events'
import { elementSelection } from '../selections/element-selection'

export const initElementSelectionSubscribes = () => {
  subscribeToSelectElements(({ payload }) => {
    console.log('subscribe select element')
    console.log(payload)
    elementSelection.select(payload.after)

    elementSelection.changes.forEach((change) => {
      updateTransaction(change.eventName, change)
    })
    elementSelection.cleanChanges()
  })
}
