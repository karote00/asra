export interface PositionLike {
  x: number
  y: number
}

export interface DimensionLike {
  width: number
  height: number
}

export type Style = PositionLike & DimensionLike
