import {
  InteractionAction,
  InteractionEvent,
  MouseButton,
  SystemSnapshot
} from '@asra/utils'

export const decideFromSelectRules = (
  snapshot: SystemSnapshot
): InteractionEvent | null => {
  const { mouse, key, target } = snapshot

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
