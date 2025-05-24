import {
  InteractionEvent,
  PrimaryToolType,
  SystemContextSnapshot
} from '@asra/utils'
import { decideFromDragStartRules, decideFromSelectRules } from '../rules'

export const decideDragStartBehavior = (
  systemContextSnapshot: SystemContextSnapshot
): InteractionEvent | null => {
  const { primaryTool } = systemContextSnapshot

  switch (primaryTool) {
    case PrimaryToolType.SELECT:
      return decideFromSelectRules(systemContextSnapshot)
    case PrimaryToolType.RECTANGLE:
      return decideFromDragStartRules(systemContextSnapshot)
  }

  return null
}
