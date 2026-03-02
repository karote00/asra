import { VECTOR_TOPOLOGY_POINT_ID_TYPE } from '@asyra/core'
import { PropertyTypes } from '@asyra/utils'
import { defineChildrenMapPropertyComponent } from './children-map-property-component'

const toNumber = (value: unknown, fallback = 0) =>
  typeof value === 'number' ? value : fallback

const toAnchorType = (value: unknown): 'smooth' | 'sharp' =>
  value === 'smooth' ? 'smooth' : 'sharp'

const toPointKind = (value: unknown): 'anchor' | 'control' =>
  value === 'control' ? 'control' : 'anchor'

const toControlRole = (value: unknown): 'in' | 'out' | undefined => {
  if (value === 'in' || value === 'out') {
    return value
  }

  return undefined
}

const toStringOrUndefined = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined

defineChildrenMapPropertyComponent({
  type: PropertyTypes.VECTOR_POINTS,
  key: 'points',
  childType: PropertyTypes.VECTOR_POINT,
  childIdType: VECTOR_TOPOLOGY_POINT_ID_TYPE,
  toChildData: (item) => {
    const kind = toPointKind(item.kind)

    if (kind === 'control') {
      return {
        kind,
        x: toNumber(item.x),
        y: toNumber(item.y),
        controlForId: toStringOrUndefined(item.controlForId),
        controlRole: toControlRole(item.controlRole)
      }
    }

    return {
      kind,
      x: toNumber(item.x),
      y: toNumber(item.y),
      anchorType: toAnchorType(item.anchorType)
    }
  },
  toValue: (child, childId) => {
    const kind = toPointKind(child.get('kind'))
    const x = toNumber(child.get('x'))
    const y = toNumber(child.get('y'))

    if (kind === 'control') {
      return {
        id: childId,
        kind,
        x,
        y,
        controlForId: toStringOrUndefined(child.get('controlForId')),
        controlRole: toControlRole(child.get('controlRole'))
      }
    }

    return {
      id: childId,
      kind,
      x,
      y,
      anchorType: toAnchorType(child.get('anchorType'))
    }
  }
})
