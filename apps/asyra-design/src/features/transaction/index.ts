/**
 * Transaction Feature
 * Wraps factory transaction operations in feature API
 */
import core from '../../contexts'
// @ts-ignore - feature-system not fully integrated yet
import { defineFeature, withTransaction } from '@asyra/feature-system'

const packages = core.deps

export const transactionFeature: any = defineFeature(
  'transaction',
  ({ packages }: any) => ({
    api: {
      start: () => packages.factory.startTransaction(),
      update: (change: any) => packages.factory.updateTransaction(change),
      end: () => packages.factory.endTransaction(),
      undo: () => packages.factory.undo(),
      redo: () => packages.factory.redo(),
      wrap: <T>(callback: () => T): T => {
        return withTransaction(packages)(callback)
      }
    },
    define: ({ keys, handle }: any) => {
      keys([
        { keys: 'CmdOrCtrl+Z', type: 'undo' },
        { keys: 'CmdOrCtrl+Shift+Z', type: 'redo' }
      ])

      handle('input.shortcut.undoredo', (snapshot: any) => {
        const isRedo = snapshot.modifiers?.includes('Shift') || false

        return {
          event: 'transaction.undoRedo',
          payload: { type: isRedo ? 'redo' : 'undo' }
        }
      })
    }
  })
)

export default transactionFeature
