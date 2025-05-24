import { subscribeToDecideSwitchPrimaryTool } from '@asra/reactive-events'
import { PrimaryToolActionAPIs } from '../../types'

export const initPrimaryToolHandlers = (apis: PrimaryToolActionAPIs) => {
  subscribeToDecideSwitchPrimaryTool(({ payload }) => {
    apis.switchPrimaryTool(payload.primaryTool)
  })
}
