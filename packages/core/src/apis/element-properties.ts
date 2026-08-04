import type {
  PropertyMutationBatchRequest,
  PreparedPropertyMutationBatch,
  PropertyMutationBatchResult
} from '@asyra/props-manager'
import type {
  ResolvedElementPropertyTargets,
  ElementPropertyTargetRequest
} from '@asyra/scene-tree'
import type { EVENT_OPTIONS } from '@asyra/utils'
import type {
  ElementPropertyAPIs,
  ElementPropertyPatchUpdate,
  ElementPropertyValuesUpdate
} from '../types/element-properties.js'

export interface ElementPropertyRequests {
  resolveElementPropertyTargets: (
    requests: readonly ElementPropertyTargetRequest[]
  ) => ResolvedElementPropertyTargets
  preparePropertyMutationBatch: (
    request: PropertyMutationBatchRequest
  ) => PreparedPropertyMutationBatch
  applyPreparedPropertyMutationBatch: (
    preparedBatch: PreparedPropertyMutationBatch
  ) => PropertyMutationBatchResult
}

const freezeOrderedElementIds = (
  resolvedTargets: ResolvedElementPropertyTargets
): readonly string[] => Object.freeze([...resolvedTargets.orderedElementIds])

export const createElementPropertyAPIs = (
  requests: ElementPropertyRequests
): ElementPropertyAPIs => {
  const applyResolvedTargets = (
    targetRequests: readonly ElementPropertyTargetRequest[],
    options?: EVENT_OPTIONS
  ): readonly string[] => {
    if (targetRequests.length === 0) {
      return Object.freeze([])
    }
    const resolvedTargets =
      requests.resolveElementPropertyTargets(targetRequests)
    const preparedProperties = requests.preparePropertyMutationBatch({
      operations: resolvedTargets.mutations,
      options
    })
    requests.applyPreparedPropertyMutationBatch(preparedProperties)
    return freezeOrderedElementIds(resolvedTargets)
  }

  return {
    updateElementProperties(
      updates: readonly ElementPropertyValuesUpdate[],
      options?: EVENT_OPTIONS
    ) {
      return applyResolvedTargets(
        updates.map(({ elementId, values }) => ({
          kind: 'values',
          elementId,
          values
        })),
        options
      )
    },
    patchElementProperties(
      patches: readonly ElementPropertyPatchUpdate[],
      options?: EVENT_OPTIONS
    ) {
      return applyResolvedTargets(
        patches.map(({ elementId, values, records }) => ({
          kind: 'records',
          elementId,
          ...(values === undefined ? {} : { values }),
          records
        })),
        options
      )
    }
  }
}
