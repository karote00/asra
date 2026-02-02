import { SystemContextSnapshot } from '@asyra/utils'
import type { DecisionResult } from '@asyra/interaction-core'
import { decideFromCreateElementRules, decideFromSelectRules } from '../rules'
import { PrimaryToolType } from '../../constants'

export const decideDragStartBehavior = (
  systemContextSnapshot: SystemContextSnapshot
): DecisionResult | null => {
  const { primaryTool } = systemContextSnapshot

  switch (primaryTool) {
    case PrimaryToolType.SELECT:
      return decideFromSelectRules(systemContextSnapshot)
    case PrimaryToolType.RECTANGLE:
      return decideFromCreateElementRules(systemContextSnapshot)
  }

  return null
}
