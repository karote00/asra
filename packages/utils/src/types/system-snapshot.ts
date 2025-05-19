import { MouseState } from './input'
import { KeyState } from './key-state'
import { PrimaryToolState } from './primary-tool-state'
import { SystemState } from './system-state'
import { TargetState } from './target-state'

export interface SystemSnapshot {
  system: SystemState
  primaryTool: PrimaryToolState
  mouse: MouseState
  target: TargetState
  key: KeyState
}
