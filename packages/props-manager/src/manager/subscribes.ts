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
import { getPropertyComponentConfigDefinition } from '../registries/property-component'
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
      const previousProperties: (PropertyComponentInstanceTypes | undefined)[] =
        []
      const observedPropertyIds = new Set<string>()
      const childRelationKeys = new Map<string, string | null>()
      let isFreshCreationBatch = replayMode === null && payload.data.length > 1
      payload.data.forEach((propData) => {
        const propertyId = propData.id
        const previousProperty =
          typeof propertyId === 'string'
            ? propsManager.getPropertyById(propertyId)
            : undefined
        previousProperties.push(previousProperty)
        if (!isFreshCreationBatch) {
          return
        }
        if (
          typeof propertyId !== 'string' ||
          propertyId.length === 0 ||
          observedPropertyIds.has(propertyId) ||
          previousProperty !== undefined ||
          propsManager.getRestoreComponentById(propertyId)
        ) {
          isFreshCreationBatch = false
          return
        }
        observedPropertyIds.add(propertyId)

        const propertyType = propData.type
        if (typeof propertyType !== 'string') {
          return
        }
        if (!childRelationKeys.has(propertyType)) {
          childRelationKeys.set(
            propertyType,
            getPropertyComponentConfigDefinition(propertyType)?.children?.key ??
              null
          )
        }
        const childRelationKey = childRelationKeys.get(propertyType)
        if (!childRelationKey) {
          return
        }
        const childRelationValue = (
          propData as unknown as Record<string, unknown>
        )[childRelationKey]
        if (
          childRelationValue !== undefined &&
          (!Array.isArray(childRelationValue) ||
            childRelationValue.some((child) => typeof child !== 'string'))
        ) {
          isFreshCreationBatch = false
        }
      })
      const freshCreationPlan = isFreshCreationBatch
        ? propsManager.preflightNormalizedPropertyCreationBatch(
            payload.data,
            payload.data.map(({ id }) => id)
          )
        : undefined
      const freshCreationBatch = freshCreationPlan
        ? propsManager.runInPropertyCreationBatch(() =>
            propsManager.applyPropertyCreationBatch(freshCreationPlan)
          )
        : undefined
      const propComponents: PropertyComponentInstanceTypes[] =
        freshCreationBatch === undefined
          ? payload.data.map((propData) => {
              let newProperty
              if (replayMode !== null) {
                newProperty = propsManager.getRestoreComponentById(
                  propData.id as string
                )
                if (newProperty) {
                  propsManager.addChangeForAddProperty(newProperty)
                }
              }

              if (!newProperty) {
                newProperty = propsManager.createProperty(propData)
              }

              return newProperty
            })
          : []
      if (!freshCreationBatch) {
        propsManager.addProperty(propComponents)
      }
      const applied =
        freshCreationBatch !== undefined ||
        propComponents.some(
          (property, index) => property !== previousProperties[index]
        )
      try {
        if (applied) {
          acknowledgeTransactionReplayApplied()
        }
        propsManager.commitChanges(options)
        freshCreationBatch?.complete()
        return applied
      } catch (error) {
        freshCreationBatch?.rollback()
        throw error
      }
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
