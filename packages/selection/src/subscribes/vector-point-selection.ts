import {
  subscribeToSelectVectorPoints,
  updateTransaction
} from '@asyra/reactive-events'
import {
  SELECTION_TYPES,
  SharedDataChannelNames,
  type EVENT_OPTIONS
} from '@asyra/utils'
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
    const routedOptions: EVENT_OPTIONS = {
      ...(changeOptions ?? {}),
      shared: changeOptions?.shared ?? SharedDataChannelNames.SELECTION
    }
    updateTransaction(change.eventName, change, routedOptions)
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
