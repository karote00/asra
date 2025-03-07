import PositionComponent from './position'
import DimensionComponent from './dimension'

export { PositionComponent, DimensionComponent }
export type PropertyComponentType =
  | typeof PositionComponent
  | typeof DimensionComponent
