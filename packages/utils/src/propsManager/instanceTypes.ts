import { PropertyType } from './enum.js'
import type { PropertyComponentRawData } from './rawDataTypes.js'
import type { ISetter } from '../setter.js'
import { Unit } from '../constants/index.js'
import { DataTypes, DimensionData, PositionData } from '../types/index.js'
import type { AnchorPointType } from './constants.js'
import type { FillAttrs, FillsAttrs } from './fills.js'
import type { StrokeAttrs, StrokesAttrs } from './strokes.js'

export interface BasePropertyAttrs {
  id: string
  type: PropertyType
}

export interface PositionAttrs extends BasePropertyAttrs, PositionData {
  rotation: number
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
  | StrokeAttrs
  | StrokesAttrs
  | AnchorPointAttrs
  | AnchorPointsAttrs
  | BasePropertyAttrs
