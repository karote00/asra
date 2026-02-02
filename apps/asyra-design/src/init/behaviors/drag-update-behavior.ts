import { SystemContextSnapshot } from '@asyra/utils'
import type { DecisionResult } from '@asyra/interaction-core'
import { decideFromResizeElementRules } from '../rules'
import { PrimaryToolType } from '../../constants'

export const decideDragUpdateBehavior = (
  systemContextSnapshot: SystemContextSnapshot
): DecisionResult | null => {
  const { primaryTool } = systemContextSnapshot

  switch (primaryTool) {
    case PrimaryToolType.SELECT:
      return null
    case PrimaryToolType.RECTANGLE:
      return decideFromResizeElementRules(systemContextSnapshot)
  }

  return null
}
