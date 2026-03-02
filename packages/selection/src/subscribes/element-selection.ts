import {
  subscribeToSelectElements,
  subscribeToRemoveElement,
  updateTransaction
} from '@asyra/reactive-events'
import { SELECTION_TYPES, type EVENT_OPTIONS } from '@asyra/utils'
import selectionManager from '../selection-manager-instance'

const commitSelectionChanges = (options?: EVENT_OPTIONS) => {
  const elementSelection = selectionManager.get(SELECTION_TYPES.ELEMENT)
  if (!elementSelection) {
    return
  }

  elementSelection.changes.forEach((change) => {
    const changeOptions = change.options ?? options
    if (changeOptions) {
      updateTransaction(change.eventName, change, changeOptions)
      return
    }

    updateTransaction(change.eventName, change)
  })
  elementSelection.cleanChanges()
}

export const initElementSelectionSubscribes = () => {
  subscribeToSelectElements(({ payload, options }) => {
    const elementSelection = selectionManager.get(SELECTION_TYPES.ELEMENT)
    if (!elementSelection) {
      return
    }

    elementSelection.select(payload.after, options)
    commitSelectionChanges(options)
  })

  subscribeToRemoveElement(({ payload, options }) => {
    const removedId = payload.data.id
    if (typeof removedId !== 'string' || removedId.length === 0) {
      return
    }

    const elementSelection = selectionManager.get(SELECTION_TYPES.ELEMENT)
    if (!elementSelection) {
      return
    }

    const current = Array.from(elementSelection.getSelectedIds())
    if (!current.includes(removedId)) {
      return
    }

    const next = current.filter((id) => id !== removedId)
    elementSelection.select(next, options)
    commitSelectionChanges(options)
  })
}
