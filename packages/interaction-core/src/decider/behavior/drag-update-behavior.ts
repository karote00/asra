import {
  InteractionEvent,
  PrimaryToolType,
  SystemContextSnapshot
} from '@asyra/utils'
import { decideFromResizeElementRules } from '../rules'

export const decideDragUpdateBehavior = (
  systemContextSnapshot: SystemContextSnapshot
): InteractionEvent | null => {
  const { primaryTool } = systemContextSnapshot

  switch (primaryTool) {
    case PrimaryToolType.SELECT:
      // TODO: area-select
      // return decideFromSelectRules(systemContextSnapshot)
      return null
    case PrimaryToolType.RECTANGLE:
      return decideFromResizeElementRules(systemContextSnapshot)
  }

  return null
}
