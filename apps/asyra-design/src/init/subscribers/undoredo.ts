/**
 * Subscribers - Simple forwarding layer
 */

import { subscribeToDecideToUndoRedo } from '../events'
import { undoRedoBehavior } from './../behaviors/undoredo'

export const initUndoRedoSubscribers = () => {
  subscribeToDecideToUndoRedo((payload) => {
    undoRedoBehavior(payload as any)
  })
}
