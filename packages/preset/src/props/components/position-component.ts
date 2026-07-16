import type { PropertyComponentDefinition } from '@asyra/core'
import { DefaultPositionData, PropertyTypes } from '@asyra/utils'

export const positionPropertyComponentDefinition: PropertyComponentDefinition =
  {
    type: PropertyTypes.POSITION,
    defaults: DefaultPositionData
  }
