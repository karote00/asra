import { MouseSnapshot } from './mouse-state'
import { KeySnapshot } from './key-state'
import { SystemSnapshot } from './system-state'
import { TargetSnapshot } from './target-state'

export interface SystemContextSnapshot {
  primaryTool: string
  systemMode: SystemSnapshot['mode']
  systemFeatureFlags: SystemSnapshot['featureFlags']
  systemPermissions: SystemSnapshot['permissions']
  mouseDragStart: MouseSnapshot['dragStart']
  mousePosition: MouseSnapshot['position']
  mouseDelta: MouseSnapshot['delta']
  mouseButton: MouseSnapshot['button']
  mouseDown: MouseSnapshot['down']
  mouseDragging: MouseSnapshot['dragging']
  keyShift: KeySnapshot['shift']
  keyCtrl: KeySnapshot['ctrl']
  keyAlt: KeySnapshot['alt']
  keyMeta: KeySnapshot['meta']
  hoveredElementId: string | null
  selectedElementIds: TargetSnapshot['selectedElementIds']
  activeElementId: TargetSnapshot['activeElementId']
  [key: string]: unknown
}

/** Snapshot extended with optional event detail (e.g. from input/render events) */
export type SystemContextSnapshotWithDetail = SystemContextSnapshot & {
  detail?: Record<string, unknown>
}
