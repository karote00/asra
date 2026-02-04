/**
 * All subscribers exported
 * Subscribers forward events to behaviors
 */

import { initTransactionSubscribers } from './transaction'
import { initCreateElementSubscribers } from './create-element'
import { initSelectElementsSubscribers } from './select-elements'
import { initUndoRedoSubscribers } from './undoredo'
import { initViewportSubscribers } from './viewport'
import { initUIContextSubscribers } from './ui-context'

export const initSubscribers = () => {
  initTransactionSubscribers()
  initCreateElementSubscribers()
  initSelectElementsSubscribers()
  initUndoRedoSubscribers()
  initViewportSubscribers()
  initUIContextSubscribers()
}
