import { RootAPIs } from './root'
import { SystemStateAPIs } from './system-state'
import { PrimaryToolStateAPIs } from './primary-tool-state'
import { MouseStateAPIs } from './mouse-state'
import { KeyStateAPIs } from './key-state'
import { TargetStateAPIs } from './target-state'
import { ManagedPropertyStateAPIs } from './managed-property-state'

export {
  RootAPIs,
  SystemStateAPIs,
  PrimaryToolStateAPIs,
  MouseStateAPIs,
  KeyStateAPIs,
  TargetStateAPIs,
  ManagedPropertyStateAPIs
}

export type SystemContextAPIs = RootAPIs &
  SystemStateAPIs &
  PrimaryToolStateAPIs &
  MouseStateAPIs &
  KeyStateAPIs &
  TargetStateAPIs &
  ManagedPropertyStateAPIs

export * from './deps'
