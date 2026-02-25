import {
  subscribeToSelectElements,
  updateTransaction
} from '@asyra/reactive-events'
import { elementSelection } from '../selections/element-selection'

export const initElementSelectionSubscribes = () => {
  subscribeToSelectElements(({ payload, options }) => {
    elementSelection.select(payload.after, options)

    elementSelection.changes.forEach((change) => {
      const changeOptions = change.options ?? options
      if (changeOptions) {
        updateTransaction(change.eventName, change, changeOptions)
        return
      }

      updateTransaction(change.eventName, change)
    })
    elementSelection.cleanChanges()
  })
}
