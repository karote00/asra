import { Unit } from '../enums'

export interface PositionRawData {
  x: number
  y: number
  xUnit: Unit
  yUnit: Unit
}

export interface DimensionRawData {
  width: number
  height: number
  xUnit: Unit
  yUnit: Unit
}

export type PropDataType = PositionRawData | DimensionRawData
