import {
  acknowledgeTransactionReplayApplied,
  EventTypes,
  getTransactionReplayMode,
  subscribeToSynchronousEvent,
  subscribeToEndTransaction,
  type AddPropertyEvent,
  type RemovePropertyEvent,
  type UpdatePropertyEvent
} from '@asyra/reactive-events'
import type {
  PropertyComponentInstanceDataTypes,
  PropertyComponentInstanceTypes
} from '@asyra/utils'
import propsManager from './props-manager'

interface UpdatePropertyChangePayload {
  id: string
  key: keyof PropertyComponentInstanceDataTypes
  after: PropertyComponentInstanceDataTypes[keyof PropertyComponentInstanceDataTypes]
  ownerElementId?: string
  ownerPropertyName?: string
}

const isUpdatePropertyChangePayload = (
  payload: unknown
): payload is UpdatePropertyChangePayload =>
  typeof payload === 'object' &&
  payload !== null &&
  'id' in payload &&
  typeof payload.id === 'string' &&
  'key' in payload &&
  typeof payload.key === 'string' &&
  'after' in payload

export const initPropXSubscribes = () => {
  subscribeToSynchronousEvent<AddPropertyEvent>(
    EventTypes.ADD_PROPERTY,
    ({ payload, options }) => {
      const replayMode = getTransactionReplayMode()
      if (payload.data.length === 0) {
        propsManager.commitChanges(options)
        return false
      }

      if (replayMode === null) {
        const creationPlan =
          propsManager.preflightNormalizedPropertyCreationBatch(
            payload.data,
            payload.data.map(({ id }) => id)
          )
        const creationBatch = propsManager.runInPropertyCreationBatch(() =>
          propsManager.applyPropertyCreationBatch(creationPlan)
        )
        try {
          acknowledgeTransactionReplayApplied()
          propsManager.commitChanges(options)
          creationBatch.complete()
          return true
        } catch (error) {
          creationBatch.rollback()
          throw error
        }
      }

      const previousProperties: (PropertyComponentInstanceTypes | undefined)[] =
        payload.data.map(({ id }) =>
          typeof id === 'string' ? propsManager.getPropertyById(id) : undefined
        )
      const propComponents = payload.data.map((propData) => {
        let newProperty = propsManager.getRestoreComponentById(
          propData.id as string
        )
        if (newProperty) {
          propsManager.addChangeForAddProperty(newProperty)
        } else {
          newProperty = propsManager.createProperty(propData)
        }
        return newProperty
      })
      propsManager.addProperty(propComponents)
      const applied = propComponents.some(
        (property, index) => property !== previousProperties[index]
      )
      if (applied) {
        acknowledgeTransactionReplayApplied()
      }
      propsManager.commitChanges(options)
      return applied
    }
  )

  subscribeToSynchronousEvent<RemovePropertyEvent>(
    EventTypes.REMOVE_PROPERTY,
    ({ payload, options }) => {
      const removedPropertyIds = payload.data.map(
        (propertyData) => propertyData.id as string
      )
      const applied = removedPropertyIds.some((id) =>
        propsManager.getPropertyById(id)
      )

      propsManager.removeProperty(removedPropertyIds, options)
      if (applied) {
        acknowledgeTransactionReplayApplied()
      }
      propsManager.commitChanges(options)
      return applied
    }
  )

  subscribeToSynchronousEvent<UpdatePropertyEvent>(
    EventTypes.UPDATE_PROPERTY,
    ({ payload, options }) => {
      if (!isUpdatePropertyChangePayload(payload)) {
        return false
      }

      const previousChangeCount = propsManager.changes.length
      propsManager.updatePropertyById(
        payload.id,
        payload.key,
        payload.after,
        payload.ownerElementId && payload.ownerPropertyName
          ? {
              ownerElementId: payload.ownerElementId,
              ownerPropertyName: payload.ownerPropertyName
            }
          : undefined,
        options
      )
      const applied = propsManager.changes.length > previousChangeCount
      propsManager.commitChanges(options)
      return applied
    }
  )

  // Property updates can be tracked via scene-tree transaction commits.
  // Ensure stale pending props changes never leak across action boundaries.
  subscribeToEndTransaction(() => {
    propsManager.cleanChanges()
  })
}
