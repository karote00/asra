import { ModifierKey } from '../constants'

export type ModifierKeys = Record<ModifierKey, boolean>

export interface KeySnapshot {
  alt: boolean
  ctrl: boolean
  shift: boolean
  meta: boolean
  pressedKeys: string[]
}
