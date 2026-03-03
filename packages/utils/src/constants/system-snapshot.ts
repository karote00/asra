import { MouseButton } from './pointer'
import { SystemMode } from './system-mode'
import {
  KeySnapshot,
  MouseSnapshot,
  SystemContextSnapshot,
  SystemSnapshot,
  TargetSnapshot
} from '../types'

export const DefaultPosition = { x: 0, y: 0 }

export const DefaultSystemSnapshot: SystemSnapshot = {
  mode: SystemMode.DESIGN,
  featureFlags: {},
  permissions: {}
}

export const DefaultPrimaryTool = 'select'

export const DefaultMoseSnapshot: MouseSnapshot = {
  position: DefaultPosition,
  delta: DefaultPosition,
  button: MouseButton.NONE,
  down: false,
  dragging: false
}

export const DefaultTargetSnapshot: TargetSnapshot = {
  hoveredElementId: null,
  selectedElementIds: [],
  activeElementId: null
}

export const DefaultKeySnapshot: KeySnapshot = {
  meta: false,
  ctrl: false,
  alt: false,
  shift: false
}

export const DefaultSystemContextSnapshot: SystemContextSnapshot = {
  primaryTool: DefaultPrimaryTool,
  systemMode: DefaultSystemSnapshot.mode,
  systemFeatureFlags: DefaultSystemSnapshot.featureFlags,
  systemPermissions: DefaultSystemSnapshot.permissions,
  mouseDragStart: DefaultMoseSnapshot.dragStart,
  mousePosition: DefaultMoseSnapshot.position,
  mouseDelta: DefaultMoseSnapshot.delta,
  mouseButton: DefaultMoseSnapshot.button,
  mouseDown: DefaultMoseSnapshot.down,
  mouseDragging: DefaultMoseSnapshot.dragging,
  keyShift: DefaultKeySnapshot.shift,
  keyCtrl: DefaultKeySnapshot.ctrl,
  keyAlt: DefaultKeySnapshot.alt,
  keyMeta: DefaultKeySnapshot.meta,
  hoveredElementId: DefaultTargetSnapshot.hoveredElementId,
  selectedElementIds: DefaultTargetSnapshot.selectedElementIds,
  activeElementId: DefaultTargetSnapshot.activeElementId
}
