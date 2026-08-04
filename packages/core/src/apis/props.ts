import type {
  PreparedPropertyMutationBatch,
  PropertyMutationBatchRequest,
  PropertyMutationBatchResult
} from '@asyra/props-manager'
import type {
  ElementPropertyRelation,
  EVENT_OPTIONS,
  PropsComponentRawData,
  PreparedPropsRestore,
  PropsRestoreSnapshot
} from '@asyra/utils'
import type { PropertyComponentValuesUpdate } from '../types/props.js'

export interface PropsRequests {
  propsLoadData: (data: unknown) => void
  propsSaveData: () => PropsComponentRawData
  preflightRestoreProperties: (
    snapshot: PropsRestoreSnapshot,
    ownerRelations: readonly ElementPropertyRelation[]
  ) => PreparedPropsRestore
  applyRestoreProperties: (
    preparedRestore: PreparedPropsRestore,
    options?: EVENT_OPTIONS
  ) => readonly string[]
  preparePropertyMutationBatch: (
    request: PropertyMutationBatchRequest
  ) => PreparedPropertyMutationBatch
  applyPreparedPropertyMutationBatch: (
    preparedBatch: PreparedPropertyMutationBatch
  ) => PropertyMutationBatchResult
}

export const createPropsAPIs = (requests: PropsRequests) => ({
  propsLoadData(data: unknown) {
    requests.propsLoadData(data)
  },
  propsSaveData() {
    return requests.propsSaveData()
  },
  preflightRestoreProperties(
    snapshot: PropsRestoreSnapshot,
    ownerRelations: readonly ElementPropertyRelation[]
  ) {
    return requests.preflightRestoreProperties(snapshot, ownerRelations)
  },
  applyRestoreProperties(
    preparedRestore: PreparedPropsRestore,
    options?: EVENT_OPTIONS
  ) {
    return requests.applyRestoreProperties(preparedRestore, options)
  },
  updatePropertyComponents(
    updates: readonly PropertyComponentValuesUpdate[],
    options?: EVENT_OPTIONS
  ) {
    if (updates.length === 0) {
      return Object.freeze([])
    }
    const preparedBatch = requests.preparePropertyMutationBatch({
      operations: updates.map(({ propertyId, values }) => ({
        kind: 'values',
        propertyId,
        values
      })),
      options
    })
    const result = requests.applyPreparedPropertyMutationBatch(preparedBatch)
    return Object.freeze([...result.orderedPropertyIds])
  }
})
