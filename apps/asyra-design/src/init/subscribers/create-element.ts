/**
 * Subscribers - Simple forwarding layer
 */

import { subscribeToDecideToCreateElement } from '../events'
import { sceneTreeApis } from '../apis'

export const initCreateElementSubscribers = () => {
  subscribeToDecideToCreateElement((payload) => {
    const { position, elementType } = payload as any
    sceneTreeApis.createElements(position, elementType)
  })
}
