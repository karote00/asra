import core from '../../contexts'
import { InputSystemEvents } from '../../constants'
import { defineFeature } from '@asyra/feature-system'
import { UNDO } from '@asyra/utils'
import {
  subscribeToDecideToStartTransaction,
  subscribeToDecideToEndTransaction
} from '@asyra/reactive-events'

export const transactionFeature = defineFeature('transaction', undefined, {
  name: 'transaction',
  api: {
    start: () => core.deps.factory.startTransaction(),
    end: () => core.deps.factory.endTransaction(),
    undo: () => core.deps.factory.undo(),
    redo: () => core.deps.factory.redo()
  },
  define: ({
    handle
  }: {
    handle: (event: string, callback: (snapshot: any) => any) => void
  }) => {
    handle(InputSystemEvents.INPUT_SHORTCUT_UNDOREDO, (snapshot: any) => {
      const { key } = snapshot
      let undoredo: UNDO | null = null

      if (key.meta && !key.shift) {
        undoredo = UNDO.UNDO
      } else if (key.meta && key.shift) {
        undoredo = UNDO.REDO
      }

      if (undoredo) {
        const api = transactionFeature.api
        if (undoredo === UNDO.UNDO) {
          api.undo()
        } else if (undoredo === UNDO.REDO) {
          api.redo()
        }
      }

      return null
    })

    subscribeToDecideToStartTransaction(() => {
      const api = transactionFeature.api
      api.start()
    })

    subscribeToDecideToEndTransaction(() => {
      const api = transactionFeature.api
      api.end()
    })
  }
})

export default transactionFeature
