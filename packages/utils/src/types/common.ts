export interface PositionData {
  x: number
  y: number
}

export interface DimensionData {
  width: number
  height: number
}

export type Style = PositionData & DimensionData

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
