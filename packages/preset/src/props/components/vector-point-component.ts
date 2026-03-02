import { definePropertyComponent } from '@asyra/core'
import { PropertyTypes } from '@asyra/utils'

definePropertyComponent({
  type: PropertyTypes.VECTOR_POINT,
  defaults: {
    kind: 'anchor',
    anchorType: 'sharp',
    controlForId: undefined as string | undefined,
    controlRole: undefined as 'in' | 'out' | undefined,
    x: 0,
    y: 0
  }
})
