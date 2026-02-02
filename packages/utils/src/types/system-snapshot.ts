import { MouseSnapshot } from './mouse-state'
import { KeySnapshot } from './key-state'
import { SystemSnapshot } from './system-state'
import { TargetSnapshot } from './target-state'

export interface SystemContextSnapshot {
  system: SystemSnapshot
  primaryTool: string
  mouse: MouseSnapshot
  target: TargetSnapshot
  key: KeySnapshot
}
