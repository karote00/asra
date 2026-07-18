import type { PropertyComponentDefinition } from '@asyra/core'
import { PropertyTypes, createDefaultStroke } from '@asyra/utils'

const {
  id: _strokeId,
  type: _strokeType,
  ...strokePropertyDefaults
} = createDefaultStroke()

export const strokePropertyComponentDefinition: PropertyComponentDefinition = {
  type: PropertyTypes.STROKE,
  defaults: strokePropertyDefaults,
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
