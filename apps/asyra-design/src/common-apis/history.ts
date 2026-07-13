/**
 * History/Undo-Redo APIs
 * Used in: undo-redo feature, data-change, and other features needing history control
 */

import { undo, redo } from '@asyra/reactive-events'

export const historyApis = {
  /**
   * Undo the last action
   */
  undo,

  /**
   * Redo the previously undone action
   */
  redo
}
