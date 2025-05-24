import {
  PrimaryToolType,
  InteractionEvent,
  SystemContextSnapshot,
  InputSystemEvents
} from '@asra/utils'
import { decideSelectBehavior } from './behavior'

export const decideInteraction = (
  eventName: InputSystemEvents,
  systemContextSnapshot: SystemContextSnapshot
): InteractionEvent | null => {
  switch (systemContextSnapshot.primaryTool) {
    case PrimaryToolType.SELECT:
      return decideSelectBehavior(systemContextSnapshot)
    default:
      return null
  }
}
