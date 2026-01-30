import {
  InteractionEvent,
  PrimaryToolType,
  SystemContextSnapshot
} from '@asyra/utils'
import { decideFromCreateElementRules, decideFromSelectRules } from '../rules'

export const decideDragStartBehavior = (
  systemContextSnapshot: SystemContextSnapshot
): InteractionEvent | null => {
  const { primaryTool } = systemContextSnapshot

  switch (primaryTool) {
    case PrimaryToolType.SELECT:
      return decideFromSelectRules(systemContextSnapshot)
    case PrimaryToolType.RECTANGLE:
      return decideFromCreateElementRules(systemContextSnapshot)
  }

  return null
}
