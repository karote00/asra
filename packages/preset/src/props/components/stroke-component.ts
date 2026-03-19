import { definePropertyComponent } from '@asyra/core'
import { PropertyTypes, createDefaultStroke } from '@asyra/utils'

definePropertyComponent({
  type: PropertyTypes.STROKE,
  defaults: createDefaultStroke() as unknown as Record<string, unknown>,
  persistKeys: [
    'style',
    'position',
    'width',
    'dash',
    'gap',
    'defaultColorFormat',
    'colorFormat',
    'color',
    'opacity',
    'visible',
    'joinType',
    'miterAngle'
  ],
  valueKeys: [
    'style',
    'position',
    'width',
    'dash',
    'gap',
    'defaultColorFormat',
    'colorFormat',
    'color',
    'opacity',
    'visible',
    'joinType',
    'miterAngle'
  ]
})
