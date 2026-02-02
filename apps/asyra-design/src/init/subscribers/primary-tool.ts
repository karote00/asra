/**
 * Subscribers - Simple forwarding layer
 */

import { subscribeToDecideToSwitchPrimaryTool } from '../events'
import { systemContextApis, uiContextApis } from '../apis'

export const initPrimaryToolSubscribers = () => {
  subscribeToDecideToSwitchPrimaryTool((payload) => {
    const primaryTool = payload?.primaryTool
    systemContextApis.switchPrimaryTool(primaryTool)
    uiContextApis.switchPrimaryTool(primaryTool)
  })
}
