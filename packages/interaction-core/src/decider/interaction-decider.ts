import {
  InteractionEvent,
  SystemContextSnapshot,
  InputSystemEvents
} from '@asra/utils'
import { decideDragStartBehavior } from './behavior'

export const decideInteraction = (
  eventName: InputSystemEvents,
  systemContextSnapshot: SystemContextSnapshot
): InteractionEvent | null => {
  switch (eventName) {
    case InputSystemEvents.INPUT_DRAG_START:
      return decideDragStartBehavior(systemContextSnapshot)
    default:
      return null
  }
}
