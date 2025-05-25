import { PointerEventData } from './input'
import { InputType, ModifierKey, PointerKey } from '../constants'
import { ModifierKeys } from './key-state'

export type KeyboardKey = string

export type InputKey = KeyboardKey | ModifierKey | PointerKey

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DetailType = Record<string, any>

export interface RawInputEvent {
  type: InputType
  keys: KeyboardKey[]
  modifiers: ModifierKeys
  pointer: PointerEventData
  detail?: DetailType
}
