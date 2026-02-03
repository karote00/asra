/**
 * Subscribers - Simple forwarding layer
 */

import { subscribeToDecideToSwitchPrimaryTool } from '../events'
import { uiContextApis } from '../apis'
import { systemContext } from '../../contexts'

export const initUIContextSubscribers = () => {
  subscribeToDecideToSwitchPrimaryTool(() => {
    const newPrimaryTool = systemContext.getCurrentPrimaryTool()
    uiContextApis.switchPrimaryTool(newPrimaryTool)
  })
}
