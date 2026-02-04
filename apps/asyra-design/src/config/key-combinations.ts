import { InputType, ModifierKey, PointerKey } from '@asyra/utils'
import keyMap from '@asyra/input-system/src/keymap'
import { InputSystemEvents } from '../constants'
import { PrimaryToolType } from '../constants'

export const keyCombinations = {
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
    { type: InputType.POINTER, keys: [PointerKey.LEFT_MOUSE_MOVE] }
  ],
  [InputSystemEvents.INPUT_WHEEL_SCROLL]: [
    { type: InputType.WHEEL, keys: [PointerKey.WHEEL] }
  ],
  [InputSystemEvents.INPUT_SHORTCUT_ARROW]: [
    { type: InputType.KEYBOARD, keys: [keyMap.keys.ArrowUp] },
    { type: InputType.KEYBOARD, keys: [keyMap.keys.ArrowDown] },
    { type: InputType.KEYBOARD, keys: [keyMap.keys.ArrowLeft] },
    { type: InputType.KEYBOARD, keys: [keyMap.keys.ArrowRight] }
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
  ]
}

export const featureKeyConfigs = {
  SWITCH_TO_RECTANGLE_TOOL: {
    keys: [keyMap.keys.KeyR],
    event: InputSystemEvents.INPUT_SHORTCUT_SWITCH_PRIMARY_TOOL,
    detail: { primaryTool: PrimaryToolType.RECTANGLE }
  },
  SWITCH_TO_SELECT_TOOL: {
    keys: [keyMap.keys.KeyV],
    event: InputSystemEvents.INPUT_SHORTCUT_SWITCH_PRIMARY_TOOL,
    detail: { primaryTool: PrimaryToolType.SELECT }
  }
}
