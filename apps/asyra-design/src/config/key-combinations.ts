import { InputType, ModifierKey, PointerKey, MouseButton } from '@asyra/utils'
import type { RawInputEvent } from '@asyra/utils'
import type { MouseSnapshot } from '@asyra/utils'
import { systemContext } from '../contexts'
import keyMap from '@asyra/input-system/src/keymap'
import { InputSystemEvents } from '../constants'
import { PrimaryToolType } from '../constants'

// Helper functions to reduce code duplication
const updateKeyState = (raw: RawInputEvent) => {
  systemContext.updateKeyState({
    shift: raw.modifiers.shift,
    ctrl: raw.modifiers.ctrl,
    alt: raw.modifiers.alt,
    meta: raw.modifiers.meta
  })
}

const updateMouseState = (mouseState: MouseSnapshot) => {
  systemContext.updateMouseState(mouseState)
}

export const keyCombinations = {
  [InputSystemEvents.INPUT_DRAG_START]: [
    {
      type: InputType.POINTER,
      keys: [PointerKey.LEFT_MOUSE_DOWN],
      callback: (raw: RawInputEvent) => {
        const { clientX, clientY, button } = raw.pointer
        updateMouseState({
          dragStart: { x: clientX, y: clientY },
          position: { x: clientX, y: clientY },
          delta: { x: 0, y: 0 },
          button,
          down: true,
          dragging: false
        })
        updateKeyState(raw)
      }
    }
  ],
  [InputSystemEvents.INPUT_DRAG_UPDATE]: [
    {
      type: InputType.POINTER,
      keys: [PointerKey.LEFT_MOUSE_DOWN, PointerKey.LEFT_MOUSE_MOVE],
      callback: (raw: RawInputEvent) => {
        const { clientX, clientY, button } = raw.pointer
        const currentMouse = systemContext.getSystemContextSnapshot().mouse
        const startPos = currentMouse.dragStart || { x: clientX, y: clientY }

        updateMouseState({
          dragStart: startPos,
          position: { x: clientX, y: clientY },
          delta: {
            x: clientX - startPos.x,
            y: clientY - startPos.y
          },
          button,
          down: true,
          dragging: true
        })
        updateKeyState(raw)
      }
    }
  ],
  [InputSystemEvents.INPUT_DRAG_END]: [
    {
      type: InputType.POINTER,
      keys: [PointerKey.LEFT_MOUSE_UP],
      callback: (raw: RawInputEvent) => {
        const { clientX, clientY, button } = raw.pointer
        const currentMouse = systemContext.getSystemContextSnapshot().mouse
        const startPos = currentMouse.dragStart || { x: clientX, y: clientY }

        updateMouseState({
          dragStart: startPos,
          position: { x: clientX, y: clientY },
          delta: {
            x: clientX - startPos.x,
            y: clientY - startPos.y
          },
          button,
          down: false,
          dragging: true
        })
        updateKeyState(raw)
      }
    }
  ],
  [InputSystemEvents.INPUT_MOUSE_MOVE]: [
    {
      type: InputType.POINTER,
      keys: [PointerKey.LEFT_MOUSE_MOVE],
      callback: (raw: RawInputEvent) => {
        const { clientX, clientY, button } = raw.pointer
        updateMouseState({
          position: { x: clientX, y: clientY },
          delta: { x: 0, y: 0 },
          button,
          down: false,
          dragging: false
        })
      }
    }
  ],
  [InputSystemEvents.INPUT_WHEEL_SCROLL]: [
    {
      type: InputType.WHEEL,
      keys: [PointerKey.WHEEL],
      callback: (raw: RawInputEvent) => {
        const { clientX, clientY, deltaX, deltaY } = raw.pointer
        updateMouseState({
          position: { x: clientX, y: clientY },
          delta: { x: deltaX, y: deltaY },
          button: MouseButton.MIDDLE,
          down: false,
          dragging: false
        })
        updateKeyState(raw)
      }
    }
  ],
  [InputSystemEvents.INPUT_SHORTCUT_SWITCH_PRIMARY_TOOL]: [
    {
      type: InputType.KEYBOARD,
      keys: [keyMap.keys.KeyR],
      detail: { primaryTool: PrimaryToolType.RECTANGLE },
      callback: updateKeyState
    },
    {
      type: InputType.KEYBOARD,
      keys: [keyMap.keys.KeyV],
      detail: { primaryTool: PrimaryToolType.SELECT },
      callback: updateKeyState
    }
  ],
  [InputSystemEvents.INPUT_SHORTCUT_ARROW]: [
    {
      type: InputType.KEYBOARD,
      keys: [keyMap.keys.ArrowUp],
      callback: updateKeyState
    },
    {
      type: InputType.KEYBOARD,
      keys: [keyMap.keys.ArrowDown],
      callback: updateKeyState
    },
    {
      type: InputType.KEYBOARD,
      keys: [keyMap.keys.ArrowLeft],
      callback: updateKeyState
    },
    {
      type: InputType.KEYBOARD,
      keys: [keyMap.keys.ArrowRight],
      callback: updateKeyState
    }
  ],
  [InputSystemEvents.INPUT_SHORTCUT_UNDOREDO]: [
    {
      type: InputType.KEYBOARD,
      keys: [keyMap.keys.KeyZ],
      modifiers: [ModifierKey.META],
      callback: updateKeyState
    },
    {
      type: InputType.KEYBOARD,
      keys: [keyMap.keys.KeyZ],
      modifiers: [ModifierKey.CTRL],
      callback: updateKeyState
    }
  ],
  [InputSystemEvents.INPUT_SHORTCUT_ZOOM_PRESET]: [
    {
      type: InputType.KEYBOARD,
      keys: [keyMap.keys.Digit1],
      modifiers: [ModifierKey.META],
      callback: updateKeyState
    },
    {
      type: InputType.KEYBOARD,
      keys: [keyMap.keys.Digit1],
      modifiers: [ModifierKey.CTRL],
      callback: updateKeyState
    }
  ]
}
