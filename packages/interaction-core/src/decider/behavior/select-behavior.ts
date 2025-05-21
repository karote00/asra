import { InteractionEvent, SystemSnapshot } from '@asra/utils'
import { decideFromSelectRules, decideFromMoveRules } from '../rules'

export const decideSelectBehavior = (
  systemSnapshot: SystemSnapshot
): InteractionEvent | null => {
  const { mouse, target } = systemSnapshot

  if (mouse.dragging && target.selectedElementIds.length > 0) {
    return decideFromMoveRules(systemSnapshot)
  }

  return decideFromSelectRules(systemSnapshot)
}
