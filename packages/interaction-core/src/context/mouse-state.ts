import { MouseButton, PositionData } from '@asra/utils'

export type MouseModifiers = {
  meta: boolean
  shift: boolean
  ctrl: boolean
  alt: boolean
}

export type MouseState = {
  button: MouseButton
  down: boolean
  dragging: boolean
  modifiers: MouseModifiers
  position: PositionData
  delta: PositionData
}
