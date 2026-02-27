import { MouseStateEvents } from './mouse-state'
import { KeyStateEvents } from './key-state'
import { TargetStateEvents } from './target-state'

export * from './mouse-state'
export * from './key-state'
export * from './target-state'

export type SystemContextEvents =
  | MouseStateEvents
  | KeyStateEvents
  | TargetStateEvents
