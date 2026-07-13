import { definePropertyComponent } from '@asyra/core'
import { PropertyTypes } from '@asyra/utils'

definePropertyComponent({
  type: PropertyTypes.VECTOR_NETWORK,
  defaults: {
    pointIds: [],
    segmentIds: [],
    closed: false
  }
})
