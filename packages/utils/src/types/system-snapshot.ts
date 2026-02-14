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

/** Snapshot extended with optional event detail (e.g. from input/render events) */
export type SystemContextSnapshotWithDetail = SystemContextSnapshot & {
  detail?: Record<string, unknown>
}
