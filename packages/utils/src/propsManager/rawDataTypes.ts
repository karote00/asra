import { Unit } from '../constants'
import { PropertyTypes } from './enum'

export interface PropertyRawData {
  id: string
  type: PropertyTypes
}

export interface PositionComponentRawData extends PropertyRawData {
  x: number
  y: number
  xUnit: Unit
  yUnit: Unit
}

export interface DimensionComponentRawData extends PropertyRawData {
  width: number
  height: number
  widthUnit: Unit
  heightUnit: Unit
}

export type PropsComponentRawData = Record<string, PropertyComponentRawData>

export type PropertyComponentRawData =
  | PositionComponentRawData
  | DimensionComponentRawData
