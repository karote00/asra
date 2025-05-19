import { ModifierKey, MouseButton } from '../constants'
import { PositionData } from './common'

export type ModifierKeys = Record<ModifierKey, boolean>

export type MouseState = {
  position: PositionData
  button: MouseButton
  down: boolean
  dragging: boolean
  modifiers: ModifierKeys
}

export type KeyPress = {
  key: string
  code: string
}

export type KeyboardState = {
  keysDown: Set<string>
  modifiers: ModifierKeys
  lastKeyPress?: KeyPress
}

export type WheelState = {
  deltaX: number
  deltaY: number
  modifiers: ModifierKeys
}

export type InputSnapshot = {
  mouse: MouseState
  keyboard: KeyboardState
  wheel?: WheelState
}

/** EventData type */
export interface MouseEventData {
  clientX: number
  clientY: number
}

export interface WheelEventData {
  deltaX: number
  deltaY: number
  deltaZ: number
  clientX: number
  clientY: number
}
