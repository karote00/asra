import {
  InteractionActions,
  InteractionEvent,
  MouseButton,
  SystemContextSnapshot
} from '@asra/utils'

export const decideFromSelectRules = (
  systemContextSnapshot: SystemContextSnapshot
): InteractionEvent | null => {
  // TODO: refactor with targetElements to decide if can select-element, deselect-element or area-selection
  const { mouse, key, target } = systemContextSnapshot

  if (
    mouse.button === MouseButton.LEFT &&
    !key.shift &&
    target.hoveredElementId
  ) {
    return {
      type: InteractionActions.ACTION_SELECT_ELEMENTS,
      payload: { id: target.hoveredElementId }
    }
  }

  return null
}
