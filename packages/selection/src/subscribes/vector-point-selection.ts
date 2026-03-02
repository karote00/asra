import {
  subscribeToSelectVectorPoints,
  updateTransaction
} from '@asyra/reactive-events'
import { SELECTION_TYPES, type EVENT_OPTIONS } from '@asyra/utils'
import selectionManager from '../selection-manager-instance'

const commitSelectionChanges = (options?: EVENT_OPTIONS) => {
  const vectorPointSelection = selectionManager.get(
    SELECTION_TYPES.VECTOR_POINT
  )
  if (!vectorPointSelection) {
    return
  }

  vectorPointSelection.changes.forEach((change) => {
    const changeOptions = change.options ?? options
    if (changeOptions) {
      updateTransaction(change.eventName, change, changeOptions)
      return
    }

    updateTransaction(change.eventName, change)
  })
  vectorPointSelection.cleanChanges()
}

export const initVectorPointSelectionSubscribes = () => {
  subscribeToSelectVectorPoints(({ payload, options }) => {
    const vectorPointSelection = selectionManager.get(
      SELECTION_TYPES.VECTOR_POINT
    )
    if (!vectorPointSelection) {
      return
    }

    vectorPointSelection.select(payload.after, options)
    commitSelectionChanges(options)
  })
}
