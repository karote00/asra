import {
  InteractionActions,
  InteractionEvent,
  SystemContextSnapshot
} from '@asra/utils'

export const decideFromResizeElementRules = (
  systemContextSnapshot: SystemContextSnapshot
): InteractionEvent | null => {
  const { primaryTool, mouse } = systemContextSnapshot

  const interaction: InteractionEvent = {
    type: InteractionActions.INTERACTION_RESIZE_ELEMENT,
    payload: {
      dragStart: mouse.dragStart,
      position: mouse.position,
      elementType: primaryTool
    }
  }

  return interaction
}
