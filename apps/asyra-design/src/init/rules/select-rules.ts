import {
  InteractionActions,
  InteractionEvent,
  MouseButton,
  SystemContextSnapshot
} from '@asyra/utils'

export const decideFromSelectRules = (
  systemContextSnapshot: SystemContextSnapshot
): InteractionEvent | null => {
  // TODO: refactor with targetElements to decide if can select-element, deselect-element or area-selection
  const { mouse, key, target } = systemContextSnapshot

  if (mouse.button === MouseButton.LEFT && !key.shift) {
    return {
      type: InteractionActions.INTERACTION_SELECT_ELEMENTS,
      payload: {
        elementIds: target.hoveredElementId ? [target.hoveredElementId] : []
      }
    }
  }

  return null
}
