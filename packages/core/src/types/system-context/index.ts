import { MouseStateAPIs } from './mouse-state'
import { KeyStateAPIs } from './key-state'

export * from './mouse-state'
export * from './key-state'

export type SystemContextAPIs = MouseStateAPIs & KeyStateAPIs
