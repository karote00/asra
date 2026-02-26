import {
  subscribeToSelectElements,
  updateTransaction
} from '@asyra/reactive-events'
import { SELECTION_TYPES } from '@asyra/utils'
import selectionManager from '../selection-manager-instance'

export const initElementSelectionSubscribes = () => {
  subscribeToSelectElements(({ payload, options }) => {
    const elementSelection = selectionManager.get(SELECTION_TYPES.ELEMENT)
    if (!elementSelection) {
      return
    }

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
