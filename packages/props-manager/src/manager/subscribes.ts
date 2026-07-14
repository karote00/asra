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
import type { PropertyComponentInstanceDataTypes } from '@asyra/utils'
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
      const previousProperties = payload.data.map((propData) =>
        propsManager.getPropertyById(propData.id as string)
      )
      const propComponents = payload.data.map((propData) => {
        let newProperty
        if (getTransactionReplayMode() !== null) {
          newProperty = propsManager.getRestoreComponentById(
            propData.id as string
          )
        }

        if (!newProperty) {
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
