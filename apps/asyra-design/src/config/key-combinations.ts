import {
  InputType,
  ModifierKey,
  PointerKey,
  MouseButton,
  DefaultKeySnapshot,
  DefaultMoseSnapshot,
  DefaultPosition,
  type RawInputEvent,
  type MouseSnapshot
} from '@asyra/utils'
import { keyMap } from '@asyra/core'
import { PresetSystemPropertyKeys } from '@asyra/preset'
import core from '../contexts'
import { InputSystemEvents, PrimaryToolType } from '../constants'

// Helper functions to reduce code duplication
const updateKeyState = (raw: RawInputEvent) => {
  const nextKeyState = {
    ...DefaultKeySnapshot,
    shift: raw.modifiers.shift,
    ctrl: raw.modifiers.ctrl,
    alt: raw.modifiers.alt,
    meta: raw.modifiers.meta
  }

  core.setSystemProperty(PresetSystemPropertyKeys.KEY_SHIFT, nextKeyState.shift)
  core.setSystemProperty(PresetSystemPropertyKeys.KEY_CTRL, nextKeyState.ctrl)
  core.setSystemProperty(PresetSystemPropertyKeys.KEY_ALT, nextKeyState.alt)
  core.setSystemProperty(PresetSystemPropertyKeys.KEY_META, nextKeyState.meta)
}

const getCurrentMouseState = (): MouseSnapshot => ({
  dragStart:
    core.getSystemProperty<MouseSnapshot['dragStart']>(
      PresetSystemPropertyKeys.MOUSE_DRAG_START
    ) ?? DefaultMoseSnapshot.dragStart,
  position:
    core.getSystemProperty<MouseSnapshot['position']>(
      PresetSystemPropertyKeys.MOUSE_POSITION
    ) ?? DefaultMoseSnapshot.position,
  delta:
    core.getSystemProperty<MouseSnapshot['delta']>(
      PresetSystemPropertyKeys.MOUSE_DELTA
    ) ?? DefaultMoseSnapshot.delta,
  button:
    core.getSystemProperty<MouseSnapshot['button']>(
      PresetSystemPropertyKeys.MOUSE_BUTTON
    ) ?? DefaultMoseSnapshot.button,
  down:
    core.getSystemProperty<MouseSnapshot['down']>(
      PresetSystemPropertyKeys.MOUSE_DOWN
    ) ?? DefaultMoseSnapshot.down,
  dragging:
    core.getSystemProperty<MouseSnapshot['dragging']>(
      PresetSystemPropertyKeys.MOUSE_DRAGGING
    ) ?? DefaultMoseSnapshot.dragging
})

const updateMouseState = (mouseState: MouseSnapshot) => {
  const currentDragStart =
    core.getSystemProperty<MouseSnapshot['dragStart']>(
      PresetSystemPropertyKeys.MOUSE_DRAG_START
    ) ?? DefaultMoseSnapshot.dragStart

  core.setSystemProperty(
    PresetSystemPropertyKeys.MOUSE_DRAG_START,
    mouseState.dragStart
      ? { ...mouseState.dragStart }
      : {
          ...(currentDragStart ?? DefaultPosition)
        }
  )
  core.setSystemProperty(PresetSystemPropertyKeys.MOUSE_POSITION, {
    ...mouseState.position
  })
  core.setSystemProperty(PresetSystemPropertyKeys.MOUSE_DELTA, {
    ...mouseState.delta
  })
  core.setSystemProperty(
    PresetSystemPropertyKeys.MOUSE_BUTTON,
    mouseState.button
  )
  core.setSystemProperty(PresetSystemPropertyKeys.MOUSE_DOWN, mouseState.down)
  core.setSystemProperty(
    PresetSystemPropertyKeys.MOUSE_DRAGGING,
    mouseState.dragging
  )
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
        const currentMouse = getCurrentMouseState()
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
        const currentMouse = getCurrentMouseState()
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
          dragging: false
        })
        updateKeyState(raw)
      }
    }
  ],
  [InputSystemEvents.INPUT_DOUBLE_CLICK]: [
    {
      type: InputType.POINTER,
      keys: [PointerKey.MOUSE_DOUBLE_CLICK],
      callback: (raw: RawInputEvent) => {
        const { clientX, clientY, button } = raw.pointer
        updateMouseState({
          position: { x: clientX, y: clientY },
          delta: { x: 0, y: 0 },
          button,
          down: false,
          dragging: false
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
    },
    {
      type: InputType.KEYBOARD,
      keys: [keyMap.keys.KeyO],
      detail: { primaryTool: PrimaryToolType.OVAL },
      callback: updateKeyState
    },
    {
      type: InputType.KEYBOARD,
      keys: [keyMap.keys.KeyP],
      detail: { primaryTool: PrimaryToolType.PEN },
      callback: updateKeyState
    }
  ],
  [InputSystemEvents.INPUT_SHORTCUT_CANCEL]: [
    {
      type: InputType.KEYBOARD,
      keys: [keyMap.keys.Escape],
      callback: updateKeyState
    }
  ],
  [InputSystemEvents.INPUT_SHORTCUT_ENTER]: [
    {
      type: InputType.KEYBOARD,
      keys: [keyMap.keys.Enter],
      callback: updateKeyState
    }
  ],
  [InputSystemEvents.INPUT_SHORTCUT_DELETE]: [
    {
      type: InputType.KEYBOARD,
      keys: [keyMap.keys.Delete],
      callback: updateKeyState
    },
    {
      type: InputType.KEYBOARD,
      keys: [keyMap.keys.Backspace],
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
