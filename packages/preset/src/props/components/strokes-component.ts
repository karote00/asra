import { definePropertyComponent } from '@asyra/core'
import { PropertyTypes, createDefaultStroke } from '@asyra/utils'

definePropertyComponent({
  type: PropertyTypes.STROKES,
  defaults: { strokes: [] as string[] },
  persistKeys: ['strokes'],
  valueKeys: ['strokes'],
  children: {
    key: 'strokes',
    childType: PropertyTypes.STROKE,
    mode: 'ids-or-objects',
    toChildData: (item) => {
      if (typeof item !== 'object' || item === null || Array.isArray(item)) {
        return null
      }

      return {
        ...createDefaultStroke(),
        ...item
      }
    },
    toValue: (child, childId) => ({
      id: childId,
      kind: child.get('kind'),
      style: child.get('style'),
      position: child.get('position'),
      width: child.get('width'),
      dashPattern: child.get('dashPattern'),
      dashOffset: child.get('dashOffset'),
      defaultColorFormat: child.get('defaultColorFormat'),
      colorFormat: child.get('colorFormat'),
      color: child.get('color'),
      opacity: child.get('opacity'),
      visible: child.get('visible'),
      gradient: child.get('gradient'),
      joinType: child.get('joinType'),
      capType: child.get('capType'),
      miterAngle: child.get('miterAngle')
    })
  }
})
