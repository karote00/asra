import type { PropertyComponentDefinition } from '@asyra/core'
import { DefaultDimensionData, PropertyTypes } from '@asyra/utils'

export const dimensionPropertyComponentDefinition: PropertyComponentDefinition =
  {
    type: PropertyTypes.DIMENSION,
    defaults: DefaultDimensionData
  }
