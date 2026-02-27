import { InputSystemEvents as PresetInputSystemEvents } from '@asyra/preset'

export const InputSystemEvents = PresetInputSystemEvents

export type InputSystemEvents =
  (typeof PresetInputSystemEvents)[keyof typeof PresetInputSystemEvents]
