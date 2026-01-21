import {
  InputType,
  KeyboardKey,
  PointerKey,
  ModifierKey,
  InputSystemEvents,
  PrimaryToolType,
  DetailType
} from '@asra/utils'
import keyMap from './keymap'

export interface InputEventCombo {
  type: InputType
  keys: KeyboardKey[]
  modifiers?: ModifierKey[]
  detail?: DetailType
}

export const InputEventMappings: Record<InputSystemEvents, InputEventCombo[]> =
  {
    [InputSystemEvents.INPUT_DRAG_START]: [
      { type: InputType.POINTER, keys: [PointerKey.LEFT_MOUSE_DOWN] }
    ],
    [InputSystemEvents.INPUT_DRAG_UPDATE]: [
      {
        type: InputType.POINTER,
        keys: [PointerKey.LEFT_MOUSE_DOWN, PointerKey.LEFT_MOUSE_MOVE]
      }
    ],
    [InputSystemEvents.INPUT_DRAG_END]: [
      { type: InputType.POINTER, keys: [PointerKey.LEFT_MOUSE_UP] }
    ],
    [InputSystemEvents.INPUT_MOUSE_MOVE]: [
      {
        type: InputType.POINTER,
        keys: [PointerKey.LEFT_MOUSE_MOVE]
      }
    ],
    [InputSystemEvents.INPUT_WHEEL_SCROLL]: [
      { type: InputType.WHEEL, keys: [PointerKey.WHEEL] }
    ],
    [InputSystemEvents.INPUT_SHORTCUT_ARROW]: [
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
    [InputSystemEvents.INPUT_SHORTCUT_UNDOREDO]: [
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
    [InputSystemEvents.INPUT_SHORTCUT_ZOOM_PRESET]: [
      {
        type: InputType.KEYBOARD,
        keys: [keyMap.keys.Digit1],
        modifiers: [ModifierKey.META]
      }
    ],
    [InputSystemEvents.INPUT_SHORTCUT_SWITCH_PRIMARY_TOOL]: [
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
