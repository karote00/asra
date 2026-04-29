import { definePropertyComponent } from '@asyra/core'
import { PropertyTypes, createDefaultStroke } from '@asyra/utils'

definePropertyComponent({
  type: PropertyTypes.STROKE,
  defaults: createDefaultStroke() as unknown as Record<string, unknown>,
  persistKeys: [
    'kind',
    'style',
    'position',
    'width',
    'dashPattern',
    'dashOffset',
    'fill',
    'defaultColorFormat',
    'colorFormat',
    'color',
    'opacity',
    'visible',
    'gradient',
    'joinType',
    'capType',
    'miterAngle'
  ],
  valueKeys: [
    'kind',
    'style',
    'position',
    'width',
    'dashPattern',
    'dashOffset',
    'fill',
    'defaultColorFormat',
    'colorFormat',
    'color',
    'opacity',
    'visible',
    'gradient',
    'joinType',
    'capType',
    'miterAngle'
  ]
})
