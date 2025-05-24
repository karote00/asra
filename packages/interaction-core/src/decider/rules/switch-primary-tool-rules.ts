import {
  DetailType,
  InteractionAction,
  InteractionEvent,
  PrimaryToolType
} from '@asra/utils'

export const decideFromSwitchPrimaryToolRules = (
  detail?: DetailType
): InteractionEvent => {
  let type: InteractionAction =
    InteractionAction.ACTION_SWITCH_PRIMARY_TOOL_TO_SELECT

  if (detail) {
    switch (detail.primaryTool) {
      case PrimaryToolType.SELECT:
        type = InteractionAction.ACTION_SWITCH_PRIMARY_TOOL_TO_SELECT
        break
      case PrimaryToolType.RECTANGLE:
        type = InteractionAction.ACTION_SWITCH_PRIMARY_TOOL_TO_RECTANGLE
        break
    }
  }

  return {
    type
  }
}
