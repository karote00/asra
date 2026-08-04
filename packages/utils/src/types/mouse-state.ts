import { MouseButton } from '../constants/index.js'
import { PositionData } from './geometry.js'

export interface MouseSnapshot {
  dragStart?: PositionData
  position: PositionData
  delta: PositionData
  button: MouseButton
  down: boolean
  dragging: boolean
}
