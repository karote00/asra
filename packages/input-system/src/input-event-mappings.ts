import { InputType, KeyboardKey, PointerKey, ModifierKey } from '@asra/utils'
import { InputSystemEvents } from './input-system-events'
import keyMap from './keymap'

export type InputEventCombo = {
  type: InputType
  keys: KeyboardKey[]
  modifiers?: ModifierKey[]
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
        keys: [keyMap.keys.Z],
        modifiers: [ModifierKey.META]
      }
    ],
    [InputSystemEvents.INPUT_SHORTCUT_ZOOM_PRESET]: [
      {
        type: InputType.KEYBOARD,
        keys: [keyMap.keys['1']],
        modifiers: [ModifierKey.META]
      }
    ],
    [InputSystemEvents.INPUT_SHORTCUT_PRIMARY_TOOL]: [
      {
        type: InputType.KEYBOARD,
        keys: [keyMap.keys.R]
      },
      {
        type: InputType.KEYBOARD,
        keys: [keyMap.keys.V]
      }
    ]
  }
