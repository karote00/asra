import { VECTOR_TOPOLOGY_SEGMENT_ID_TYPE } from '@asyra/core'
import { PropertyTypes } from '@asyra/utils'
import { createChildrenMapPropertyComponentDefinition } from './children-map-property-component'

const toString = (value: unknown, defaultValue = '') =>
  typeof value === 'string' ? value : defaultValue

const toNullableString = (value: unknown): string | null =>
  typeof value === 'string' ? value : null

export const vectorSegmentsPropertyComponentDefinition =
  createChildrenMapPropertyComponentDefinition({
    type: PropertyTypes.VECTOR_SEGMENTS,
    key: 'segments',
    childType: PropertyTypes.VECTOR_SEGMENT,
    childIdType: VECTOR_TOPOLOGY_SEGMENT_ID_TYPE,
    toChildData: (item) => ({
      startId: toString(item.startId),
      endId: toString(item.endId),
      outControlId: toNullableString(item.outControlId),
      inControlId: toNullableString(item.inControlId)
    }),
    toValue: (child, childId) => ({
      id: childId,
      startId: toString(child.get('startId')),
      endId: toString(child.get('endId')),
      outControlId: toNullableString(child.get('outControlId')),
      inControlId: toNullableString(child.get('inControlId'))
    })
  })
