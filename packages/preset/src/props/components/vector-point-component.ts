import {
  VECTOR_TOKENS,
  definePropertyComponent
} from '@asyra/core'
import { PropertyTypes } from '@asyra/utils'

definePropertyComponent({
  type: PropertyTypes.VECTOR_POINT,
  defaults: {
    kind: VECTOR_TOKENS.POINT.KIND.ANCHOR,
    anchorType: 'sharp',
    controlForId: undefined as string | undefined,
    controlRole: undefined as
      | typeof VECTOR_TOKENS.CONTROL.ROLE.IN
      | typeof VECTOR_TOKENS.CONTROL.ROLE.OUT
      | undefined,
    x: 0,
    y: 0
  }
})
