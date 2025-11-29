import type {
  SystemState,
  PrimaryToolState,
  MouseState,
  KeyState,
  TargetState
} from '../states'

export interface HandlerDeps {
  systemState: SystemState
  primaryToolState: PrimaryToolState
  mouseState: MouseState
  keyState: KeyState
  targetState: TargetState
}

export interface SystemDeps {
  primaryToolState: PrimaryToolState
  mouseState: MouseState
}
