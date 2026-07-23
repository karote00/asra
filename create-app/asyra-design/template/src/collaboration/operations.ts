import type { SharedDelivery, SharedPublication } from '@asyra/factory'
import { EventTypes, type AllEvent } from '@asyra/reactive-events'
import {
  PROPS_ACTIONS,
  SCENE_TREE_ACTIONS,
  SharedDataChannelNames,
  isRecord
} from '@asyra/utils'
import { isNonBlankString } from './wire-values'

type ProcessOperation = (event: AllEvent) => boolean | undefined
type RunRemoteTransaction = <T>(mutate: () => T) => T

const owns = (value: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key)

const isTypedData = (value: unknown): value is Record<string, unknown> =>
  isRecord(value) && isNonBlankString(value.id) && isNonBlankString(value.type)

const isAddRemoveElement = (
  value: unknown,
  action: SCENE_TREE_ACTIONS,
  eventName: string
): value is Record<string, unknown> =>
  isRecord(value) &&
  value.action === action &&
  value.eventName === eventName &&
  isTypedData(value.data) &&
  (value.parentId === undefined || isNonBlankString(value.parentId)) &&
  (value.index === undefined ||
    (Number.isInteger(value.index) && Number(value.index) >= 0))

const isScalarComputedChange = (
  value: unknown
): value is Record<string, unknown> =>
  isRecord(value) &&
  value.action === SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA &&
  value.eventName === EventTypes.UPDATE_COMPUTED_DATA &&
  isNonBlankString(value.id) &&
  (value.owner === 'raw' || value.owner === 'computed') &&
  isNonBlankString(value.key) &&
  owns(value, 'before') &&
  owns(value, 'after')

const isBatchComputedChange = (
  value: unknown
): value is Record<string, unknown> =>
  isRecord(value) &&
  value.action === SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_BATCH &&
  value.eventName === EventTypes.UPDATE_COMPUTED_DATA &&
  isNonBlankString(value.id) &&
  Array.isArray(value.changes) &&
  value.changes.length > 0 &&
  value.changes.every(
    (change) =>
      isRecord(change) &&
      (change.owner === 'raw' || change.owner === 'computed') &&
      isNonBlankString(change.key) &&
      owns(change, 'before') &&
      owns(change, 'after')
  )

const isComputedPatch = (value: unknown): value is Record<string, unknown> =>
  isRecord(value) &&
  value.action === SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_PATCH &&
  value.eventName === EventTypes.UPDATE_COMPUTED_DATA_PATCH &&
  isNonBlankString(value.id) &&
  isRecord(value.patch) &&
  (isRecord(value.patch.values) || isRecord(value.patch.records))

const isAddRemoveProperties = (
  value: unknown,
  action: PROPS_ACTIONS,
  eventName: string
): value is Record<string, unknown> =>
  isRecord(value) &&
  value.action === action &&
  value.eventName === eventName &&
  Array.isArray(value.data) &&
  value.data.length > 0 &&
  value.data.every(isTypedData)

const isUpdateProperty = (value: unknown): value is Record<string, unknown> =>
  isRecord(value) &&
  value.action === PROPS_ACTIONS.UPDATE_PROPERTY &&
  value.eventName === EventTypes.UPDATE_PROPERTY &&
  isNonBlankString(value.id) &&
  isNonBlankString(value.key) &&
  owns(value, 'before') &&
  owns(value, 'after') &&
  (value.ownerElementId === undefined ||
    isNonBlankString(value.ownerElementId)) &&
  (value.ownerPropertyName === undefined ||
    isNonBlankString(value.ownerPropertyName))

const isSupportedPayload = (delivery: SharedDelivery): boolean => {
  if (delivery.channel === SharedDataChannelNames.SCENE_TREE) {
    switch (delivery.eventName) {
      case EventTypes.ADD_ELEMENT:
        return isAddRemoveElement(
          delivery.payload,
          SCENE_TREE_ACTIONS.ADD_ELEMENT,
          EventTypes.ADD_ELEMENT
        )
      case EventTypes.REMOVE_ELEMENT:
        return isAddRemoveElement(
          delivery.payload,
          SCENE_TREE_ACTIONS.REMOVE_ELEMENT,
          EventTypes.REMOVE_ELEMENT
        )
      case EventTypes.UPDATE_COMPUTED_DATA:
        return (
          isScalarComputedChange(delivery.payload) ||
          isBatchComputedChange(delivery.payload)
        )
      case EventTypes.UPDATE_COMPUTED_DATA_PATCH:
        return isComputedPatch(delivery.payload)
    }
  }
  if (delivery.channel === SharedDataChannelNames.PROPS) {
    switch (delivery.eventName) {
      case EventTypes.ADD_PROPERTY:
        return isAddRemoveProperties(
          delivery.payload,
          PROPS_ACTIONS.ADD_PROPERTY,
          EventTypes.ADD_PROPERTY
        )
      case EventTypes.REMOVE_PROPERTY:
        return isAddRemoveProperties(
          delivery.payload,
          PROPS_ACTIONS.REMOVE_PROPERTY,
          EventTypes.REMOVE_PROPERTY
        )
      case EventTypes.UPDATE_PROPERTY:
        return isUpdateProperty(delivery.payload)
    }
  }
  return false
}

const toEvent = (delivery: SharedDelivery): AllEvent => {
  if (!isSupportedPayload(delivery)) {
    throw new Error(
      `[asyra-design collaboration] unsupported collaboration delivery ${delivery.channel}/${delivery.eventName}`
    )
  }
  return { type: delivery.eventName, payload: delivery.payload } as AllEvent
}

export const createAsyraDesignPublicationProcessor =
  (
    runRemoteTransaction: RunRemoteTransaction,
    process: ProcessOperation
  ): ((publication: SharedPublication) => void) =>
  (publication) => {
    const events = publication.deliveries.map(toEvent)
    runRemoteTransaction(() => {
      events.forEach((event) => process(event))
    })
  }
