import {
  finishRequestCurrentPrimaryTool,
  subscribeToRequestCurrentPrimaryTool,
  subscribeToSwitchPrimaryTool
} from '@asyra/reactive-events'
import { PrimaryToolStateAPIs } from '../types'

export const initPrimaryToolStateSubscribe = (apis: PrimaryToolStateAPIs) => {
  subscribeToSwitchPrimaryTool(({ payload }) => {
    apis.switchPrimaryTool(payload.tool)
  })

  subscribeToRequestCurrentPrimaryTool(({ payload }) => {
    const primaryTool = apis.getCurrentPrimaryTool()
    finishRequestCurrentPrimaryTool(payload.requestId, primaryTool)
  })
}
