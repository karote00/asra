import { DetailType, InteractionActions, InteractionEvent } from '@asra/utils'

export const decideFromSwitchPrimaryToolRules = (
  detail?: DetailType
): InteractionEvent => {
  return {
    type: InteractionActions.ACTION_SWITCH_PRIMARY_TOOL,
    payload: {
      primaryTool: detail?.primaryTool
    }
  }
}
