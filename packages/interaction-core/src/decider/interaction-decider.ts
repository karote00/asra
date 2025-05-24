import {
  InteractionEvent,
  SystemContextSnapshot,
  InputSystemEvents,
  DetailType
} from '@asra/utils'
import {
  decideDragStartBehavior,
  decideSwitchPrimaryToolBehavior
} from './behavior'

export const decideInteraction = (
  eventName: InputSystemEvents,
  systemContextSnapshot: SystemContextSnapshot,
  detail?: DetailType
): InteractionEvent | null => {
  switch (eventName) {
    case InputSystemEvents.INPUT_DRAG_START:
      return decideDragStartBehavior(systemContextSnapshot)
    case InputSystemEvents.INPUT_SHORTCUT_SWITCH_PRIMARY_TOOL:
      return decideSwitchPrimaryToolBehavior(detail)
    default:
      return null
  }
}
