import {
  InteractionAction,
  InteractionEvent,
  MouseButton,
  SystemContextSnapshot
} from '@asra/utils'

export const decideFromSelectRules = (
  systemContextSnapshot: SystemContextSnapshot
): InteractionEvent | null => {
  const { mouse, key, target } = systemContextSnapshot

  if (
    mouse.button === MouseButton.LEFT &&
    !key.shift &&
    target.hoveredElementId
  ) {
    return {
      type: InteractionAction.SELECT_ELEMENTS,
      payload: { id: target.hoveredElementId }
    }
  }

  return null
}
