import {
  InputType,
  PointerKey,
  ModifierKey,
  PrimaryToolType
} from '@asyra/utils'
import { InputSystemEvents } from '../constants'
import inputSystem from '@asyra/input-system'
import keyMap from '@asyra/input-system/src/keymap'

export const initInputSystem = () => {
  // Drag events
  inputSystem.registry.register(InputSystemEvents.INPUT_DRAG_START, [
    { type: InputType.POINTER, keys: [PointerKey.LEFT_MOUSE_DOWN] }
  ])

  inputSystem.registry.register(InputSystemEvents.INPUT_DRAG_UPDATE, [
    {
      type: InputType.POINTER,
      keys: [PointerKey.LEFT_MOUSE_DOWN, PointerKey.LEFT_MOUSE_MOVE]
    }
  ])

  inputSystem.registry.register(InputSystemEvents.INPUT_DRAG_END, [
    { type: InputType.POINTER, keys: [PointerKey.LEFT_MOUSE_UP] }
  ])

  inputSystem.registry.register(InputSystemEvents.INPUT_MOUSE_MOVE, [
    {
      type: InputType.POINTER,
      keys: [PointerKey.LEFT_MOUSE_MOVE]
    }
  ])

  inputSystem.registry.register(InputSystemEvents.INPUT_WHEEL_SCROLL, [
    { type: InputType.WHEEL, keys: [PointerKey.WHEEL] }
  ])

  // Shortcut events - Arrow keys
  inputSystem.registry.register(InputSystemEvents.INPUT_SHORTCUT_ARROW, [
    {
      type: InputType.KEYBOARD,
      keys: [keyMap.keys.ArrowUp]
    },
    {
      type: InputType.KEYBOARD,
      keys: [keyMap.keys.ArrowDown]
    },
    {
      type: InputType.KEYBOARD,
      keys: [keyMap.keys.ArrowLeft]
    },
    {
      type: InputType.KEYBOARD,
      keys: [keyMap.keys.ArrowRight]
    }
  ])

  // Shortcut events - Undo/Redo
  inputSystem.registry.register(InputSystemEvents.INPUT_SHORTCUT_UNDOREDO, [
    {
      type: InputType.KEYBOARD,
      keys: [keyMap.keys.KeyZ],
      modifiers: [ModifierKey.META]
    },
    {
      type: InputType.KEYBOARD,
      keys: [keyMap.keys.KeyZ],
      modifiers: [ModifierKey.CTRL]
    }
  ])

  // Shortcut events - Zoom preset
  inputSystem.registry.register(InputSystemEvents.INPUT_SHORTCUT_ZOOM_PRESET, [
    {
      type: InputType.KEYBOARD,
      keys: [keyMap.keys.Digit1],
      modifiers: [ModifierKey.META]
    }
  ])

  // Shortcut events - Switch primary tool
  inputSystem.registry.register(
    InputSystemEvents.INPUT_SHORTCUT_SWITCH_PRIMARY_TOOL,
    [
      {
        type: InputType.KEYBOARD,
        keys: [keyMap.keys.KeyR],
        detail: {
          primaryTool: PrimaryToolType.RECTANGLE
        }
      },
      {
        type: InputType.KEYBOARD,
        keys: [keyMap.keys.KeyV],
        detail: {
          primaryTool: PrimaryToolType.SELECT
        }
      }
    ]
  )
}
