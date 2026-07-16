import type { PropertyComponentDefinition } from '@asyra/core'
import { PropertyTypes, createDefaultStroke } from '@asyra/utils'

export const strokePropertyComponentDefinition: PropertyComponentDefinition = {
  type: PropertyTypes.STROKE,
  defaults: createDefaultStroke() as unknown as Record<string, unknown>,
  persistKeys: [
    'style',
    'position',
    'width',
    'dash',
    'gap',
    'fill',
    'joinType',
    'capType',
    'miterAngle'
  ],
  valueKeys: [
    'style',
    'position',
    'width',
    'dash',
    'gap',
    'fill',
    'joinType',
    'capType',
    'miterAngle'
  ]
}
