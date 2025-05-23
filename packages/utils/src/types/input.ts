import { MouseButton } from '../constants'

// export interface KeyPressSnapshot {
//   key: string
//   code: string
// }

// export interface KeyboardSnapshot {
//   keysDown: Set<string>
//   modifiers: ModifierKeys
//   lastKeyPress?: KeyPressSnapshot
// }

// export interface WheelSnapshot {
//   deltaX: number
//   deltaY: number
//   modifiers: ModifierKeys
// }

// export interface InputSnapshot {
//   mouse: MouseSnapshot
//   keyboard: KeyboardSnapshot
//   wheel?: WheelSnapshot
// }

/** EventData type */
export interface MouseData {
  clientX: number
  clientY: number
}

export interface MouseEventData {
  clientX: number
  clientY: number
  button: MouseButton
}

export interface WheelEventData {
  deltaX: number
  deltaY: number
  deltaZ: number
  clientX: number
  clientY: number
}

export interface PointerEventData {
  clientX: number
  clientY: number
  deltaX: number
  deltaY: number
  deltaZ: number
  button: MouseButton
}
