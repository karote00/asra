import {
  SystemState,
  MouseState,
  TargetState,
  KeyState,
  PrimaryToolState
} from '../context'

export interface SystemSnapshot {
  system: SystemState
  primaryTool: PrimaryToolState
  mouse: MouseState
  target: TargetState
  key: KeyState
}
