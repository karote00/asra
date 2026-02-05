/**
 * Subscribers - Simple forwarding layer
 *
 * DISABLED: Now using feature-system for create-element
 * Old subscribers disabled to prevent duplicate element creation
 */

import { subscribeToDecideToCreateElement } from '../events'
import { sceneTreeApis } from '../apis'

export const initCreateElementSubscribers = () => {
  // Disabled - moving to feature-system
  // subscribeToDecideToCreateElement((payload) => {
  //   const { position, elementType } = payload as any
  //   sceneTreeApis.createElements(position, elementType)
  // })
}
