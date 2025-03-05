import { PropertyTypes } from './enum'
import type { PropertyComponentRawData } from './rawDataTypes'
import type { ISetter } from '../setter'
import { Unit } from '../enums'

export interface PropertyAttrs {
  id: string
  type: PropertyTypes
}

export interface PositionAttrs extends PropertyAttrs {
  x: number
  y: number
  xUnit: Unit
  yUnit: Unit
}

export interface DimensionAttrs extends PropertyAttrs {
  width: number
  height: number
  widthUnit: Unit
  heightUnit: Unit
}

export interface IProperty<T extends PropertyAttrs = PropertyAttrs>
  extends ISetter<T> {
  load(data: Partial<PropertyComponentRawData>): void
  save(): PropertyComponentRawData
}

export interface PropertyComponentInstanceTypes extends IProperty {}
export type PropertyComponentInstanceDataTypes = PositionAttrs | DimensionAttrs
