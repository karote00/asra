import type { ModifierKeys, MouseData, PointerEventData } from '@asyra/utils'
import type { Workflow } from '@asyra/core/types'

let isDown = false
let isDrag = false
let startPos: MouseData = {
  clientX: 0,
  clientY: 0
}
let _endPos: MouseData = {
  clientX: 0,
  clientY: 0
}

export const dragStartWorkflow: Workflow = {
  contextUpdate: (core, raw) => {
    const { clientX, clientY, button } = raw.pointer as PointerEventData
    isDown = true
    isDrag = false
    startPos = { clientX, clientY }

    core.updateMouseState({
      dragStart: {
        x: clientX,
        y: clientY
      },
      position: {
        x: clientX,
        y: clientY
      },
      delta: {
        x: 0,
        y: 0
      },
      down: isDown,
      button: button,
      dragging: isDrag
    })
    core.updateKeyState(raw.modifiers as ModifierKeys)
  },
  coreAPI: 'startSession',
  APIArgs: () => ['input.drag.start']
}

export const dragUpdateWorkflow: Workflow = {
  contextUpdate: (core, raw) => {
    const { clientX, clientY, button } = raw.pointer as PointerEventData
    isDrag = true
    _endPos = {
      clientX,
      clientY
    }

    core.updateMouseState({
      position: {
        x: clientX,
        y: clientY
      },
      delta: {
        x: clientX - startPos.clientX,
        y: clientY - startPos.clientY
      },
      down: true,
      button: button,
      dragging: isDrag
    })
    core.updateKeyState(raw.modifiers as ModifierKeys)
  },
  coreAPI: 'updateSession',
  APIArgs: () => ['input.drag.update']
}

export const dragEndWorkflow: Workflow = {
  contextUpdate: (core, raw) => {
    const { clientX, clientY, button } = raw.pointer as PointerEventData

    core.updateMouseState({
      position: {
        x: clientX,
        y: clientY
      },
      delta: {
        x: clientX - startPos.clientX,
        y: clientY - startPos.clientY
      },
      button: button,
      down: isDown,
      dragging: isDrag
    })
    core.updateKeyState(raw.modifiers as ModifierKeys)

    isDown = false
  },
  coreAPI: 'endSession',
  APIArgs: () => ['input.drag.end']
}
