import { DetailType, InteractionActions, InteractionEvent } from '@asyra/utils'

export const decideFromSwitchPrimaryToolRules = (
  detail?: DetailType
): InteractionEvent => {
  return {
    type: InteractionActions.INTERACTION_SWITCH_PRIMARY_TOOL,
    payload: {
      primaryTool: detail?.primaryTool
    }
  }
}
