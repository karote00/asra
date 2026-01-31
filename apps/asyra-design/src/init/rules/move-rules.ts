import type { DecisionResult } from '@asyra/interaction-core'
import { SystemContextSnapshot } from '@asyra/utils'

export const decideFromMoveRules = (
  systemContextSnapshot: SystemContextSnapshot
): DecisionResult | null => {
  const { mouse, target } = systemContextSnapshot

  if (mouse.dragging && target.selectedElementIds.length > 0) {
    return {
      type: 'INTERACTION_MOVE_ELEMENTS',
      payload: { ids: target.selectedElementIds, delta: mouse.delta },
      handler: () => {}
    }
  }

  return null
}
