import {
  InteractionEvent,
  PrimaryToolType,
  SystemContextSnapshot
} from '@asyra/utils'
import { decideFromResetElementSizeRules } from '../rules'

export const decideDragEndBehavior = (
  systemContextSnapshot: SystemContextSnapshot
): InteractionEvent | null => {
  const { primaryTool } = systemContextSnapshot

  switch (primaryTool) {
    case PrimaryToolType.SELECT:
      // TODO: end area-select
      // return decideFromSelectRules(systemContextSnapshot)
      return null
    case PrimaryToolType.RECTANGLE:
      return decideFromResetElementSizeRules(systemContextSnapshot)
  }
}
