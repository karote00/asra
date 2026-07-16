import type { PropertyComponentDefinition } from '@asyra/core'
import { PropertyTypes } from '@asyra/utils'

export const customPropertyComponentDefinition: PropertyComponentDefinition = {
  type: PropertyTypes.CUSTOM,
  allowDynamicKeys: true
}
