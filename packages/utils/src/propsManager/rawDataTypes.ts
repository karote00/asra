import { Unit } from '../constants/index.js'
import { PropertyType } from './enum.js'
import type { AnchorPointType } from './constants.js'

export interface PropertyRawData {
  id: string
  type: PropertyType
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

export interface AnchorPointComponentRawData extends PropertyRawData {
  x: number
  y: number
  pointType: AnchorPointType
  isMove?: boolean
  inHandle: { x: number; y: number } | null
  outHandle: { x: number; y: number } | null
}

export interface AnchorPointsComponentRawData extends PropertyRawData {
  anchorPoints: string[]
}

export type CustomComponentRawData = PropertyRawData & Record<string, unknown>

export type PropsComponentRawData = Record<string, PropertyComponentRawData>

export type PropertyComponentRawData =
  | PositionComponentRawData
  | DimensionComponentRawData
  | AnchorPointComponentRawData
  | AnchorPointsComponentRawData
  | CustomComponentRawData
