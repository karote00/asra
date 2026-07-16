import type { PropertyComponentDefinition } from '@asyra/core'
import {
  AnchorPointTypes,
  PropertyTypes,
  createDefaultAnchorPointsData,
  isAnchorPointType,
  type AnchorPointType
} from '@asyra/utils'

const toNumber = (value: unknown, defaultValue = 0) =>
  typeof value === 'number' ? value : defaultValue

const toPointType = (value: unknown): AnchorPointType =>
  isAnchorPointType(value) ? value : AnchorPointTypes.SHARP

const toHandle = (value: unknown): { x: number; y: number } | null => {
  if (!value || typeof value !== 'object') {
    return null
  }

  const handle = value as { x?: unknown; y?: unknown }
  if (typeof handle.x !== 'number' || typeof handle.y !== 'number') {
    return null
  }

  return { x: handle.x, y: handle.y }
}

export const anchorPointsPropertyComponentDefinition: PropertyComponentDefinition =
  {
    type: PropertyTypes.ANCHOR_POINTS,
    defaults: createDefaultAnchorPointsData(),
    children: {
      key: 'anchorPoints',
      childType: PropertyTypes.ANCHOR_POINT,
      mode: 'ids-or-objects',
      toChildData: (item) => ({
        id: typeof item.id === 'string' ? item.id : undefined,
        x: toNumber(item.x),
        y: toNumber(item.y),
        pointType: toPointType(item.type ?? item.pointType),
        isMove: typeof item.isMove === 'boolean' ? item.isMove : undefined,
        inHandle: toHandle(item.inHandle),
        outHandle: toHandle(item.outHandle)
      }),
      toValue: (child, childId) => ({
        id: childId,
        x: toNumber(child.get('x')),
        y: toNumber(child.get('y')),
        type: toPointType(child.get('pointType')),
        isMove:
          typeof child.get('isMove') === 'boolean'
            ? (child.get('isMove') as boolean)
            : undefined,
        inHandle: toHandle(child.get('inHandle')),
        outHandle: toHandle(child.get('outHandle'))
      })
    }
  }
