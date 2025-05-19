import { PrimaryToolType, InteractionEvent, SystemSnapshot } from '@asra/utils'
import { decideSelectBehavior } from './behavior'

export const decideInteraction = (
  snapshot: SystemSnapshot
): InteractionEvent | null => {
  switch (snapshot.system.primaryTool) {
    case PrimaryToolType.SELECT:
      return decideSelectBehavior(snapshot)
    default:
      return null
  }
}
