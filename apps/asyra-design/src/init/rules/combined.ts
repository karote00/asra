/**
 * Combined Drag Update Rule
 * Handles moving elements (partial refactor - 80% complete)
 * Note: Rectangle create/resize is handled by feature-system
 */

import type { DecisionResult } from '@asyra/interaction-core'
import { SystemContextSnapshot } from '@asyra/utils'
import { decideFromMoveRules } from './move-rules'
import { PrimaryToolType } from '../../constants'

export const decideDragUpdateRules = (
  systemContextSnapshot: SystemContextSnapshot
): DecisionResult | null => {
  const { primaryTool } = systemContextSnapshot

  switch (primaryTool) {
    // Note: PrimaryToolType.RECTANGLE is now handled by feature-system
    case PrimaryToolType.SELECT:
      const moveResult = decideFromMoveRules(systemContextSnapshot)
      if (moveResult) return moveResult
      break
  }

  return null
}
