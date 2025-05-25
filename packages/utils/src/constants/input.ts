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

export enum SpecialEvent {
  WHEEL = 'wheel'
}

export const ZOOM_SMOOTH_RATIO = 0.02

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

export enum InputType {
  KEYBOARD = 'keyboard',
  POINTER = 'pointer',
  WHEEL = 'wheel'
}
