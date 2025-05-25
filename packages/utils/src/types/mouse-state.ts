import { MouseButton } from '../constants'
import { PositionData } from './common'

export interface MouseSnapshot {
  position: PositionData
  delta: PositionData
  button: MouseButton
  down: boolean
  dragging: boolean
}
