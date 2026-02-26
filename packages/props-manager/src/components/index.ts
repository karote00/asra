import PositionComponent from './position'
import DimensionComponent from './dimension'

import CustomComponent from './custom'
import AnchorPointComponent from './anchor-point'
import AnchorPointsComponent from './anchor-points'
import type {
  PropertyComponentRawData,
  PropertyComponentInstanceTypes
} from '@asyra/utils'

export {
  PositionComponent,
  DimensionComponent,
  CustomComponent,
  AnchorPointComponent,
  AnchorPointsComponent
}

export type PropertyComponentConstructor = new (
  data: Partial<PropertyComponentRawData>
) => PropertyComponentInstanceTypes

export type PropertyComponentType =
  | typeof PositionComponent
  | typeof DimensionComponent
  | typeof CustomComponent
  | typeof AnchorPointComponent
  | typeof AnchorPointsComponent
