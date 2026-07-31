import type {
  SharedPublication,
  SharedPublicationBatch,
  SharedPublicationDelivery
} from '@asyra/factory'
import type {
  CanonicalChange,
  CanonicalChangeAPIs,
  PropertyComponentValuesUpdate
} from '@asyra/core'
import {
  EventTypes,
  runInTransactionReplayMode,
  type TransactionReplayMode
} from '@asyra/reactive-events'
import {
  type AddRemoveElementEntry,
  type ElementRawData,
  type HierarchyMove,
  PROPS_ACTIONS,
  type PropertyComponentRawData,
  type PropsRestoreSnapshot,
  SCENE_TREE_ACTIONS,
  type SceneTreeRestoreSnapshot,
  type SubtreeChange,
  type UpdateElementDataChange,
  SharedDataChannelNames,
  emitDiagnosticCounter,
  isRecord,
  measureBrowserDragPhase
} from '@asyra/utils'
import { isNonBlankString } from './wire-values'

type RunRemoteTransaction = (mutate: () => void) => void
type RemoteCanonicalElementRemoval = Extract<
  CanonicalChange,
  { kind: 'element-removal' }
>['removals'][number]
export type DecideRemotePublication = (
  publication: SharedPublication
) => SharedPublication | false

export interface AsyraDesignPublicationProcessorOptions {
  readonly runRemoteTransaction: RunRemoteTransaction
  readonly decideRemotePublication: DecideRemotePublication
  readonly applyCanonicalChanges: CanonicalChangeAPIs['applyCanonicalChanges']
}

interface ClassifiedRemoteRestore {
  sceneSnapshot: SceneTreeRestoreSnapshot
  propsSnapshot: PropsRestoreSnapshot
}

type SharedPublicationSlice = SharedPublication['slices'][number]

interface OrganizedRemotePublication {
  readonly batches: readonly SharedPublicationBatch[]
  readonly deliveries: readonly Readonly<{
    channel: string
    delivery: SharedPublicationDelivery
  }>[]
  readonly sliceByBatch: ReadonlyMap<
    SharedPublicationBatch,
    SharedPublicationSlice
  >
}

const owns = (value: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key)

const publicationReplayMode = (
  origin: SharedPublication['origin']
): TransactionReplayMode | null => {
  if (origin === 'undo' || origin === 'redo') {
    return origin
  }
  return origin === 'rollback-compensation' ? 'rollback' : null
}

type BrowserPhaseSink = (phaseName: string, durationMs: number) => void

const runWithDetachedBrowserTiming = <T>(run: () => T): T => {
  const runtime = globalThis as typeof globalThis & {
    __asyraBrowserDragPhaseSink?: BrowserPhaseSink
  }
  const sourceSink = runtime.__asyraBrowserDragPhaseSink
  if (!sourceSink) {
    return run()
  }

  const detachedSink: BrowserPhaseSink = (phaseName, durationMs) => {
    try {
      sourceSink(phaseName, durationMs)
    } catch {
      // Timing observers cannot change remote canonical settlement.
    }
  }
  runtime.__asyraBrowserDragPhaseSink = detachedSink
  try {
    return run()
  } finally {
    if (runtime.__asyraBrowserDragPhaseSink === detachedSink) {
      runtime.__asyraBrowserDragPhaseSink = sourceSink
    }
  }
}

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

const isAddRemoveElementEntry = (
  value: unknown
): value is AddRemoveElementEntry =>
  isRecord(value) &&
  isTypedData(value.data) &&
  isNonBlankString(value.parentId) &&
  Number.isInteger(value.index) &&
  Number(value.index) >= 0 &&
  value.data.parentId === value.parentId

const isAddRemoveElements = (
  value: unknown,
  action: SCENE_TREE_ACTIONS.ADD_ELEMENTS | SCENE_TREE_ACTIONS.REMOVE_ELEMENTS,
  eventName: typeof EventTypes.ADD_ELEMENTS | typeof EventTypes.REMOVE_ELEMENTS,
  undoAction:
    | SCENE_TREE_ACTIONS.ADD_ELEMENTS
    | SCENE_TREE_ACTIONS.REMOVE_ELEMENTS,
  undoType: typeof EventTypes.ADD_ELEMENTS | typeof EventTypes.REMOVE_ELEMENTS
): value is Readonly<{ entries: readonly AddRemoveElementEntry[] }> =>
  isRecord(value) &&
  value.action === action &&
  value.eventName === eventName &&
  value.undoAction === undoAction &&
  value.undoType === undoType &&
  Array.isArray(value.entries) &&
  value.entries.length > 0 &&
  value.entries.every(isAddRemoveElementEntry)

type CanonicalElementEvidenceDirection = 'add' | 'remove'

const canonicalElementEntriesFromDelivery = (
  delivery: SharedPublicationDelivery,
  direction: CanonicalElementEvidenceDirection
): readonly AddRemoveElementEntry[] | null => {
  const scalarEvent =
    direction === 'add' ? EventTypes.ADD_ELEMENT : EventTypes.REMOVE_ELEMENT
  const scalarAction =
    direction === 'add'
      ? SCENE_TREE_ACTIONS.ADD_ELEMENT
      : SCENE_TREE_ACTIONS.REMOVE_ELEMENT
  if (
    delivery.eventName === scalarEvent &&
    isAddRemoveElement(delivery.payload, scalarAction, scalarEvent)
  ) {
    const { data, parentId, index } = delivery.payload
    if (!isNonBlankString(parentId) || !Number.isInteger(index)) return null
    return [{ data: data as ElementRawData, parentId, index: Number(index) }]
  }

  const batchEvent =
    direction === 'add' ? EventTypes.ADD_ELEMENTS : EventTypes.REMOVE_ELEMENTS
  const batchAction =
    direction === 'add'
      ? SCENE_TREE_ACTIONS.ADD_ELEMENTS
      : SCENE_TREE_ACTIONS.REMOVE_ELEMENTS
  const inverseEvent =
    direction === 'add' ? EventTypes.REMOVE_ELEMENTS : EventTypes.ADD_ELEMENTS
  const inverseAction =
    direction === 'add'
      ? SCENE_TREE_ACTIONS.REMOVE_ELEMENTS
      : SCENE_TREE_ACTIONS.ADD_ELEMENTS
  if (
    delivery.eventName === batchEvent &&
    isAddRemoveElements(
      delivery.payload,
      batchAction,
      batchEvent,
      inverseAction,
      inverseEvent
    )
  ) {
    return delivery.payload.entries
  }
  return null
}

const isElementDataChange = (
  value: unknown
): value is UpdateElementDataChange =>
  isRecord(value) &&
  value.action === SCENE_TREE_ACTIONS.UPDATE_ELEMENT_DATA &&
  value.eventName === EventTypes.UPDATE_ELEMENT_DATA &&
  isNonBlankString(value.id) &&
  Array.isArray(value.changes) &&
  value.changes.length > 0 &&
  value.changes.every(
    (change) =>
      isRecord(change) &&
      (change.key === 'name' ||
        change.key === 'visible' ||
        change.key === 'lock') &&
      owns(change, 'before') &&
      owns(change, 'after') &&
      (change.key === 'name'
        ? typeof change.before === 'string' && typeof change.after === 'string'
        : typeof change.before === 'boolean' &&
          typeof change.after === 'boolean')
  )

const isHierarchyLocation = (
  value: unknown
): value is Record<string, unknown> =>
  isRecord(value) &&
  isNonBlankString(value.parentId) &&
  Number.isInteger(value.index) &&
  Number(value.index) >= 0

const isMoveElements = (
  value: unknown
): value is Record<string, unknown> & {
  readonly moves: readonly HierarchyMove[]
} => {
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

const isSubtreeChange = (value: unknown): value is SubtreeChange => {
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
      case EventTypes.ADD_ELEMENTS:
        return isAddRemoveElements(
          delivery.payload,
          SCENE_TREE_ACTIONS.ADD_ELEMENTS,
          EventTypes.ADD_ELEMENTS,
          SCENE_TREE_ACTIONS.REMOVE_ELEMENTS,
          EventTypes.REMOVE_ELEMENTS
        )
      case EventTypes.REMOVE_ELEMENTS:
        return isAddRemoveElements(
          delivery.payload,
          SCENE_TREE_ACTIONS.REMOVE_ELEMENTS,
          EventTypes.REMOVE_ELEMENTS,
          SCENE_TREE_ACTIONS.ADD_ELEMENTS,
          EventTypes.ADD_ELEMENTS
        )
      case EventTypes.UPDATE_ELEMENT_DATA:
        return isElementDataChange(delivery.payload)
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
  organization: OrganizedRemotePublication
): ClassifiedRemoteRestore | undefined => {
  const { deliveries } = organization
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

const assertSupportedDelivery = (
  channel: string,
  delivery: SharedPublicationDelivery
): void => {
  if (
    channel === SharedDataChannelNames.SCENE_TREE &&
    (delivery.eventName === EventTypes.UPDATE_COMPUTED_DATA ||
      delivery.eventName === EventTypes.UPDATE_COMPUTED_DATA_PATCH)
  ) {
    throw new Error(
      '[asyra-design collaboration] remote publication contains local-only computed projection evidence'
    )
  }
  if (!isSupportedPayload(channel, delivery)) {
    throw new Error(
      `[asyra-design collaboration] unsupported collaboration delivery ${channel}/${delivery.eventName}`
    )
  }
}

const isAddPropertyDelivery = (
  delivery: SharedPublicationDelivery | undefined
): delivery is SharedPublicationDelivery<
  Readonly<{
    data: readonly PropertyComponentRawData[]
  }>
> =>
  Boolean(
    delivery &&
      delivery.eventName === EventTypes.ADD_PROPERTY &&
      isAddRemoveProperties(
        delivery.payload,
        PROPS_ACTIONS.ADD_PROPERTY,
        EventTypes.ADD_PROPERTY
      )
  )

const isRemovePropertyDelivery = (
  delivery: SharedPublicationDelivery | undefined
): delivery is SharedPublicationDelivery<
  Readonly<{
    data: readonly PropertyComponentRawData[]
  }>
> =>
  Boolean(
    delivery &&
      delivery.eventName === EventTypes.REMOVE_PROPERTY &&
      isAddRemoveProperties(
        delivery.payload,
        PROPS_ACTIONS.REMOVE_PROPERTY,
        EventTypes.REMOVE_PROPERTY
      )
  )

const orderedIdsFromBatch = (
  batch: SharedPublicationBatch
): readonly string[] => {
  const seen = new Set<string>()
  return batch.deliveries.flatMap(({ orderedIds }) =>
    orderedIds.filter((orderedId) => {
      if (seen.has(orderedId)) return false
      seen.add(orderedId)
      return true
    })
  )
}

const sameOrderedIds = (
  actual: readonly string[],
  expected: readonly string[]
): boolean =>
  actual.length === expected.length &&
  actual.every((id, index) => id === expected[index])

const organizeRemotePublication = (
  publication: SharedPublication
): OrganizedRemotePublication => {
  const slices = publication.slices
  const batches: SharedPublicationBatch[] = []
  const deliveries: {
    channel: string
    delivery: SharedPublicationDelivery
  }[] = []
  const sliceByBatch = new Map<SharedPublicationBatch, SharedPublicationSlice>()
  const batchIds = new Set<string>()
  const deliveryIds = new Set<string>()
  const isCompensation = publication.origin === 'rollback-compensation'
  if (
    slices.length === 0 ||
    isCompensation !== owns(publication, 'compensatesPublicationId')
  ) {
    throw new Error(
      '[asyra-design collaboration] publication delivery order does not match Factory batch evidence'
    )
  }

  for (const slice of slices) {
    const sliceBatches = slice.batches
    if (
      !isNonBlankString(slice.sliceId) ||
      slice.orderedIds.length === 0 ||
      sliceBatches.length === 0
    ) {
      throw new Error(
        '[asyra-design collaboration] publication contains invalid direct Factory batch evidence'
      )
    }
    const sliceDeliveryIds: string[] = []
    const sliceCanonicalOrderedIds: string[] = []
    const seenSliceCanonicalIds = new Set<string>()

    for (const batch of sliceBatches) {
      const batchDeliveries = batch.deliveries
      if (
        sliceByBatch.has(batch) ||
        batchIds.has(batch.batchId) ||
        !isNonBlankString(batch.batchId) ||
        !isNonBlankString(batch.channel) ||
        batchDeliveries.length === 0
      ) {
        throw new Error(
          '[asyra-design collaboration] publication contains invalid direct Factory batch evidence'
        )
      }
      batchIds.add(batch.batchId)
      sliceByBatch.set(batch, slice)
      batches.push(batch)

      for (const delivery of batchDeliveries) {
        if (
          deliveryIds.has(delivery.deliveryId) ||
          !isNonBlankString(delivery.deliveryId) ||
          !isNonBlankString(delivery.eventName) ||
          delivery.orderedIds.length === 0 ||
          delivery.orderedIds.some((orderedId) => !isNonBlankString(orderedId))
        ) {
          throw new Error(
            '[asyra-design collaboration] publication contains invalid direct Factory batch evidence'
          )
        }
        if (isCompensation !== owns(delivery, 'compensatesDeliveryId')) {
          throw new Error(
            '[asyra-design collaboration] publication delivery order does not match Factory batch evidence'
          )
        }
        deliveryIds.add(delivery.deliveryId)
        sliceDeliveryIds.push(delivery.deliveryId)
        delivery.orderedIds.forEach((orderedId) => {
          if (seenSliceCanonicalIds.has(orderedId)) return
          seenSliceCanonicalIds.add(orderedId)
          sliceCanonicalOrderedIds.push(orderedId)
        })
        deliveries.push({
          channel: batch.channel,
          delivery
        })
      }
    }

    if (
      !sameOrderedIds(slice.orderedIds, sliceDeliveryIds) &&
      !(
        publication.mode === 'progressive' &&
        sameOrderedIds(slice.orderedIds, sliceCanonicalOrderedIds)
      )
    ) {
      throw new Error(
        '[asyra-design collaboration] publication contains invalid direct Factory batch evidence'
      )
    }
  }

  if (batches.length === 0 || deliveries.length === 0) {
    throw new Error(
      '[asyra-design collaboration] publication delivery order does not match Factory batch evidence'
    )
  }
  deliveries.forEach(({ channel, delivery }) =>
    assertSupportedDelivery(channel, delivery)
  )
  return Object.freeze({
    batches: Object.freeze(batches),
    deliveries: Object.freeze(deliveries.map((entry) => Object.freeze(entry))),
    sliceByBatch
  })
}

const orderCanonicalElementEntries = (
  entries: readonly AddRemoveElementEntry[],
  orderedIds: readonly string[]
): readonly AddRemoveElementEntry[] | null => {
  if (entries.length !== orderedIds.length) return null
  const entriesById = new Map<string, AddRemoveElementEntry>()
  for (const entry of entries) {
    if (entriesById.has(entry.data.id)) return null
    entriesById.set(entry.data.id, entry)
  }
  const seenOrderedIds = new Set<string>()
  const orderedEntries: AddRemoveElementEntry[] = []
  for (const orderedId of orderedIds) {
    if (seenOrderedIds.has(orderedId)) return null
    const entry = entriesById.get(orderedId)
    if (!entry) return null
    seenOrderedIds.add(orderedId)
    orderedEntries.push(entry)
  }
  return sameOrderedIds(
    entries.map(({ data }) => data.id),
    orderedIds
  )
    ? entries
    : orderedEntries
}

const classifyPropertyComponentBatch = (
  batch: SharedPublicationBatch
): readonly PropertyComponentValuesUpdate[] | null => {
  if (
    !batch.deliveries.some(
      ({ eventName }) => eventName === EventTypes.UPDATE_PROPERTY
    )
  ) {
    return null
  }
  if (
    batch.channel !== SharedDataChannelNames.PROPS ||
    !batch.deliveries.every(
      (delivery) =>
        delivery.eventName === EventTypes.UPDATE_PROPERTY &&
        isUpdateProperty(delivery.payload)
    )
  ) {
    throw new Error(
      '[asyra-design collaboration] invalid property-component batch evidence'
    )
  }
  const updatesByPropertyId = new Map<
    string,
    { propertyId: string; values: Record<string, unknown> }
  >()
  batch.deliveries.forEach(({ payload }) => {
    const change = payload as Record<string, unknown>
    const propertyId = change.id as string
    const update = updatesByPropertyId.get(propertyId) ?? {
      propertyId,
      values: {}
    }
    update.values[change.key as string] = change.after
    updatesByPropertyId.set(propertyId, update)
  })
  return Object.freeze(
    [...updatesByPropertyId.values()].map(({ propertyId, values }) =>
      Object.freeze({
        propertyId,
        values: Object.freeze({ ...values })
      })
    )
  )
}

const classifyElementDataBatch = (
  batch: SharedPublicationBatch
): readonly UpdateElementDataChange[] | null => {
  if (
    !batch.deliveries.some(
      ({ eventName }) => eventName === EventTypes.UPDATE_ELEMENT_DATA
    )
  ) {
    return null
  }
  if (
    batch.channel !== SharedDataChannelNames.SCENE_TREE ||
    !batch.deliveries.every(
      ({ eventName, payload }) =>
        eventName === EventTypes.UPDATE_ELEMENT_DATA &&
        isElementDataChange(payload)
    )
  ) {
    throw new Error(
      '[asyra-design collaboration] invalid element-data batch evidence'
    )
  }
  return Object.freeze(
    batch.deliveries.map(({ payload }) => payload as UpdateElementDataChange)
  )
}

const classifyHierarchyMoveBatch = (
  batch: SharedPublicationBatch
): readonly HierarchyMove[] | null => {
  if (
    !batch.deliveries.some(
      ({ eventName }) => eventName === EventTypes.MOVE_ELEMENTS
    )
  ) {
    return null
  }
  if (
    batch.channel !== SharedDataChannelNames.SCENE_TREE ||
    !batch.deliveries.every(
      ({ eventName, payload }) =>
        eventName === EventTypes.MOVE_ELEMENTS && isMoveElements(payload)
    )
  ) {
    throw new Error(
      '[asyra-design collaboration] invalid hierarchy-move batch evidence'
    )
  }
  return Object.freeze(
    batch.deliveries.flatMap(
      ({ payload }) =>
        (payload as { readonly moves: readonly HierarchyMove[] }).moves
    )
  )
}

const classifySubtreeRemovalBatch = (
  batches: readonly SharedPublicationBatch[],
  startBatchIndex: number
): Readonly<{
  change: SubtreeChange
  consumedBatchCount: number
}> | null => {
  const sceneBatch = batches[startBatchIndex]
  const sceneDelivery = sceneBatch?.deliveries[0]
  if (
    !sceneBatch ||
    sceneBatch.channel !== SharedDataChannelNames.SCENE_TREE ||
    sceneDelivery?.eventName !== EventTypes.CHANGE_SUBTREE ||
    !isSubtreeChange(sceneDelivery.payload) ||
    sceneDelivery.payload.action !== SCENE_TREE_ACTIONS.REMOVE_SUBTREE
  ) {
    return null
  }
  if (sceneBatch.deliveries.length !== 1) {
    throw new Error(
      '[asyra-design collaboration] invalid subtree removal Scene evidence'
    )
  }
  let consumedBatchCount = 1
  while (true) {
    const propertyBatch = batches[startBatchIndex + consumedBatchCount]
    if (
      !propertyBatch ||
      propertyBatch.channel !== SharedDataChannelNames.PROPS ||
      !propertyBatch.deliveries.some(
        ({ eventName }) => eventName === EventTypes.REMOVE_PROPERTY
      )
    ) {
      break
    }
    if (!propertyBatch.deliveries.every(isRemovePropertyDelivery)) {
      throw new Error(
        '[asyra-design collaboration] invalid subtree removal property evidence'
      )
    }
    consumedBatchCount += 1
  }
  return Object.freeze({
    change: sceneDelivery.payload,
    consumedBatchCount
  })
}

const classifyCanonicalCreationBatch = (
  organization: OrganizedRemotePublication,
  startBatchIndex: number
): Readonly<{
  change: Extract<CanonicalChange, { kind: 'element-creation' }>
  consumedBatchCount: number
}> | null => {
  const { batches, sliceByBatch } = organization
  const propertyBatch = batches[startBatchIndex]
  const sceneBatch = batches[startBatchIndex + 1]
  if (
    !propertyBatch ||
    !sceneBatch ||
    propertyBatch.channel !== SharedDataChannelNames.PROPS ||
    sceneBatch.channel !== SharedDataChannelNames.SCENE_TREE ||
    sliceByBatch.get(propertyBatch) !== sliceByBatch.get(sceneBatch)
  ) {
    return null
  }

  const propertyDeliveries = propertyBatch.deliveries
  if (!propertyDeliveries.every(isAddPropertyDelivery)) {
    return null
  }
  const properties = propertyDeliveries.flatMap(({ payload }) => payload.data)
  const propertyIds = new Set(properties.map(({ id }) => id))
  const elements: ElementRawData[] = []
  let parentId: string | undefined
  let insertionIndex: number | undefined
  let observedPropertyOwnerCount = 0
  const sourceEntries: AddRemoveElementEntry[] = []

  for (const delivery of sceneBatch.deliveries) {
    const entries = canonicalElementEntriesFromDelivery(delivery, 'add')
    if (!entries) return null
    sourceEntries.push(...entries)
  }
  const sceneOrderedIds = orderedIdsFromBatch(sceneBatch)
  const orderedEntries = orderCanonicalElementEntries(
    sourceEntries,
    sceneOrderedIds
  )
  if (!orderedEntries) return null
  for (const entry of orderedEntries) {
    const elementData = entry.data as unknown as Record<string, unknown>
    if (!isRecord(elementData.props)) return null

    parentId ??= entry.parentId
    insertionIndex ??= entry.index
    if (
      entry.parentId !== parentId ||
      entry.index !== insertionIndex + elements.length
    ) {
      return null
    }
    const propertyOwnerIds = Object.values(elementData.props)
    if (
      propertyOwnerIds.some(
        (propertyId) =>
          !isNonBlankString(propertyId) || !propertyIds.has(propertyId)
      )
    ) {
      return null
    }
    observedPropertyOwnerCount += propertyOwnerIds.length
    elements.push(entry.data)
  }

  const elementIds = elements.map(({ id }) => id)
  const propertyOrderedIds = orderedIdsFromBatch(propertyBatch)
  if (
    elements.length === 0 ||
    parentId === undefined ||
    insertionIndex === undefined ||
    observedPropertyOwnerCount === 0 ||
    !sameOrderedIds(sceneOrderedIds, elementIds) ||
    !sameOrderedIds(propertyOrderedIds, elementIds)
  ) {
    return null
  }

  return Object.freeze({
    change: Object.freeze({
      kind: 'element-creation',
      elements: Object.freeze(elements),
      properties: Object.freeze(properties),
      parentId,
      index: insertionIndex
    }),
    consumedBatchCount: 2
  })
}

const classifyCanonicalRemovalBatch = (
  organization: OrganizedRemotePublication,
  startBatchIndex: number
): Readonly<{
  removals: readonly RemoteCanonicalElementRemoval[]
  consumedBatchCount: number
}> | null => {
  const { batches, sliceByBatch } = organization
  const sceneBatch = batches[startBatchIndex]
  if (!sceneBatch || sceneBatch.channel !== SharedDataChannelNames.SCENE_TREE) {
    return null
  }

  const removals: RemoteCanonicalElementRemoval[] = []
  const sourceEntries: AddRemoveElementEntry[] = []
  for (const delivery of sceneBatch.deliveries) {
    const entries = canonicalElementEntriesFromDelivery(delivery, 'remove')
    if (!entries) return null
    sourceEntries.push(...entries)
  }
  const sceneOrderedIds = orderedIdsFromBatch(sceneBatch)
  const orderedEntries = orderCanonicalElementEntries(
    sourceEntries,
    sceneOrderedIds
  )
  if (!orderedEntries) return null
  for (const entry of orderedEntries) {
    if (!isRecord(entry.data.props)) return null
    removals.push(
      Object.freeze({
        data: entry.data,
        parentId: entry.parentId,
        index: entry.index
      })
    )
  }

  const elementIds = removals.map(({ data }) => data.id)
  if (
    removals.length === 0 ||
    new Set(elementIds).size !== elementIds.length ||
    !sameOrderedIds(sceneOrderedIds, elementIds)
  ) {
    return null
  }

  const propertyBatchCandidate = batches[startBatchIndex + 1]
  const hasPropertyRemovalCandidate =
    propertyBatchCandidate?.channel === SharedDataChannelNames.PROPS &&
    propertyBatchCandidate.deliveries.some(
      ({ eventName }) => eventName === EventTypes.REMOVE_PROPERTY
    )
  const propertyBatch = hasPropertyRemovalCandidate
    ? propertyBatchCandidate
    : undefined
  if (
    propertyBatch &&
    (!propertyBatch.deliveries.every(isRemovePropertyDelivery) ||
      sliceByBatch.get(sceneBatch) !== sliceByBatch.get(propertyBatch) ||
      !sameOrderedIds(orderedIdsFromBatch(propertyBatch), elementIds))
  ) {
    throw new Error(
      '[asyra-design collaboration] invalid canonical removal property batch evidence'
    )
  }

  return Object.freeze({
    removals: Object.freeze(removals),
    consumedBatchCount: propertyBatch ? 2 : 1
  })
}

const createRemoteApplySteps = (
  organization: OrganizedRemotePublication
): readonly CanonicalChange[] => {
  const changes: CanonicalChange[] = []
  const { batches } = organization
  let batchIndex = 0
  while (batchIndex < batches.length) {
    const creation = classifyCanonicalCreationBatch(organization, batchIndex)
    if (creation) {
      changes.push(creation.change)
      batchIndex += creation.consumedBatchCount
      continue
    }
    const removal = classifyCanonicalRemovalBatch(organization, batchIndex)
    if (removal) {
      changes.push(
        Object.freeze({
          kind: 'element-removal',
          removals: removal.removals
        })
      )
      batchIndex += removal.consumedBatchCount
      continue
    }
    const batch = batches[batchIndex] as SharedPublicationBatch
    const propertyUpdates = classifyPropertyComponentBatch(batch)
    if (propertyUpdates) {
      changes.push(
        Object.freeze({
          kind: 'property-components',
          updates: propertyUpdates
        })
      )
      batchIndex += 1
      continue
    }
    const elementDataChanges = classifyElementDataBatch(batch)
    if (elementDataChanges) {
      changes.push(
        Object.freeze({
          kind: 'element-data',
          changes: elementDataChanges
        })
      )
      batchIndex += 1
      continue
    }
    const hierarchyMoves = classifyHierarchyMoveBatch(batch)
    if (hierarchyMoves) {
      changes.push(
        Object.freeze({
          kind: 'hierarchy-moves',
          moves: hierarchyMoves
        })
      )
      batchIndex += 1
      continue
    }
    const subtreeRemoval = classifySubtreeRemovalBatch(batches, batchIndex)
    if (subtreeRemoval) {
      changes.push(
        Object.freeze({
          kind: 'subtree-removal',
          change: subtreeRemoval.change
        })
      )
      batchIndex += subtreeRemoval.consumedBatchCount
      continue
    }
    throw new Error(
      `[asyra-design collaboration] unsupported canonical Factory batch evidence at batch ${batchIndex} ${batch.channel}/${batch.deliveries.map(({ eventName }) => eventName).join(',')}`
    )
  }
  return Object.freeze(changes)
}

export const createAsyraDesignPublicationProcessor =
  ({
    runRemoteTransaction,
    decideRemotePublication,
    applyCanonicalChanges
  }: AsyraDesignPublicationProcessorOptions): ((
    publication: SharedPublication
  ) => boolean) =>
  (publication) => {
    return runWithDetachedBrowserTiming(() => {
      const inboundOrganization = measureBrowserDragPhase(
        'collaboration:remote-input-preflight',
        () => organizeRemotePublication(publication)
      )
      const inboundRestore = measureBrowserDragPhase(
        'collaboration:remote-restore-classify',
        () => classifyRemoteRestore(inboundOrganization)
      )
      const acceptedPublication = measureBrowserDragPhase(
        'collaboration:remote-policy',
        () => decideRemotePublication(publication)
      )
      if (acceptedPublication === false) {
        return false
      }
      const replayMode = publicationReplayMode(acceptedPublication.origin)
      const runCanonicalTransaction = (mutate: () => void): void => {
        if (replayMode) {
          runInTransactionReplayMode(replayMode, () =>
            runRemoteTransaction(mutate)
          )
          return
        }
        runRemoteTransaction(mutate)
      }
      const acceptedOrganization =
        acceptedPublication === publication
          ? inboundOrganization
          : measureBrowserDragPhase(
              'collaboration:remote-accepted-input-preflight',
              () => organizeRemotePublication(acceptedPublication)
            )
      const acceptedRestore =
        acceptedPublication === publication
          ? inboundRestore
          : measureBrowserDragPhase(
              'collaboration:remote-accepted-restore-classify',
              () => classifyRemoteRestore(acceptedOrganization)
            )
      if (Boolean(inboundRestore) !== Boolean(acceptedRestore)) {
        throw new Error(
          '[asyra-design collaboration] invalid subtree restore publication'
        )
      }
      if (acceptedRestore) {
        const canonicalChanges = Object.freeze([
          Object.freeze({
            kind: 'subtree-restore' as const,
            sceneSnapshot: acceptedRestore.sceneSnapshot,
            propsSnapshot: acceptedRestore.propsSnapshot
          })
        ])
        measureBrowserDragPhase('collaboration:remote-transaction-apply', () =>
          runCanonicalTransaction(() => applyCanonicalChanges(canonicalChanges))
        )
        return true
      }
      const canonicalChanges = measureBrowserDragPhase(
        'collaboration:remote-canonical-batch-derive',
        () => createRemoteApplySteps(acceptedOrganization)
      )
      canonicalChanges.forEach((change) => {
        if (change.kind !== 'element-creation') {
          return
        }
        emitDiagnosticCounter('collaboration:remote-add-element-batch-count')
        emitDiagnosticCounter(
          'collaboration:remote-add-element-batch-size',
          change.elements.length
        )
      })
      measureBrowserDragPhase('collaboration:remote-transaction-apply', () =>
        runCanonicalTransaction(() => applyCanonicalChanges(canonicalChanges))
      )
      return true
    })
  }
