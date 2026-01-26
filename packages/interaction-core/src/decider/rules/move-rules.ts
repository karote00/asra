import {
  InteractionActions,
  InteractionEvent,
  SystemContextSnapshot
} from '@asyra/utils'

export const decideFromMoveRules = (
  systemContextSnapshot: SystemContextSnapshot
): InteractionEvent | null => {
  const { mouse, target } = systemContextSnapshot

  if (mouse.dragging && target.selectedElementIds.length > 0) {
    return {
      type: InteractionActions.INTERACTION_MOVE_ELEMENTS,
      payload: { ids: target.selectedElementIds, delta: mouse.delta }
    }
  }

  return null
}
