import { PropertyType } from './enum'
import type { PropertyComponentRawData } from './rawDataTypes'
import type { ISetter } from '../setter'
import { Unit } from '../constants'
import { DataTypes, DimensionData, PositionData } from '../types'
import type { AnchorPointType } from './constants'
import type { FillAttrs, FillsAttrs } from './fills'

export interface BasePropertyAttrs {
  id: string
  type: PropertyType
}

export interface PositionAttrs extends BasePropertyAttrs, PositionData {
  xUnit: Unit
  yUnit: Unit
}

export interface DimensionAttrs extends BasePropertyAttrs, DimensionData {
  widthUnit: Unit
  heightUnit: Unit
}

export interface AnchorPointAttrs extends BasePropertyAttrs {
  x: number
  y: number
  pointType: AnchorPointType
  isMove?: boolean
  inHandle: PositionData | null
  outHandle: PositionData | null
}

export interface AnchorPointsAttrs extends BasePropertyAttrs {
  anchorPoints: string[]
}

export interface IProperty<T extends BasePropertyAttrs = BasePropertyAttrs>
  extends ISetter<T> {
  load(data: Partial<PropertyComponentRawData>): void
  save(): PropertyComponentRawData
  getValue(): Record<string, DataTypes>
}

export interface Position extends IProperty {}
export interface Dimension extends IProperty {}

export interface PropertyComponentInstanceTypes
  extends IProperty<PropertyComponentInstanceDataTypes> {}
export type PropertyComponentInstanceDataTypes =
  | PositionAttrs
  | DimensionAttrs
  | FillAttrs
  | FillsAttrs
  | AnchorPointAttrs
  | AnchorPointsAttrs
  | BasePropertyAttrs
