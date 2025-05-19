import { InteractionEvent, SystemSnapshot } from '@asra/utils'
import { decideFromSelectRules, decideFromMoveRules } from '../rules'

export const decideSelectBehavior = (
  snapshot: SystemSnapshot
): InteractionEvent | null => {
  const { mouse, target } = snapshot

  if (mouse.dragging && target.selectedElementIds.length > 0) {
    return decideFromMoveRules(snapshot)
  }

  return decideFromSelectRules(snapshot)
}
