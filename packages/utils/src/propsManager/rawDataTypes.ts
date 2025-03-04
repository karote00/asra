import { Unit } from '../enums'

export interface PositionComponentRawData {
  x: number
  y: number
  xUnit: Unit
  yUnit: Unit
}

export interface DimensionComponentRawData {
  width: number
  height: number
  widthUnit: Unit
  heightUnit: Unit
}

export type PropComponentDataType =
  | PositionComponentRawData
  | DimensionComponentRawData
