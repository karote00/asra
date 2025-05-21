import { PrimaryToolType } from '../constants'
import { MouseSnapshot } from './input'
import { KeyState } from './key-state'
import { SystemState } from './system-state'
import { TargetState } from './target-state'

export interface SystemSnapshot {
  system: SystemState
  primaryTool: PrimaryToolType
  mouse: MouseSnapshot
  target: TargetState
  key: KeyState
}
