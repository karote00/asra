import { definePropertyComponent } from '@asyra/core'
import { PropertyTypes, createDefaultFill } from '@asyra/utils'

definePropertyComponent({
  type: PropertyTypes.FILL,
  defaults: createDefaultFill(),
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
})
