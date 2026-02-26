import {
  PositionComponent,
  DimensionComponent,
  CustomComponent,
  AnchorPointComponent,
  AnchorPointsComponent
} from '@asyra/core'
import { PropertyTypes } from '@asyra/utils'
import type { PresetCoreAPIs } from '../types'

export const registerPropertyComponents = (
  core: Pick<PresetCoreAPIs, 'registerPropertyComponent'>
): void => {
  core.registerPropertyComponent(PropertyTypes.POSITION, PositionComponent)
  core.registerPropertyComponent(PropertyTypes.DIMENSION, DimensionComponent)
  core.registerPropertyComponent(PropertyTypes.CUSTOM, CustomComponent)
  core.registerPropertyComponent(PropertyTypes.ANCHOR_POINT, AnchorPointComponent)
  core.registerPropertyComponent(
    PropertyTypes.ANCHOR_POINTS,
    AnchorPointsComponent
  )
}
