import BasePropertyComponent from './base'
import type {
  PropertyComponentRawData,
  PropertyComponentInstanceTypes
} from '@asyra/utils'

export { BasePropertyComponent }

export type PropertyComponentConstructor = new (
  data: Partial<PropertyComponentRawData>
) => PropertyComponentInstanceTypes
