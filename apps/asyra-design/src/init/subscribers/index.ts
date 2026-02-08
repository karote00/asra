/**
 * All subscribers exported
 * Subscribers subscribe to application-level events
 */

import { initUIContextSubscribers } from './ui-context'

export const initSubscribers = () => {
  initUIContextSubscribers()
}
