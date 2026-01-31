import { PrimaryToolType, SystemContextSnapshot } from '@asyra/utils'
import type { DecisionResult } from '@asyra/interaction-core'
import { decideFromResetElementSizeRules } from '../rules'

export const decideDragEndBehavior = (
  systemContextSnapshot: SystemContextSnapshot
): DecisionResult | null => {
  const { primaryTool } = systemContextSnapshot

  switch (primaryTool) {
    case PrimaryToolType.SELECT:
      return null
    case PrimaryToolType.RECTANGLE:
      return decideFromResetElementSizeRules(systemContextSnapshot)
  }
}
