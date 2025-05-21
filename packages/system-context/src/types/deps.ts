import type { SystemState, PrimaryToolState, MouseState } from '../states'

export interface HandlerDeps {
  systemState: SystemState
  primaryToolState: PrimaryToolState
  mouseState: MouseState
}

export interface SystemDeps {
  primaryToolState: PrimaryToolState
  mouseState: MouseState
}
