/**
 * Subscribers - Simple forwarding layer
 */

import { subscribeToDecideToSelectElements } from '../events'
import { selectElementsBehavior } from './../behaviors/select-elements'

export const initSelectElementsSubscribers = () => {
  subscribeToDecideToSelectElements((payload) => {
    const { elementIds } = payload as any
    selectElementsBehavior(elementIds)
  })
}
