import { defineFeature } from '@asyra/feature-system'
import {
  subscribeToStartTransaction,
  subscribeToEndTransaction,
  subscribeToUndo,
  subscribeToRedo
} from '@asyra/reactive-events'

export const transactionFeature = defineFeature('transaction', undefined, {
  api: {
    start: () => subscribeToStartTransaction(() => {}),
    end: () => subscribeToEndTransaction(() => {}),
    undo: () => subscribeToUndo(() => {}),
    redo: () => subscribeToRedo(() => {})
  }
})

export default transactionFeature
