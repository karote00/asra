import type { PropertyComponentDefinition } from '@asyra/core'
import { PropertyTypes, createDefaultFill } from '@asyra/utils'

export const fillsPropertyComponentDefinition: PropertyComponentDefinition = {
  type: PropertyTypes.FILLS,
  defaults: { fills: [] as string[] },
  persistKeys: ['fills'],
  valueKeys: ['fills'],
  children: {
    key: 'fills',
    childType: PropertyTypes.FILL,
    mode: 'ids-or-objects',
    collection: 'array-or-record',
    toChildData: (item, childId) => {
      if (typeof item !== 'object' || item === null || Array.isArray(item)) {
        return null
      }

      return {
        ...createDefaultFill({ id: childId ?? '' }),
        ...item
      }
    },
    toValue: (child, childId) => ({
      id: childId,
      kind: child.get('kind'),
      defaultColorFormat: child.get('defaultColorFormat'),
      colorFormat: child.get('colorFormat'),
      color: child.get('color'),
      opacity: child.get('opacity'),
      visible: child.get('visible'),
      gradient: child.get('gradient')
    })
  }
}
