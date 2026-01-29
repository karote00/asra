import core from '@asyra/core'
import {
    decideDragStartBehavior,
    decideDragUpdateBehavior,
    decideDragEndBehavior,
    decidePanZoomBehavior,
    decideSwitchPrimaryToolBehavior,
    decideUndoRedoBehavior,
    decideZoomFitBehavior
} from '@asyra/interaction-core'
import { InputSystemEvents } from '@asyra/utils'

export const initInteractions = () => {
    core.registerInteraction(
        InputSystemEvents.INPUT_DRAG_START,
        (snapshot) => decideDragStartBehavior(snapshot)
    )

    core.registerInteraction(
        InputSystemEvents.INPUT_DRAG_UPDATE,
        (snapshot) => decideDragUpdateBehavior(snapshot)
    )

    core.registerInteraction(
        InputSystemEvents.INPUT_DRAG_END,
        (snapshot) => decideDragEndBehavior(snapshot)
    )

    core.registerInteraction(
        InputSystemEvents.INPUT_SHORTCUT_SWITCH_PRIMARY_TOOL,
        (_, detail) => decideSwitchPrimaryToolBehavior(detail)
    )

    core.registerInteraction(
        InputSystemEvents.INPUT_SHORTCUT_UNDOREDO,
        (snapshot) => decideUndoRedoBehavior(snapshot)
    )

    core.registerInteraction(
        InputSystemEvents.INPUT_SHORTCUT_ZOOM_PRESET,
        () => decideZoomFitBehavior()
    )

    core.registerInteraction(
        InputSystemEvents.INPUT_WHEEL_SCROLL,
        (snapshot) => decidePanZoomBehavior(snapshot)
    )
}
