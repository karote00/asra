import type { PropertyComponentDefinition } from '@asyra/core'
import { DefaultAnchorPointData, PropertyTypes } from '@asyra/utils'

export const anchorPointPropertyComponentDefinition: PropertyComponentDefinition =
  {
    type: PropertyTypes.ANCHOR_POINT,
    defaults: DefaultAnchorPointData
  }
