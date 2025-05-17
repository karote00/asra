export enum ModifierKey {
  META = 'meta',
  CTRL = 'ctrl',
  ALT = 'alt',
  SHIFT = 'shift'
}

export const ModifierKeyList = [
  ModifierKey.META,
  ModifierKey.CTRL,
  ModifierKey.ALT,
  ModifierKey.SHIFT
]

export enum MouseButton {
  LEFT = 'left',
  RIGHT = 'right',
  MIDDLE = 'middle',
  NONE = 'none'
}

export const MouseButtonList = [
  MouseButton.LEFT,
  MouseButton.RIGHT,
  MouseButton.MIDDLE,
  MouseButton.NONE
]

export enum SpecialEvent {
  WHEEL = 'wheel'
}

export const SpecialEventList = [SpecialEvent.WHEEL]

export enum InputField {
  INPUT = 'input',
  TEXT = 'text',
  TEXTAREA = 'textarea'
}

export const InputFieldsList = [
  InputField.INPUT,
  InputField.TEXT,
  InputField.TEXTAREA
]
