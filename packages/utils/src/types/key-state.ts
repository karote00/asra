import { ModifierKey } from '../constants/index.js'

export type ModifierKeys = Record<ModifierKey, boolean>

export type KeySnapshot = ModifierKeys
