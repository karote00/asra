import {
  VECTOR_HANDLE_MODES,
  VECTOR_TOKENS,
  VECTOR_TOPOLOGY_POINT_ID_TYPE
} from '@asyra/core'
import type { VectorControlRole, VectorPointNode } from '@asyra/core'
import { PropertyTypes } from '@asyra/utils'
import { defineChildrenMapPropertyComponent } from './children-map-property-component'

type VectorPointKind = VectorPointNode['kind']

const toNumber = (value: unknown, defaultValue = 0) =>
  typeof value === 'number' ? value : defaultValue

const toAnchorType = (value: unknown): 'smooth' | 'sharp' =>
  value === 'smooth' ? 'smooth' : 'sharp'

const toHandleMode = (value: unknown) =>
  value === VECTOR_HANDLE_MODES.NONE ||
  value === VECTOR_HANDLE_MODES.MIRROR_ANGLE ||
  value === VECTOR_HANDLE_MODES.MIRROR_ANGLE_LENGTH
    ? value
    : VECTOR_HANDLE_MODES.NONE

const toPointKind = (value: unknown): VectorPointKind =>
  value === VECTOR_TOKENS.POINT.KIND.CONTROL
    ? VECTOR_TOKENS.POINT.KIND.CONTROL
    : VECTOR_TOKENS.POINT.KIND.ANCHOR

const toControlRole = (value: unknown): VectorControlRole | undefined => {
  if (
    value === VECTOR_TOKENS.CONTROL.ROLE.IN ||
    value === VECTOR_TOKENS.CONTROL.ROLE.OUT
  ) {
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

    if (kind === VECTOR_TOKENS.POINT.KIND.CONTROL) {
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
      anchorType: toAnchorType(item.anchorType),
      handleMode: toHandleMode(item.handleMode)
    }
  },
  toValue: (child, childId) => {
    const kind = toPointKind(child.get('kind'))
    const x = toNumber(child.get('x'))
    const y = toNumber(child.get('y'))

    if (kind === VECTOR_TOKENS.POINT.KIND.CONTROL) {
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
      anchorType: toAnchorType(child.get('anchorType')),
      handleMode: toHandleMode(child.get('handleMode'))
    }
  }
})
