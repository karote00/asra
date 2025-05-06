import { Unit } from '../constants'

export const PropAlias: Record<string, string> = {
  x: 'position',
  y: 'position',
  width: 'dimension',
  hieght: 'dimension'
}

export const DefaultPositionData = {
  x: 0,
  y: 0,
  xUnit: Unit.PX,
  yUnit: Unit.PX
}

export const DefaultDimensionData = {
  width: 100,
  height: 100,
  widthUnit: Unit.PX,
  heightUnit: Unit.PX
}
