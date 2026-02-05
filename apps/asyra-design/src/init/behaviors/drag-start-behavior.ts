import { SystemContextSnapshot } from '@asyra/utils'
import type { DecisionResult } from '@asyra/interaction-core'
import { decideFromSelectRules } from '../rules'
import { PrimaryToolType } from '../../constants'

export const decideDragStartBehavior = (
  systemContextSnapshot: SystemContextSnapshot
): DecisionResult | null => {
  const { primaryTool } = systemContextSnapshot

  switch (primaryTool) {
    case PrimaryToolType.SELECT:
      return decideFromSelectRules(systemContextSnapshot)
    // Note: PrimaryToolType.RECTANGLE is now handled by feature-system
    case PrimaryToolType.RECTANGLE:
      return null
  }

  return null
}
