import { MouseButton } from './pointer'
import { SystemMode } from './system-mode'
import { PrimaryToolType } from './tool'
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

export const DefaultPrimaryTool: PrimaryToolType = PrimaryToolType.SELECT

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
  system: DefaultSystemSnapshot,
  primaryTool: DefaultPrimaryTool,
  mouse: DefaultMoseSnapshot,
  target: DefaultTargetSnapshot,
  key: DefaultKeySnapshot
}
