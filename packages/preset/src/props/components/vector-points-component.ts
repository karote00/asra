import {
  VECTOR_HANDLE_MODES,
  VECTOR_TOKENS,
  VECTOR_TOPOLOGY_POINT_ID_TYPE,
  isVectorHandleMode
} from '@asyra/core'
import type { VectorControlRole, VectorPointNode } from '@asyra/core'
import { PropertyTypes } from '@asyra/utils'
import { createChildrenMapPropertyComponentDefinition } from './children-map-property-component'
import { toNumberValue } from './number-value'

type VectorPointKind = VectorPointNode['kind']

const toAnchorType = (value: unknown): 'smooth' | 'sharp' =>
  value === 'smooth' ? 'smooth' : 'sharp'

const toHandleMode = (value: unknown) =>
  isVectorHandleMode(value) ? value : VECTOR_HANDLE_MODES.NONE

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

  return
}

const toStringOrUndefined = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined

export const vectorPointsPropertyComponentDefinition =
  createChildrenMapPropertyComponentDefinition({
    type: PropertyTypes.VECTOR_POINTS,
    key: 'points',
    childType: PropertyTypes.VECTOR_POINT,
    childIdType: VECTOR_TOPOLOGY_POINT_ID_TYPE,
    toChildData: (item) => {
      const kind = toPointKind(item.kind)

      if (kind === VECTOR_TOKENS.POINT.KIND.CONTROL) {
        return {
          kind,
          x: toNumberValue(item.x),
          y: toNumberValue(item.y),
          controlForId: toStringOrUndefined(item.controlForId),
          controlRole: toControlRole(item.controlRole)
        }
      }

      return {
        kind,
        x: toNumberValue(item.x),
        y: toNumberValue(item.y),
        anchorType: toAnchorType(item.anchorType),
        handleMode: toHandleMode(item.handleMode)
      }
    },
    toValue: (child, childId) => {
      const kind = toPointKind(child.get('kind'))
      const x = toNumberValue(child.get('x'))
      const y = toNumberValue(child.get('y'))

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
