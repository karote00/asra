import { InteractionEvent, SystemContextSnapshot } from '@asra/utils'
import { decideUndoRedoRules } from '../rules'

export const decideUndoRedoBehavior = (
  systemContextSnapshot: SystemContextSnapshot
): InteractionEvent => {
  return decideUndoRedoRules(systemContextSnapshot.key)
}
