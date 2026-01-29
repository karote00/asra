import { InputSystemEvents } from '@asyra/utils'
import { InteractionRegistry } from '../registry'
import {
  decideDragStartBehavior,
  decideDragUpdateBehavior,
  decideDragEndBehavior,
  decidePanZoomBehavior,
  decideSwitchPrimaryToolBehavior,
  decideUndoRedoBehavior,
  decideZoomFitBehavior
} from './behavior'

// This replaces the old 'decideInteraction' function.
// Instead of a switch statement, it registers the default product behaviors.
export const initInteractions = (registry: InteractionRegistry) => {
  registry.register(
    InputSystemEvents.INPUT_DRAG_START,
    (snapshot) => decideDragStartBehavior(snapshot)
  )

  registry.register(
    InputSystemEvents.INPUT_DRAG_UPDATE,
    (snapshot) => decideDragUpdateBehavior(snapshot)
  )

  registry.register(
    InputSystemEvents.INPUT_DRAG_END,
    (snapshot) => decideDragEndBehavior(snapshot)
  )

  registry.register(
    InputSystemEvents.INPUT_SHORTCUT_SWITCH_PRIMARY_TOOL,
    (_, detail) => decideSwitchPrimaryToolBehavior(detail)
  )

  registry.register(
    InputSystemEvents.INPUT_SHORTCUT_UNDOREDO,
    (snapshot) => decideUndoRedoBehavior(snapshot)
  )

  registry.register(
    InputSystemEvents.INPUT_SHORTCUT_ZOOM_PRESET,
    () => decideZoomFitBehavior()
  )

  registry.register(
    InputSystemEvents.INPUT_WHEEL_SCROLL,
    (snapshot) => decidePanZoomBehavior(snapshot)
  )
}
