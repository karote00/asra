import PositionComponent from './position'
import DimensionComponent from './dimension'

import CustomComponent from './custom'

export { PositionComponent, DimensionComponent, CustomComponent }
export type PropertyComponentType =
  | typeof PositionComponent
  | typeof DimensionComponent
  | typeof CustomComponent
