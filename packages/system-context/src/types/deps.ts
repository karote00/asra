import type {
  SystemState,
  PrimaryToolState,
  MouseState,
  KeyState
} from '../states'

export interface HandlerDeps {
  systemState: SystemState
  primaryToolState: PrimaryToolState
  mouseState: MouseState
  keyState: KeyState
}

export interface SystemDeps {
  primaryToolState: PrimaryToolState
  mouseState: MouseState
}
