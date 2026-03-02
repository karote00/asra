import {
  subscribeToSelectVectorSegments,
  updateTransaction
} from '@asyra/reactive-events'
import { SELECTION_TYPES, type EVENT_OPTIONS } from '@asyra/utils'
import selectionManager from '../selection-manager-instance'

const commitSelectionChanges = (options?: EVENT_OPTIONS) => {
  const vectorSegmentSelection = selectionManager.get(
    SELECTION_TYPES.VECTOR_SEGMENT
  )
  if (!vectorSegmentSelection) {
    return
  }

  vectorSegmentSelection.changes.forEach((change) => {
    const changeOptions = change.options ?? options
    if (changeOptions) {
      updateTransaction(change.eventName, change, changeOptions)
      return
    }

    updateTransaction(change.eventName, change)
  })
  vectorSegmentSelection.cleanChanges()
}

export const initVectorSegmentSelectionSubscribes = () => {
  subscribeToSelectVectorSegments(({ payload, options }) => {
    const vectorSegmentSelection = selectionManager.get(
      SELECTION_TYPES.VECTOR_SEGMENT
    )
    if (!vectorSegmentSelection) {
      return
    }

    vectorSegmentSelection.select(payload.after, options)
    commitSelectionChanges(options)
  })
}
