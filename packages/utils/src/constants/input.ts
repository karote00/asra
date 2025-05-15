export enum ModifierKey {
  META = 'Meta',
  CTRL = 'Ctrl',
  ALT = 'Alt',
  SHIFT = 'Shift'
}

export const ModifierKeyList = [
  ModifierKey.META,
  ModifierKey.CTRL,
  ModifierKey.ALT,
  ModifierKey.SHIFT
]

export enum MouseButton {
  LEFT = 'Left',
  RIGHT = 'Right',
  MIDDLE = 'Middle',
  NONE = 'None'
}

export const MouseButtonList = [
  MouseButton.LEFT,
  MouseButton.RIGHT,
  MouseButton.MIDDLE,
  MouseButton.NONE
]

export enum SpecialEvent {
  WHEEL = 'Wheel'
}

export const SpecialEventList = [SpecialEvent.WHEEL]

export const InputFieldsList = ['INPUT', 'TEXT', 'TEXTAREA']
