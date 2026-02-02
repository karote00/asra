/**
 * Subscribers - Simple forwarding layer
 */

import { subscribeToDecideToSwitchPrimaryTool } from '../events'
import { systemContextApis } from '../apis'

export const initPrimaryToolSubscribers = () => {
  subscribeToDecideToSwitchPrimaryTool((payload: any) => {
    systemContextApis.switchPrimaryTool(payload.primaryTool)
  })
}
