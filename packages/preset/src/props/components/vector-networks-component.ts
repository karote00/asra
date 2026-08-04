import { VECTOR_TOPOLOGY_NETWORK_ID_TYPE } from '@asyra/core'
import { PropertyTypes } from '@asyra/utils'
import { createChildrenMapPropertyComponentDefinition } from './children-map-property-component.js'

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is string => typeof item === 'string')
}

const toBoolean = (value: unknown, defaultValue = false) =>
  typeof value === 'boolean' ? value : defaultValue

export const vectorNetworksPropertyComponentDefinition =
  createChildrenMapPropertyComponentDefinition({
    type: PropertyTypes.VECTOR_NETWORKS,
    key: 'networks',
    childType: PropertyTypes.VECTOR_NETWORK,
    childIdType: VECTOR_TOPOLOGY_NETWORK_ID_TYPE,
    toChildData: (item) => ({
      pointIds: toStringArray(item.pointIds),
      segmentIds: toStringArray(item.segmentIds),
      closed: toBoolean(item.closed)
    }),
    toValue: (child, childId) => ({
      id: childId,
      pointIds: toStringArray(child.get('pointIds')),
      segmentIds: toStringArray(child.get('segmentIds')),
      closed: toBoolean(child.get('closed'))
    })
  })
