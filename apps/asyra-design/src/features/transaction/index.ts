import { defineFeature } from '@asyra/feature-system'
import { subscribeToUndo, subscribeToRedo } from '@asyra/reactive-events'
import { transactionApis } from '../../common-apis'

export const transactionFeature = defineFeature('transaction', undefined, {
  api: {
    start: () => transactionApis.startTransaction(),
    end: () => transactionApis.endTransaction(),
    undo: () => subscribeToUndo(() => {}),
    redo: () => subscribeToRedo(() => {})
  }
})

export default transactionFeature
