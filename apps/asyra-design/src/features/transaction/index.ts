import core from '../../contexts'
import { defineFeature } from '@asyra/feature-system'

export const transactionFeature = defineFeature('transaction', undefined, {
  name: 'transaction',
  api: {
    start: () => core.deps.factory.startTransaction(),
    update: (change: any) => core.deps.factory.updateTransaction(change),
    end: () => core.deps.factory.endTransaction(),
    undo: () => core.deps.factory.undo(),
    redo: () => core.deps.factory.redo()
  },
  define: () => {}
})

export default transactionFeature
