import {
  PrimaryToolType,
  InteractionEvent,
  SystemContextSnapshot
} from '@asra/utils'
import { decideSelectBehavior } from './behavior'

export const decideInteraction = (
  systemContextSnapshot: SystemContextSnapshot
): InteractionEvent | null => {
  switch (systemContextSnapshot.primaryTool) {
    case PrimaryToolType.SELECT:
      return decideSelectBehavior(systemContextSnapshot)
    default:
      return null
  }
}
