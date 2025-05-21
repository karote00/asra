import { RootAPIs } from './root'
import { PrimaryToolStateAPIs } from './primary-tool-state'
import { MouseStateAPIs } from './mouse-state'
import { SystemStateAPIs } from './system-state'

export { RootAPIs, PrimaryToolStateAPIs, MouseStateAPIs, SystemStateAPIs }

export type SystemContextAPIs = RootAPIs &
  SystemStateAPIs &
  PrimaryToolStateAPIs &
  MouseStateAPIs

export * from './deps'
