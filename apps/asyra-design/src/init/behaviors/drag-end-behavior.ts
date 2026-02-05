import { SystemContextSnapshot } from '@asyra/utils'
import type { DecisionResult } from '@asyra/interaction-core'
import { PrimaryToolType } from '../../constants'

export const decideDragEndBehavior = (
  systemContextSnapshot: SystemContextSnapshot
): DecisionResult | null => {
  const { primaryTool } = systemContextSnapshot

  switch (primaryTool) {
    case PrimaryToolType.SELECT:
      // Select logic handled by 80% refactored rules
      return null
    case PrimaryToolType.RECTANGLE:
      // Rectangle reset element size handled by feature-system
      return null
  }

  return null
}
