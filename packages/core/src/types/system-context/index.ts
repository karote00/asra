import { PrimaryToolAPIs } from './primary-tool'
import { MouseStateAPIs } from './mouse-state'
import { KeyStateAPIs } from './key-state'

export * from './primary-tool'
export * from './mouse-state'
export * from './key-state'

export type SystemContextAPIs = PrimaryToolAPIs & MouseStateAPIs & KeyStateAPIs
