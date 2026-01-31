import { SystemContextSnapshot } from '@asyra/utils'
import type { DecisionResult } from '@asyra/interaction-core'
import { decideUndoRedoRules } from '../rules'

export const decideUndoRedoBehavior = (
  systemContextSnapshot: SystemContextSnapshot
): DecisionResult => {
  return decideUndoRedoRules(systemContextSnapshot.key)
}
