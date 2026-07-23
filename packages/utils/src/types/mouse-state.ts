import { MouseButton } from '../constants'
import { PositionData } from './geometry'

export interface MouseSnapshot {
  dragStart?: PositionData
  position: PositionData
  delta: PositionData
  button: MouseButton
  down: boolean
  dragging: boolean
}
