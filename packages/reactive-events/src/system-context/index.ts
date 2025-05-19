import { PrimaryToolEvents } from './primary-tool'
import { MouseStateEvents } from './mouse-state'

export * from './primary-tool'
export * from './mouse-state'

export type SystemContextEvents = PrimaryToolEvents & MouseStateEvents
