export interface PositionData {
  x: number
  y: number
}

export interface DimensionData {
  width: number
  height: number
}

export type Style = PositionData & DimensionData
