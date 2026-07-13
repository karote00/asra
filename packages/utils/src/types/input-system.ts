import { PointerEventData } from './input'
import { InputType, ModifierKey, PointerKey } from '../constants'
import { ModifierKeys } from './key-state'

export type KeyboardKey = string

export type InputKey = KeyboardKey | ModifierKey | PointerKey

export type DetailType = Record<string, unknown>

export interface RawInputEvent {
  type: InputType
  keys: KeyboardKey[]
  modifiers: ModifierKeys
  pointer: PointerEventData
  detail?: DetailType
}
