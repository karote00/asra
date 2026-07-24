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
export type DecideRemotePublication = (
  publication: SharedPublication
) => SharedPublication | false

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

const isHierarchyLocation = (
  value: unknown
): value is Record<string, unknown> =>
  isRecord(value) &&
  isNonBlankString(value.parentId) &&
  Number.isInteger(value.index) &&
  Number(value.index) >= 0

const isMoveElements = (value: unknown): value is Record<string, unknown> => {
  if (
    !isRecord(value) ||
    value.action !== SCENE_TREE_ACTIONS.MOVE_ELEMENTS ||
    value.eventName !== EventTypes.MOVE_ELEMENTS ||
    !Array.isArray(value.moves) ||
    value.moves.length === 0
  ) {
    return false
  }

  const elementIds = new Set<string>()
  const beforeIndices = new Set<number>()
  const afterIndices = new Set<number>()
  let beforeParentId: string | undefined
  let afterParentId: string | undefined

  for (const move of value.moves) {
    if (
      !isRecord(move) ||
      !isNonBlankString(move.elementId) ||
      !isHierarchyLocation(move.before) ||
      !isHierarchyLocation(move.after) ||
      elementIds.has(move.elementId) ||
      beforeIndices.has(Number(move.before.index)) ||
      afterIndices.has(Number(move.after.index))
    ) {
      return false
    }

    beforeParentId ??= String(move.before.parentId)
    afterParentId ??= String(move.after.parentId)
    if (
      move.before.parentId !== beforeParentId ||
      move.after.parentId !== afterParentId
    ) {
      return false
    }

    elementIds.add(move.elementId)
    beforeIndices.add(Number(move.before.index))
    afterIndices.add(Number(move.after.index))
  }

  return true
}

const isSubtreeEntry = (value: unknown): value is Record<string, unknown> =>
  isRecord(value) &&
  isNonBlankString(value.elementId) &&
  isNonBlankString(value.parentId) &&
  Number.isInteger(value.index) &&
  Number(value.index) >= 0 &&
  isTypedData(value.data) &&
  value.data.id === value.elementId &&
  value.data.parentId === value.parentId

const isSubtreeChange = (value: unknown): value is Record<string, unknown> => {
  if (
    !isRecord(value) ||
    value.eventName !== EventTypes.CHANGE_SUBTREE ||
    !isNonBlankString(value.elementId) ||
    !Array.isArray(value.removed) ||
    value.removed.length === 0 ||
    !value.removed.every(isSubtreeEntry)
  ) {
    return false
  }

  let inverseAction: string | undefined
  if (value.action === SCENE_TREE_ACTIONS.REMOVE_SUBTREE) {
    inverseAction = SCENE_TREE_ACTIONS.RESTORE_SUBTREE
  }
  if (value.action === SCENE_TREE_ACTIONS.RESTORE_SUBTREE) {
    inverseAction = SCENE_TREE_ACTIONS.REMOVE_SUBTREE
  }
  if (value.undoAction !== inverseAction) {
    return false
  }

  const elementIds = value.removed.map(({ elementId }) => elementId as string)
  return (
    new Set(elementIds).size === elementIds.length &&
    elementIds.filter((elementId) => elementId === value.elementId).length === 1
  )
}

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
      case EventTypes.MOVE_ELEMENTS:
        return isMoveElements(delivery.payload)
      case EventTypes.CHANGE_SUBTREE:
        return isSubtreeChange(delivery.payload)
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
    process: ProcessOperation,
    decideRemotePublication: DecideRemotePublication = (publication) =>
      publication
  ): ((publication: SharedPublication) => void) =>
  (publication) => {
    publication.deliveries.forEach(toEvent)
    const acceptedPublication = decideRemotePublication(publication)
    if (acceptedPublication === false) {
      return
    }
    const events = acceptedPublication.deliveries.map(toEvent)
    runRemoteTransaction(() => {
      events.forEach((event) => process(event))
    })
  }
