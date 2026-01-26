import {
  InteractionActions,
  InteractionEvent,
  SystemContextSnapshot
} from '@asyra/utils'

export const decideFromCreateElementRules = (
  systemContextSnapshot: SystemContextSnapshot
): InteractionEvent | null => {
  const { primaryTool, mouse } = systemContextSnapshot
  const interaction: InteractionEvent = {
    type: InteractionActions.INTERACTION_CREATE_ELEMENT,
    payload: {
      position: mouse.position,
      elementType: primaryTool
    }
  }

  return interaction
}
