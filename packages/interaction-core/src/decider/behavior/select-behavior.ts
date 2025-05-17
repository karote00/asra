import { SystemSnapshot } from '../../snapshot'
import { InteractionEvent } from '../../types'
import { decideFromSelectRules, decideFromMoveRules } from '../rules'

export function decideSelectBehavior(
  snapshot: SystemSnapshot
): InteractionEvent | null {
  const { mouse, target } = snapshot

  if (mouse.dragging && target.selectedElementIds.length > 0) {
    return decideFromMoveRules(snapshot)
  }

  return decideFromSelectRules(snapshot)
}
