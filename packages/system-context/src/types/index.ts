import { RootAPIs } from './root'
import { SystemStateAPIs } from './system-state'
import { PrimaryToolStateAPIs } from './primary-tool-state'
import { MouseStateAPIs } from './mouse-state'
import { KeyStateAPIs } from './key-state'

export {
  RootAPIs,
  SystemStateAPIs,
  PrimaryToolStateAPIs,
  MouseStateAPIs,
  KeyStateAPIs
}

export type SystemContextAPIs = RootAPIs &
  SystemStateAPIs &
  PrimaryToolStateAPIs &
  MouseStateAPIs &
  KeyStateAPIs

export * from './deps'
