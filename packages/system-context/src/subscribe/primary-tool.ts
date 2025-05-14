import { subscribeToSwitchPrimaryTool } from '@asra/reactive-events'
import { HandlerDeps } from '../types'

export const initPrimaryToolSubscribe = (
  primaryToolState: HandlerDeps['primaryToolState']
) => {
  subscribeToSwitchPrimaryTool(({ payload }) => {
    primaryToolState.set(payload.tool)
  })
}
