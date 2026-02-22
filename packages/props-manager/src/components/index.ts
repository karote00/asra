import PositionComponent from './position'
import DimensionComponent from './dimension'

import CustomComponent from './custom'
import AnchorPointComponent from './anchor-point'
import AnchorPointsComponent from './anchor-points'

export {
  PositionComponent,
  DimensionComponent,
  CustomComponent,
  AnchorPointComponent,
  AnchorPointsComponent
}
export type PropertyComponentType =
  | typeof PositionComponent
  | typeof DimensionComponent
  | typeof CustomComponent
  | typeof AnchorPointComponent
  | typeof AnchorPointsComponent
