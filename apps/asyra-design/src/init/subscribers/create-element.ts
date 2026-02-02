/**
 * Subscribers - Simple forwarding layer
 */

import { subscribeToDecideToCreateElement } from '../events'
import { createElementsBehavior } from './../behaviors/create-element'

export const initCreateElementSubscribers = () => {
  subscribeToDecideToCreateElement((payload) => {
    const { position, elementType } = payload as any
    createElementsBehavior(position, elementType)
  })
}
