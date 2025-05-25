import { SystemContextSubEvents } from './system-context'
import { PrimaryToolEvents } from './primary-tool'
import { MouseStateEvents } from './mouse-state'
import { KeyStateEvents } from './key-state'

export * from './primary-tool'
export * from './mouse-state'
export * from './system-context'
export * from './key-state'

export type SystemContextEvents = SystemContextSubEvents &
  PrimaryToolEvents &
  MouseStateEvents &
  KeyStateEvents
