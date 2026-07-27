import type { PropertyComponentDefinition } from '@asyra/core'
import { PropertyTypes, createDefaultStroke, isRecord } from '@asyra/utils'

export const strokesPropertyComponentDefinition: PropertyComponentDefinition = {
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

      return createDefaultStroke(item) as unknown as Record<string, unknown>
    },
    toValue: (child, childId) => {
      const fill = child.get('fill')
      return {
        id: childId,
        style: child.get('style'),
        position: child.get('position'),
        width: child.get('width'),
        dash: child.get('dash'),
        gap: child.get('gap'),
        fill: isRecord(fill)
          ? {
              ...fill,
              id: childId,
              type: PropertyTypes.FILL
            }
          : fill,
        joinType: child.get('joinType'),
        capType: child.get('capType'),
        miterAngle: child.get('miterAngle')
      }
    }
  }
}
