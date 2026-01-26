import { decideToSwitchPrimaryTool } from '@asyra/reactive-events'
import { InteractionActions, InteractionEvent } from '@asyra/utils'

export const PrimaryToolHandlers = {
  [InteractionActions.INTERACTION_SWITCH_PRIMARY_TOOL]: (
    payload?: InteractionEvent['payload'],
    options?: InteractionEvent['options']
  ) => {
    decideToSwitchPrimaryTool(payload.primaryTool)
  }
}
