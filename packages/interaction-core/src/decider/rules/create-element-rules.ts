import {
  InteractionAction,
  InteractionEvent,
  SystemContextSnapshot
} from '@asra/utils'

export const decideFromDragStartRules = (
  systemContextSnapshot: SystemContextSnapshot
): InteractionEvent | null => {
  const { mouse } = systemContextSnapshot
  const interaction: InteractionEvent = {
    type: InteractionAction.ACTION_CREATE_ELEMENT,
    payload: {
      ...mouse.position
    }
  }

  return interaction
}
