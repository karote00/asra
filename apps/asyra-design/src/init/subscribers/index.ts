/**
 * All subscribers exported
 * Subscribers forward events to behaviors
 */

import { initTransactionSubscribers } from './transaction'
import { initCreateElementSubscribers } from './create-element'
import { initSelectElementsSubscribers } from './select-elements'
import { initPrimaryToolSubscribers } from './primary-tool'
import { initUndoRedoSubscribers } from './undoredo'
import { initViewportSubscribers } from './viewport'
import { initContextSubscribers } from './contexts'

export const initSubscribers = () => {
  initTransactionSubscribers()
  initCreateElementSubscribers()
  initSelectElementsSubscribers()
  initPrimaryToolSubscribers()
  initUndoRedoSubscribers()
  initViewportSubscribers()
  initContextSubscribers()
}
