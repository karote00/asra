import { RootAPIs } from './root'
import { SystemStateAPIs } from './system-state'
import { PrimaryToolStateAPIs } from './primary-tool-state'
import { MouseStateAPIs } from './mouse-state'
import { KeyStateAPIs } from './key-state'
import { TargetStateAPIs } from './target-state'

export {
  RootAPIs,
  SystemStateAPIs,
  PrimaryToolStateAPIs,
  MouseStateAPIs,
  KeyStateAPIs,
  TargetStateAPIs
}

export type SystemContextAPIs = RootAPIs &
  SystemStateAPIs &
  PrimaryToolStateAPIs &
  MouseStateAPIs &
  KeyStateAPIs &
  TargetStateAPIs

export * from './deps'
