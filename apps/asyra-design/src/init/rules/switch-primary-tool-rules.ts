import type { DecisionResult } from '@asyra/interaction-core'
import { decideToSwitchPrimaryTool } from '@asyra/reactive-events'
import { DetailType } from '@asyra/utils'

export const decideFromSwitchPrimaryToolRules = (
  detail?: DetailType
): DecisionResult => {
  return {
    type: 'INTERACTION_SWITCH_PRIMARY_TOOL',
    payload: {
      primaryTool: detail?.primaryTool
    },
    handler: (payload: any) => decideToSwitchPrimaryTool(payload.primaryTool)
  }
}
