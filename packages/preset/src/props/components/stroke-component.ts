import { definePropertyComponent } from '@asyra/core'
import { PropertyTypes, createDefaultStroke } from '@asyra/utils'

definePropertyComponent({
  type: PropertyTypes.STROKE,
  defaults: createDefaultStroke() as unknown as Record<string, unknown>,
  persistKeys: [
    'style',
    'position',
    'width',
    'dashPattern',
    'dashOffset',
    'defaultColorFormat',
    'colorFormat',
    'color',
    'opacity',
    'visible',
    'joinType',
    'capType',
    'miterAngle'
  ],
  valueKeys: [
    'style',
    'position',
    'width',
    'dashPattern',
    'dashOffset',
    'defaultColorFormat',
    'colorFormat',
    'color',
    'opacity',
    'visible',
    'joinType',
    'capType',
    'miterAngle'
  ]
})
