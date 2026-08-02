import type {
  SharedPublication,
  SharedPublicationDelivery
} from '@asyra/factory'
import { EventTypes, type AllEvent } from '@asyra/reactive-events'
import {
  type ElementPropertyOwnerRelation,
  type EVENT_OPTIONS,
  PROPS_ACTIONS,
  type PreparedPropsRestore,
  type PropsRestoreSnapshot,
  SCENE_TREE_ACTIONS,
  type PreparedSceneTreeRestore,
  type SceneTreeRestoreSnapshot,
  SharedDataChannelNames,
  isRecord
} from '@asyra/utils'
import { isNonBlankString } from './wire-values'

type ProcessOperation = (event: AllEvent) => boolean | undefined
type RunRemoteTransaction = <T>(mutate: () => T) => T
export type DecideRemotePublication = (
  publication: SharedPublication
) => SharedPublication | false
export interface RemoteRestoreOwnerFacades {
  preflightRestoreSubtree: (
    snapshot: SceneTreeRestoreSnapshot
  ) => PreparedSceneTreeRestore
  preflightRestoreProperties: (
    snapshot: PropsRestoreSnapshot,
    ownerRelations: readonly ElementPropertyOwnerRelation[]
  ) => PreparedPropsRestore
  applyRestoreProperties: (
    prepared: PreparedPropsRestore,
    options?: EVENT_OPTIONS
  ) => readonly string[]
  applyRestoreSubtree: (
    prepared: PreparedSceneTreeRestore,
    options?: EVENT_OPTIONS
  ) => unknown
}

interface ClassifiedRemoteRestore {
  sceneSnapshot: SceneTreeRestoreSnapshot
  propsSnapshot: PropsRestoreSnapshot
}

const owns = (value: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key)

interface PublicationDeliveryWithChannel {
  readonly channel: string
  readonly delivery: SharedPublicationDelivery
}

const publicationDeliveries = (
  publication: SharedPublication
): readonly PublicationDeliveryWithChannel[] =>
  publication.slices.flatMap(({ batches }) =>
    batches.flatMap(({ channel, deliveries }) =>
      deliveries.map((delivery) => ({ channel, delivery }))
    )
  )

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
    !Array.isArray(value.rootParentChildrenAfter) ||
    !value.rootParentChildrenAfter.every(isNonBlankString) ||
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

const isSupportedPayload = (
  channel: string,
  delivery: SharedPublicationDelivery
): boolean => {
  if (channel === SharedDataChannelNames.SCENE_TREE) {
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
  if (channel === SharedDataChannelNames.PROPS) {
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

const classifyRemoteRestore = (
  publication: SharedPublication
): ClassifiedRemoteRestore | undefined => {
  const deliveries = publicationDeliveries(publication)
  const restoreDeliveries = deliveries.filter(
    ({ channel, delivery }) =>
      channel === SharedDataChannelNames.SCENE_TREE &&
      delivery.eventName === EventTypes.CHANGE_SUBTREE &&
      isRecord(delivery.payload) &&
      delivery.payload.action === SCENE_TREE_ACTIONS.RESTORE_SUBTREE
  )
  if (restoreDeliveries.length === 0) {
    return
  }
  const restoreDelivery = restoreDeliveries[0]?.delivery
  const restoreIndex = deliveries.findIndex(
    ({ delivery }) => delivery === restoreDelivery
  )
  const propertyDeliveries = deliveries.slice(0, restoreIndex)
  const validRestoreEnvelope =
    restoreDeliveries.length === 1 &&
    restoreIndex === deliveries.length - 1 &&
    propertyDeliveries.every(
      ({ channel, delivery }) =>
        channel === SharedDataChannelNames.PROPS &&
        delivery.eventName === EventTypes.ADD_PROPERTY &&
        isAddRemoveProperties(
          delivery.payload,
          PROPS_ACTIONS.ADD_PROPERTY,
          EventTypes.ADD_PROPERTY
        )
    )
  if (
    !restoreDelivery ||
    !validRestoreEnvelope ||
    !isSubtreeChange(restoreDelivery.payload)
  ) {
    throw new Error(
      '[asyra-design collaboration] invalid subtree restore publication'
    )
  }

  const payload = restoreDelivery.payload
  return {
    sceneSnapshot: {
      elementId: payload.elementId as string,
      removed: payload.removed as SceneTreeRestoreSnapshot['removed'],
      rootParentChildrenAfter:
        payload.rootParentChildrenAfter as readonly string[]
    },
    propsSnapshot: {
      components: propertyDeliveries.flatMap(
        ({ delivery }) =>
          (delivery.payload as { data: PropsRestoreSnapshot['components'] })
            .data
      )
    }
  }
}

const toEvent = (
  channel: string,
  delivery: SharedPublicationDelivery
): AllEvent => {
  if (!isSupportedPayload(channel, delivery)) {
    throw new Error(
      `[asyra-design collaboration] unsupported collaboration delivery ${channel}/${delivery.eventName}`
    )
  }
  return { type: delivery.eventName, payload: delivery.payload } as AllEvent
}

export const createAsyraDesignPublicationProcessor =
  (
    runRemoteTransaction: RunRemoteTransaction,
    process: ProcessOperation,
    decideRemotePublication: DecideRemotePublication = (publication) =>
      publication,
    restoreOwners?: RemoteRestoreOwnerFacades
  ): ((publication: SharedPublication) => void) =>
  (publication) => {
    publicationDeliveries(publication).forEach(({ channel, delivery }) =>
      toEvent(channel, delivery)
    )
    const inboundRestore = classifyRemoteRestore(publication)
    const acceptedPublication = decideRemotePublication(publication)
    if (acceptedPublication === false) {
      return
    }
    const events = publicationDeliveries(acceptedPublication).map(
      ({ channel, delivery }) => toEvent(channel, delivery)
    )
    const acceptedRestore = classifyRemoteRestore(acceptedPublication)
    if (Boolean(inboundRestore) !== Boolean(acceptedRestore)) {
      throw new Error(
        '[asyra-design collaboration] invalid subtree restore publication'
      )
    }
    if (acceptedRestore) {
      if (!restoreOwners) {
        throw new Error(
          '[asyra-design collaboration] subtree restore owner facades are required'
        )
      }
      const preparedSceneRestore = restoreOwners.preflightRestoreSubtree(
        acceptedRestore.sceneSnapshot
      )
      const preparedPropsRestore = restoreOwners.preflightRestoreProperties(
        acceptedRestore.propsSnapshot,
        preparedSceneRestore.propertyOwnerRelations
      )
      runRemoteTransaction(() => {
        restoreOwners.applyRestoreProperties(preparedPropsRestore)
        restoreOwners.applyRestoreSubtree(preparedSceneRestore)
      })
      return
    }
    runRemoteTransaction(() => {
      events.forEach((event) => process(event))
    })
  }
