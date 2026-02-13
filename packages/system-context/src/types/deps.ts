import type {
  SystemState,
  PrimaryToolState,
  MouseState,
  KeyState,
  TargetState,
  ManagedPropertyState
} from '../states'

export interface HandlerDeps {
  systemState: SystemState
  primaryToolState: PrimaryToolState
  mouseState: MouseState
  keyState: KeyState
  targetState: TargetState
  managedPropertyState: ManagedPropertyState
}

export interface SystemDeps {
  primaryToolState: PrimaryToolState
  mouseState: MouseState
}
