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
  registry.register('input.drag.start', (snapshot) =>
    decideDragStartBehavior(snapshot)
  )

  registry.register('input.drag.update', (snapshot) =>
    decideDragUpdateBehavior(snapshot)
  )

  registry.register('input.drag.end', (snapshot) =>
    decideDragEndBehavior(snapshot)
  )

  registry.register('input.shortcut.switchPrimaryTool', (_, detail) =>
    decideSwitchPrimaryToolBehavior(detail)
  )

  registry.register('input.shortcut.undoredo', (snapshot) =>
    decideUndoRedoBehavior(snapshot)
  )

  registry.register('input.shortcut.zoomPreset', () => decideZoomFitBehavior())

  registry.register('input.wheel.scroll', (snapshot) =>
    decidePanZoomBehavior(snapshot)
  )
}
