import type { PropertyComponentDefinition } from '@asyra/core'
import { PropertyTypes } from '@asyra/utils'

export const vectorSegmentPropertyComponentDefinition: PropertyComponentDefinition =
  {
    type: PropertyTypes.VECTOR_SEGMENT,
    defaults: {
      startId: '',
      endId: '',
      outControlId: null,
      inControlId: null
    }
  }
