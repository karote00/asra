import { InputSystemEvents as PresetInputSystemEvents } from '@asyra/preset'

export const AppInputSystemEvents = {
  INPUT_SHORTCUT_GROUP: 'input.shortcut.group',
  INPUT_LAYER_HIERARCHY_MOVE: 'input.layerHierarchyMove'
} as const

export const InputSystemEvents = {
  ...PresetInputSystemEvents,
  ...AppInputSystemEvents
} as const

export type InputSystemEvents =
  (typeof InputSystemEvents)[keyof typeof InputSystemEvents]
