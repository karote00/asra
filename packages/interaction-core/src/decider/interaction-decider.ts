import { PrimaryToolType, InteractionEvent, SystemSnapshot } from '@asra/utils'
import { decideSelectBehavior } from './behavior'

export const decideInteraction = (
  systemSnapshot: SystemSnapshot
): InteractionEvent | null => {
  switch (systemSnapshot.primaryTool) {
    case PrimaryToolType.SELECT:
      return decideSelectBehavior(systemSnapshot)
    default:
      return null
  }
}
