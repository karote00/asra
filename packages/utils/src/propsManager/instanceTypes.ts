import { PropertyTypes } from './enum'
import type { PropertyComponentRawData } from './rawDataTypes'
import type { ISetter } from '../setter'
import { Unit } from '../constants'
import { DataTypes, DimensionData, PositionData } from '../types'

export interface BasePropertyAttrs {
  id: string
  type: PropertyTypes
}

export interface PositionAttrs extends BasePropertyAttrs, PositionData {
  xUnit: Unit
  yUnit: Unit
}

export interface DimensionAttrs extends BasePropertyAttrs, DimensionData {
  widthUnit: Unit
  heightUnit: Unit
}

export interface FillAttrs {
  color: number[]
  opacity: number
}

export interface IProperty<T extends BasePropertyAttrs = BasePropertyAttrs>
  extends ISetter<T> {
  load(data: Partial<PropertyComponentRawData>): void
  save(): PropertyComponentRawData
  getValue(): Record<string, DataTypes>
}

export interface Position extends IProperty {}
export interface Dimension extends IProperty {}

export interface PropertyComponentInstanceTypes extends IProperty {}
export type PropertyComponentInstanceDataTypes = PositionAttrs | DimensionAttrs
