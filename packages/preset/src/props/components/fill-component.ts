import type { PropertyComponentDefinition } from '@asyra/core'
import { PropertyTypes, createDefaultFill } from '@asyra/utils'

export const fillPropertyComponentDefinition: PropertyComponentDefinition = {
  type: PropertyTypes.FILL,
  defaults: createDefaultFill() as unknown as Record<string, unknown>,
  persistKeys: [
    'kind',
    'defaultColorFormat',
    'colorFormat',
    'color',
    'opacity',
    'visible',
    'gradient'
  ],
  valueKeys: [
    'kind',
    'defaultColorFormat',
    'colorFormat',
    'color',
    'opacity',
    'visible',
    'gradient'
  ]
}
