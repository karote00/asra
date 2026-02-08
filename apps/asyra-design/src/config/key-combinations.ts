import { InputType, ModifierKey, PointerKey, MouseButton } from '@asyra/utils'
import type { RawInputEvent } from '@asyra/utils'
import core from '../contexts'
import keyMap from '@asyra/input-system/src/keymap'
import { InputSystemEvents } from '../constants'
import { PrimaryToolType } from '../constants'

export const keyCombinations = {
  [InputSystemEvents.INPUT_DRAG_START]: [
    {
      type: InputType.POINTER,
      keys: [PointerKey.LEFT_MOUSE_DOWN],
      callback: (raw: RawInputEvent) => {
        const { clientX, clientY, button } = raw.pointer
        core.deps.systemContext.updateMouseState({
          dragStart: { x: clientX, y: clientY },
          position: { x: clientX, y: clientY },
          delta: { x: 0, y: 0 },
          button,
          down: true,
          dragging: false
        })
        core.deps.systemContext.updateKeyState({
          shift: raw.modifiers.shift,
          ctrl: raw.modifiers.ctrl,
          alt: raw.modifiers.alt,
          meta: raw.modifiers.meta
        })
      }
    }
  ],
  [InputSystemEvents.INPUT_DRAG_UPDATE]: [
    {
      type: InputType.POINTER,
      keys: [PointerKey.LEFT_MOUSE_DOWN, PointerKey.LEFT_MOUSE_MOVE],
      callback: (raw: RawInputEvent) => {
        const { clientX, clientY, button } = raw.pointer
        const currentMouse =
          core.deps.systemContext.getSystemContextSnapshot().mouse
        const startPos = currentMouse.dragStart || { x: clientX, y: clientY }

        core.deps.systemContext.updateMouseState({
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
        core.deps.systemContext.updateKeyState({
          shift: raw.modifiers.shift,
          ctrl: raw.modifiers.ctrl,
          alt: raw.modifiers.alt,
          meta: raw.modifiers.meta
        })
      }
    }
  ],
  [InputSystemEvents.INPUT_DRAG_END]: [
    {
      type: InputType.POINTER,
      keys: [PointerKey.LEFT_MOUSE_UP],
      callback: (raw: RawInputEvent) => {
        const { clientX, clientY, button } = raw.pointer
        const currentMouse =
          core.deps.systemContext.getSystemContextSnapshot().mouse
        const startPos = currentMouse.dragStart || { x: clientX, y: clientY }

        core.deps.systemContext.updateMouseState({
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
        core.deps.systemContext.updateKeyState({
          shift: raw.modifiers.shift,
          ctrl: raw.modifiers.ctrl,
          alt: raw.modifiers.alt,
          meta: raw.modifiers.meta
        })
      }
    }
  ],
  [InputSystemEvents.INPUT_MOUSE_MOVE]: [
    {
      type: InputType.POINTER,
      keys: [PointerKey.LEFT_MOUSE_MOVE],
      callback: (raw: RawInputEvent) => {
        const { clientX, clientY, button } = raw.pointer

        core.deps.systemContext.updateMouseState({
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

        core.deps.systemContext.updateMouseState({
          position: { x: clientX, y: clientY },
          delta: { x: deltaX, y: deltaY },
          button: MouseButton.MIDDLE,
          down: false,
          dragging: false
        })
        core.deps.systemContext.updateKeyState({
          shift: raw.modifiers.shift,
          ctrl: raw.modifiers.ctrl,
          alt: raw.modifiers.alt,
          meta: raw.modifiers.meta
        })
      }
    }
  ],
  [InputSystemEvents.INPUT_SHORTCUT_SWITCH_PRIMARY_TOOL]: [
    {
      type: InputType.KEYBOARD,
      keys: [keyMap.keys.KeyR],
      detail: { primaryTool: PrimaryToolType.RECTANGLE },
      callback: (raw: RawInputEvent) => {
        core.deps.systemContext.updateKeyState({
          shift: raw.modifiers.shift,
          ctrl: raw.modifiers.ctrl,
          alt: raw.modifiers.alt,
          meta: raw.modifiers.meta
        })
      }
    },
    {
      type: InputType.KEYBOARD,
      keys: [keyMap.keys.KeyV],
      detail: { primaryTool: PrimaryToolType.SELECT },
      callback: (raw: RawInputEvent) => {
        core.deps.systemContext.updateKeyState({
          shift: raw.modifiers.shift,
          ctrl: raw.modifiers.ctrl,
          alt: raw.modifiers.alt,
          meta: raw.modifiers.meta
        })
      }
    }
  ],
  [InputSystemEvents.INPUT_SHORTCUT_ARROW]: [
    {
      type: InputType.KEYBOARD,
      keys: [keyMap.keys.ArrowUp],
      callback: (raw: RawInputEvent) => {
        core.deps.systemContext.updateKeyState({
          shift: raw.modifiers.shift,
          ctrl: raw.modifiers.ctrl,
          alt: raw.modifiers.alt,
          meta: raw.modifiers.meta
        })
      }
    },
    {
      type: InputType.KEYBOARD,
      keys: [keyMap.keys.ArrowDown],
      callback: (raw: RawInputEvent) => {
        core.deps.systemContext.updateKeyState({
          shift: raw.modifiers.shift,
          ctrl: raw.modifiers.ctrl,
          alt: raw.modifiers.alt,
          meta: raw.modifiers.meta
        })
      }
    },
    {
      type: InputType.KEYBOARD,
      keys: [keyMap.keys.ArrowLeft],
      callback: (raw: RawInputEvent) => {
        core.deps.systemContext.updateKeyState({
          shift: raw.modifiers.shift,
          ctrl: raw.modifiers.ctrl,
          alt: raw.modifiers.alt,
          meta: raw.modifiers.meta
        })
      }
    },
    {
      type: InputType.KEYBOARD,
      keys: [keyMap.keys.ArrowRight],
      callback: (raw: RawInputEvent) => {
        core.deps.systemContext.updateKeyState({
          shift: raw.modifiers.shift,
          ctrl: raw.modifiers.ctrl,
          alt: raw.modifiers.alt,
          meta: raw.modifiers.meta
        })
      }
    }
  ],
  [InputSystemEvents.INPUT_SHORTCUT_UNDOREDO]: [
    {
      type: InputType.KEYBOARD,
      keys: [keyMap.keys.KeyZ],
      modifiers: [ModifierKey.META],
      callback: (raw: RawInputEvent) => {
        core.deps.systemContext.updateKeyState({
          shift: raw.modifiers.shift,
          ctrl: raw.modifiers.ctrl,
          alt: raw.modifiers.alt,
          meta: raw.modifiers.meta
        })
      }
    },
    {
      type: InputType.KEYBOARD,
      keys: [keyMap.keys.KeyZ],
      modifiers: [ModifierKey.CTRL],
      callback: (raw: RawInputEvent) => {
        core.deps.systemContext.updateKeyState({
          shift: raw.modifiers.shift,
          ctrl: raw.modifiers.ctrl,
          alt: raw.modifiers.alt,
          meta: raw.modifiers.meta
        })
      }
    }
  ],
  [InputSystemEvents.INPUT_SHORTCUT_ZOOM_PRESET]: [
    {
      type: InputType.KEYBOARD,
      keys: [keyMap.keys.Digit1],
      modifiers: [ModifierKey.META],
      callback: (raw: RawInputEvent) => {
        core.deps.systemContext.updateKeyState({
          shift: raw.modifiers.shift,
          ctrl: raw.modifiers.ctrl,
          alt: raw.modifiers.alt,
          meta: raw.modifiers.meta
        })
      }
    }
  ]
}

export const featureKeyConfigs = {
  // Remove - now using string keyConfig in defineFeature
}
