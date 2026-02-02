/**
 * Subscribers - Simple forwarding layer
 */

import { subscribeToDecideToSelectElements } from '../events'
import { selectionApis } from '../apis'

export const initSelectElementsSubscribers = () => {
  subscribeToDecideToSelectElements((payload) => {
    const { elementIds } = payload as any
    selectionApis.selectElements(elementIds)
  })
}
