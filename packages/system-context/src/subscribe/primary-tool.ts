import {
  finishRequestCurrentPRimaryTool,
  subscribeToRequestCurrentPrimaryTool,
  subscribeToSwitchPrimaryTool
} from '@asra/reactive-events'
import { PrimaryToolAPIs } from '../types'

export const initPrimaryToolSubscribe = (apis: PrimaryToolAPIs) => {
  subscribeToSwitchPrimaryTool(({ payload }) => {
    apis.switchPrimaryTool(payload.tool)
  })

  subscribeToRequestCurrentPrimaryTool(({ payload }) => {
    const primaryTool = apis.getCurrentPrimaryTool()
    finishRequestCurrentPRimaryTool(payload.requestId, primaryTool)
  })
}
