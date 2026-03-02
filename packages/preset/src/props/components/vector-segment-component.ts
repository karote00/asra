import { definePropertyComponent } from '@asyra/core'
import { PropertyTypes } from '@asyra/utils'

definePropertyComponent({
  type: PropertyTypes.VECTOR_SEGMENT,
  defaults: {
    startId: '',
    endId: '',
    outControlId: null,
    inControlId: null
  }
})
