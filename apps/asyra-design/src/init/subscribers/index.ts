/**
 * All subscribers exported
 * Subscribers forward events to behaviors
 */

import { initTransactionSubscribers } from './transaction'
import { initUndoRedoSubscribers } from './undoredo'
import { initViewportSubscribers } from './viewport'
import { initUIContextSubscribers } from './ui-context'

export const initSubscribers = () => {
  initTransactionSubscribers()
  initUndoRedoSubscribers()
  initViewportSubscribers()
  initUIContextSubscribers()
}
