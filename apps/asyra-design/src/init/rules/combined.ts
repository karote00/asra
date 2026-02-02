/**
 * Combined Drag Update Rule
 * Handles creating, moving, and resizing elements based on primary tool
 */

import type { DecisionResult } from '@asyra/interaction-core'
import { SystemContextSnapshot } from '@asyra/utils'
import { decideFromCreateElementRules } from './create-element-rules'
import { decideFromMoveRules } from './move-rules'
import { PrimaryToolType } from '../../constants'

export const decideDragUpdateRules = (
  systemContextSnapshot: SystemContextSnapshot
): DecisionResult | null => {
  const { primaryTool } = systemContextSnapshot

  switch (primaryTool) {
    case PrimaryToolType.RECTANGLE:
      return decideFromCreateElementRules(systemContextSnapshot)

    case PrimaryToolType.SELECT:
      const moveResult = decideFromMoveRules(systemContextSnapshot)
      if (moveResult) return moveResult
      break
  }

  return null
}
