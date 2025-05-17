import { SystemSnapshot } from '../../snapshot'
import { InteractionAction, InteractionEvent } from '../../types'

export function decideFromMoveRules(
  snapshot: SystemSnapshot
): InteractionEvent | null {
  const { mouse, target } = snapshot

  if (mouse.dragging && target.selectedElementIds.length > 0) {
    return {
      type: InteractionAction.MOVE_ELEMENTS,
      payload: { ids: target.selectedElementIds, delta: mouse.delta }
    }
  }

  return null
}
