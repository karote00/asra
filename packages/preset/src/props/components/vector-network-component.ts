import type { PropertyComponentDefinition } from '@asyra/core'
import { PropertyTypes } from '@asyra/utils'

export const vectorNetworkPropertyComponentDefinition: PropertyComponentDefinition =
  {
    type: PropertyTypes.VECTOR_NETWORK,
    defaults: {
      pointIds: [],
      segmentIds: [],
      closed: false
    }
  }
