import { decideToSwitchPrimaryTool } from '@asra/reactive-events'
import { InteractionActions, InteractionEvent } from '@asra/utils'

export const PrimaryToolHandlers = {
  [InteractionActions.INTERACTION_SWITCH_PRIMARY_TOOL]: (
    payload?: InteractionEvent['payload']
  ) => {
    decideToSwitchPrimaryTool(payload.primaryTool)
  }
}
