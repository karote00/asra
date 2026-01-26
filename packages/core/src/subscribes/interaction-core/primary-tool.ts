import { subscribeToDecideToSwitchPrimaryTool } from '@asyra/reactive-events'
import { PrimaryToolActionAPIs } from '../../types'

export const initPrimaryToolHandlers = (apis: PrimaryToolActionAPIs) => {
  subscribeToDecideToSwitchPrimaryTool(({ payload }) => {
    apis.switchPrimaryTool(payload.primaryTool)
  })
}
