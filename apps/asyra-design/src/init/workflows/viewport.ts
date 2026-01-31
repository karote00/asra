import type { ModifierKeys, PointerEventData } from '@asyra/utils'
import type { Workflow } from '@asyra/core/types'

export const zoomFitWorkflow: Workflow = {
  // No context update needed for zoom fit shortcut
  contextUpdate:
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    () => {},
  coreAPI: 'executeAction',
  APIArgs: () => ['input.shortcut.zoomPreset']
}

export const wheelScrollWorkflow: Workflow = {
  contextUpdate: (core, raw) => {
    const { clientX, clientY, deltaX, deltaY, button } =
      raw.pointer as PointerEventData
    core.updateMouseState({
      position: {
        x: clientX,
        y: clientY
      },
      delta: {
        x: deltaX,
        y: deltaY
      },
      down: false,
      button: button,
      dragging: false
    })
    core.updateKeyState(raw.modifiers as ModifierKeys)
  },
  coreAPI: 'executeAction',
  APIArgs: () => ['input.wheel.scroll']
}
