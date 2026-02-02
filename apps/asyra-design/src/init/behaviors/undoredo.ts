/**
 * App-level undo/redo behavior
 */

import core from '@asyra/core'
import { UNDO } from '@asyra/utils'

export const undoBehavior = () => {
  core.deps.factory.undo()
}

export const redoBehavior = () => {
  core.deps.factory.redo()
}

export const undoRedoBehavior = (undoredo: UNDO) => {
  if (undoredo === 'undo') {
    undoBehavior()
  } else if (undoredo === 'redo') {
    redoBehavior()
  }
}
