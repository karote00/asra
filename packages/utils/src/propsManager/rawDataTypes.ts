import { Unit } from '../enums'

export interface PositionComponentRawData {
  id: string
  x: number
  y: number
  xUnit: Unit
  yUnit: Unit
}

export interface DimensionComponentRawData {
  id: string
  width: number
  height: number
  widthUnit: Unit
  heightUnit: Unit
}

export type PropComponentDataType =
  | PositionComponentRawData
  | DimensionComponentRawData
