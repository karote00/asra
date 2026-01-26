import { InteractionEvent, SystemContextSnapshot } from '@asyra/utils'
import { decideUndoRedoRules } from '../rules'

export const decideUndoRedoBehavior = (
  systemContextSnapshot: SystemContextSnapshot
): InteractionEvent => {
  return decideUndoRedoRules(systemContextSnapshot.key)
}
