import type { PropertyComponentDefinition } from '@asyra/core'
import { PropertyTypes, createDefaultFill } from '@asyra/utils'

const {
  id: _fillId,
  type: _fillType,
  ...fillPropertyDefaults
} = createDefaultFill()

export const fillPropertyComponentDefinition: PropertyComponentDefinition = {
  type: PropertyTypes.FILL,
  defaults: fillPropertyDefaults,
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
