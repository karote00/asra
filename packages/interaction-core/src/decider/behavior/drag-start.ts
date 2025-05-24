import {
  InteractionEvent,
  PrimaryToolType,
  SystemContextSnapshot
} from '@asra/utils'
import { decideFromSelectRules } from '../rules'
import { decideFromDragStartRules } from '../rules/create-element-rules'

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
