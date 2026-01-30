import {
  InputType,
  KeyboardKey,
  PointerKey,
  ModifierKey,
  PrimaryToolType,
  DetailType
} from '@asyra/utils'
import keyMap from './keymap'

export interface InputEventCombo {
  type: InputType
  keys: KeyboardKey[]
  modifiers?: ModifierKey[]
  detail?: DetailType
}

export const InputEventMappings: Record<string, InputEventCombo[]> = {
  'input.drag.start': [
    { type: InputType.POINTER, keys: [PointerKey.LEFT_MOUSE_DOWN] }
  ],
  'input.drag.update': [
    {
      type: InputType.POINTER,
      keys: [PointerKey.LEFT_MOUSE_DOWN, PointerKey.LEFT_MOUSE_MOVE]
    }
  ],
  'input.drag.end': [
    { type: InputType.POINTER, keys: [PointerKey.LEFT_MOUSE_UP] }
  ],
  'input.mouse.move': [
    {
      type: InputType.POINTER,
      keys: [PointerKey.LEFT_MOUSE_MOVE]
    }
  ],
  'input.wheel.scroll': [{ type: InputType.WHEEL, keys: [PointerKey.WHEEL] }],
  'input.shortcut.arrow': [
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
  ],
  'input.shortcut.undoredo': [
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
  ],
  'input.shortcut.zoomPreset': [
    {
      type: InputType.KEYBOARD,
      keys: [keyMap.keys.Digit1],
      modifiers: [ModifierKey.META]
    }
  ],
  'input.shortcut.switchPrimaryTool': [
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
}
