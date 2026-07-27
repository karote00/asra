import type {
  SharedDelivery,
  SharedDeliveryBatch,
  SharedPublication
} from '@asyra/factory'
import {
  EventTypes,
  publishEventsToObservers,
  runInTransactionReplayMode,
  type TransactionReplayMode,
  type AllEvent
} from '@asyra/reactive-events'
import {
  type ElementPropertyOwnerRelation,
  type ElementRawData,
  type EVENT_OPTIONS,
  PROPS_ACTIONS,
  type PropertyComponentRawData,
  type PropsRestorePlan,
  type PropsRestoreSnapshot,
  SCENE_TREE_ACTIONS,
  type SceneTreeRestorePlan,
  type SceneTreeRestoreSnapshot,
  SharedDataChannelNames,
  emitDiagnosticCounter,
  isRecord,
  measureBrowserDragPhase
} from '@asyra/utils'
import { isNonBlankString } from './wire-values'

type ProcessOperation = (event: AllEvent) => boolean | undefined
type RunRemoteTransaction = (mutate: () => void) => void
export type ApplyRemoteCanonicalCreationBatch = (
  elements: readonly ElementRawData[],
  properties: readonly PropertyComponentRawData[],
  parentId: string,
  index: number
) => readonly string[]
export interface RemoteCanonicalElementRemoval {
  readonly data: ElementRawData
  readonly parentId: string
  readonly index: number
}
export type ApplyRemoteCanonicalRemovalBatch = (
  removals: readonly RemoteCanonicalElementRemoval[]
) => readonly string[]
export type DecideRemotePublication = (
  publication: SharedPublication
) => SharedPublication | false
export interface RemoteRestoreOwnerFacades {
  preflightRestoreSubtree: (
    snapshot: SceneTreeRestoreSnapshot
  ) => SceneTreeRestorePlan
  preflightRestoreProperties: (
    snapshot: PropsRestoreSnapshot,
    ownerRelations: readonly ElementPropertyOwnerRelation[]
  ) => PropsRestorePlan
  applyRestoreProperties: (
    plan: PropsRestorePlan,
    options?: EVENT_OPTIONS
  ) => readonly string[]
  applyRestoreSubtree: (
    plan: SceneTreeRestorePlan,
    options?: EVENT_OPTIONS
  ) => unknown
  removeElementsUsingActiveProperties?: ApplyRemoteCanonicalRemovalBatch
}

interface ClassifiedRemoteRestore {
  sceneSnapshot: SceneTreeRestoreSnapshot
  propsSnapshot: PropsRestoreSnapshot
}

interface RemoteCanonicalCreationBatch {
  readonly elements: readonly ElementRawData[]
  readonly properties: readonly PropertyComponentRawData[]
  readonly parentId: string
  readonly index: number
}

type RemoteApplyStep =
  | Readonly<{
      kind: 'event'
      event: AllEvent
    }>
  | Readonly<{
      kind: 'canonical-creation'
      batch: RemoteCanonicalCreationBatch
    }>
  | Readonly<{
      kind: 'canonical-removal'
      removals: readonly RemoteCanonicalElementRemoval[]
    }>

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

const classifyRemoteRestore = (
  publication: SharedPublication
): ClassifiedRemoteRestore | undefined => {
  const restoreDeliveries = publication.deliveries.filter(
    (delivery) =>
      delivery.channel === SharedDataChannelNames.SCENE_TREE &&
      delivery.eventName === EventTypes.CHANGE_SUBTREE &&
      isRecord(delivery.payload) &&
      delivery.payload.action === SCENE_TREE_ACTIONS.RESTORE_SUBTREE
  )
  if (restoreDeliveries.length === 0) {
    return
  }
  const restoreDelivery = restoreDeliveries[0] as SharedDelivery
  const restoreIndex = publication.deliveries.indexOf(restoreDelivery)
  const propertyDeliveries = publication.deliveries.slice(0, restoreIndex)
  const validRestoreEnvelope =
    restoreDeliveries.length === 1 &&
    restoreIndex === publication.deliveries.length - 1 &&
    propertyDeliveries.every(
      (delivery) =>
        delivery.channel === SharedDataChannelNames.PROPS &&
        delivery.eventName === EventTypes.ADD_PROPERTY &&
        isAddRemoveProperties(
          delivery.payload,
          PROPS_ACTIONS.ADD_PROPERTY,
          EventTypes.ADD_PROPERTY
        )
    )
  if (!validRestoreEnvelope || !isSubtreeChange(restoreDelivery.payload)) {
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
        (delivery) =>
          (delivery.payload as { data: PropsRestoreSnapshot['components'] })
            .data
      )
    }
  }
}

const toEvent = (delivery: SharedDelivery): AllEvent => {
  if (!isSupportedPayload(delivery)) {
    throw new Error(
      `[asyra-design collaboration] unsupported collaboration delivery ${delivery.channel}/${delivery.eventName}`
    )
  }
  return { type: delivery.eventName, payload: delivery.payload } as AllEvent
}

const isAddPropertyDelivery = (
  delivery: SharedDelivery | undefined
): delivery is SharedDelivery<
  Readonly<{
    data: readonly PropertyComponentRawData[]
  }>
> =>
  Boolean(
    delivery &&
      delivery.channel === SharedDataChannelNames.PROPS &&
      delivery.eventName === EventTypes.ADD_PROPERTY &&
      isAddRemoveProperties(
        delivery.payload,
        PROPS_ACTIONS.ADD_PROPERTY,
        EventTypes.ADD_PROPERTY
      )
  )

const isRemovePropertyDelivery = (
  delivery: SharedDelivery | undefined
): delivery is SharedDelivery<
  Readonly<{
    data: readonly PropertyComponentRawData[]
  }>
> =>
  Boolean(
    delivery &&
      delivery.channel === SharedDataChannelNames.PROPS &&
      delivery.eventName === EventTypes.REMOVE_PROPERTY &&
      isAddRemoveProperties(
        delivery.payload,
        PROPS_ACTIONS.REMOVE_PROPERTY,
        EventTypes.REMOVE_PROPERTY
      )
  )

const isDirectPublicationBatch = (
  publication: SharedPublication,
  batch: SharedDeliveryBatch
): boolean =>
  batch.artifactId === publication.artifactId &&
  batch.transactionId === publication.transactionId &&
  batch.origin === publication.origin &&
  batch.deliveries.length > 0 &&
  batch.deliveries.length === batch.records.length &&
  batch.deliveries.length === batch.changes.length &&
  batch.deliveries.every((delivery, index) => {
    const record = batch.records[index]
    return (
      delivery.artifactId === batch.artifactId &&
      delivery.batchId === batch.batchId &&
      delivery.transactionId === batch.transactionId &&
      delivery.origin === batch.origin &&
      delivery.kind === batch.kind &&
      delivery.channel === batch.channel &&
      delivery.sharedDelivery === batch.sharedDelivery &&
      record?.recordId === delivery.recordId &&
      record.deliveryId === delivery.deliveryId &&
      delivery.record.recordId === record.recordId &&
      delivery.record.deliveryId === record.deliveryId
    )
  })

const orderedIdsFromBatch = (batch: SharedDeliveryBatch): readonly string[] =>
  batch.records.flatMap(({ orderedIds }) => orderedIds)

const sameOrderedIds = (
  actual: readonly string[],
  expected: readonly string[]
): boolean =>
  actual.length === expected.length &&
  actual.every((id, index) => id === expected[index])

const hasDirectSliceBoundary = (
  publication: SharedPublication,
  batch: SharedDeliveryBatch
): boolean => {
  const sliceBoundary = publication.deliveryPlan.slices.find(
    ({ sliceId }) => sliceId === batch.sliceId
  )
  if (!sliceBoundary) return false
  const sliceBatches = publication.batches.filter(
    ({ sliceId }) => sliceId === batch.sliceId
  )
  if (
    sliceBatches.length === 0 ||
    sliceBatches.some(
      (sliceBatch) => !isDirectPublicationBatch(publication, sliceBatch)
    )
  ) {
    return false
  }
  const deliveryIds = sliceBatches.flatMap(({ deliveries }) =>
    deliveries.map(({ deliveryId }) => deliveryId)
  )
  const seenRecordIds = new Set<string>()
  const recordOrderedIds = sliceBatches.flatMap(({ records }) =>
    records.flatMap(({ orderedIds }) =>
      orderedIds.filter((orderedId) => {
        if (seenRecordIds.has(orderedId)) return false
        seenRecordIds.add(orderedId)
        return true
      })
    )
  )
  return (
    sameOrderedIds(sliceBoundary.orderedIds, deliveryIds) ||
    (publication.deliveryPlan.mode === 'progressive' &&
      sameOrderedIds(sliceBoundary.orderedIds, recordOrderedIds))
  )
}

const classifyCanonicalCreationBatch = (
  publication: SharedPublication,
  startBatchIndex: number
): Readonly<{
  batch: RemoteCanonicalCreationBatch
  consumedBatchCount: number
  consumedDeliveryCount: number
}> | null => {
  const propertyBatch = publication.batches[startBatchIndex]
  const sceneBatch = publication.batches[startBatchIndex + 1]
  if (
    !propertyBatch ||
    !sceneBatch ||
    !isDirectPublicationBatch(publication, propertyBatch) ||
    !isDirectPublicationBatch(publication, sceneBatch) ||
    !hasDirectSliceBoundary(publication, propertyBatch) ||
    !hasDirectSliceBoundary(publication, sceneBatch) ||
    propertyBatch.channel !== SharedDataChannelNames.PROPS ||
    sceneBatch.channel !== SharedDataChannelNames.SCENE_TREE ||
    propertyBatch.kind !== sceneBatch.kind ||
    propertyBatch.sharedDelivery !== sceneBatch.sharedDelivery
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

  for (const delivery of sceneBatch.deliveries) {
    if (
      !delivery ||
      delivery.eventName !== EventTypes.ADD_ELEMENT ||
      !isAddRemoveElement(
        delivery.payload,
        SCENE_TREE_ACTIONS.ADD_ELEMENT,
        EventTypes.ADD_ELEMENT
      )
    ) {
      return null
    }
    const payload = delivery.payload
    const elementData = payload.data as Record<string, unknown>
    if (
      !isNonBlankString(payload.parentId) ||
      !Number.isInteger(payload.index) ||
      !isRecord(elementData.props) ||
      elementData.parentId !== payload.parentId
    ) {
      return null
    }

    parentId ??= payload.parentId
    insertionIndex ??= Number(payload.index)
    if (
      payload.parentId !== parentId ||
      Number(payload.index) !== insertionIndex + elements.length
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
    elements.push(elementData as unknown as ElementRawData)
  }

  const elementIds = elements.map(({ id }) => id)
  const propertyOrderedIds = orderedIdsFromBatch(propertyBatch)
  const sceneOrderedIds = orderedIdsFromBatch(sceneBatch)
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
    batch: Object.freeze({
      elements: Object.freeze(elements),
      properties: Object.freeze(properties),
      parentId,
      index: insertionIndex
    }),
    consumedBatchCount: 2,
    consumedDeliveryCount:
      propertyBatch.deliveries.length + sceneBatch.deliveries.length
  })
}

const classifyCanonicalRemovalBatch = (
  publication: SharedPublication,
  startBatchIndex: number
): Readonly<{
  removals: readonly RemoteCanonicalElementRemoval[]
  consumedBatchCount: number
  consumedDeliveryCount: number
}> | null => {
  const sceneBatch = publication.batches[startBatchIndex]
  const propertyBatch = publication.batches[startBatchIndex + 1]
  if (
    !sceneBatch ||
    !propertyBatch ||
    !isDirectPublicationBatch(publication, sceneBatch) ||
    !isDirectPublicationBatch(publication, propertyBatch) ||
    !hasDirectSliceBoundary(publication, sceneBatch) ||
    !hasDirectSliceBoundary(publication, propertyBatch) ||
    sceneBatch.channel !== SharedDataChannelNames.SCENE_TREE ||
    propertyBatch.channel !== SharedDataChannelNames.PROPS ||
    sceneBatch.kind !== propertyBatch.kind ||
    sceneBatch.sharedDelivery !== propertyBatch.sharedDelivery ||
    !propertyBatch.deliveries.every(isRemovePropertyDelivery)
  ) {
    return null
  }

  const propertyIds = new Set(
    propertyBatch.deliveries.flatMap(({ payload }) =>
      payload.data.map(({ id }) => id)
    )
  )
  let observedPropertyOwnerCount = 0
  const removals: RemoteCanonicalElementRemoval[] = []
  for (const delivery of sceneBatch.deliveries) {
    if (
      delivery.eventName !== EventTypes.REMOVE_ELEMENT ||
      !isAddRemoveElement(
        delivery.payload,
        SCENE_TREE_ACTIONS.REMOVE_ELEMENT,
        EventTypes.REMOVE_ELEMENT
      )
    ) {
      return null
    }
    const payload = delivery.payload
    const elementData = payload.data as Record<string, unknown>
    if (
      !isNonBlankString(payload.parentId) ||
      !Number.isInteger(payload.index) ||
      elementData.parentId !== payload.parentId ||
      !isRecord(elementData.props)
    ) {
      return null
    }
    const ownerIds = Object.values(elementData.props)
    if (
      ownerIds.some(
        (propertyId) =>
          !isNonBlankString(propertyId) || !propertyIds.has(propertyId)
      )
    ) {
      return null
    }
    observedPropertyOwnerCount += ownerIds.length
    removals.push(
      Object.freeze({
        data: elementData as unknown as ElementRawData,
        parentId: payload.parentId,
        index: Number(payload.index)
      })
    )
  }

  const elementIds = removals.map(({ data }) => data.id)
  if (
    removals.length === 0 ||
    new Set(elementIds).size !== elementIds.length ||
    observedPropertyOwnerCount === 0 ||
    !sameOrderedIds(orderedIdsFromBatch(sceneBatch), elementIds) ||
    !sameOrderedIds(orderedIdsFromBatch(propertyBatch), elementIds)
  ) {
    return null
  }

  return Object.freeze({
    removals: Object.freeze(removals),
    consumedBatchCount: 1,
    consumedDeliveryCount: sceneBatch.deliveries.length
  })
}

const createRemoteApplySteps = (
  publication: SharedPublication,
  events: readonly AllEvent[],
  applyCanonicalCreationBatch?: ApplyRemoteCanonicalCreationBatch,
  applyCanonicalRemovalBatch?: ApplyRemoteCanonicalRemovalBatch
): readonly RemoteApplyStep[] => {
  if (!applyCanonicalCreationBatch && !applyCanonicalRemovalBatch) {
    return Object.freeze(
      events.map((event) => Object.freeze({ kind: 'event' as const, event }))
    )
  }

  const steps: RemoteApplyStep[] = []
  const artifactDeliveries = publication.batches.flatMap(
    ({ deliveries }) => deliveries
  )
  if (
    artifactDeliveries.length !== publication.deliveries.length ||
    artifactDeliveries.some(
      ({ deliveryId }, index) =>
        deliveryId !== publication.deliveries[index]?.deliveryId
    )
  ) {
    throw new Error(
      '[asyra-design collaboration] publication delivery order does not match Factory batch evidence'
    )
  }
  let batchIndex = 0
  let deliveryIndex = 0
  while (batchIndex < publication.batches.length) {
    const creation = applyCanonicalCreationBatch
      ? classifyCanonicalCreationBatch(publication, batchIndex)
      : null
    if (creation) {
      steps.push(
        Object.freeze({
          kind: 'canonical-creation',
          batch: creation.batch
        })
      )
      batchIndex += creation.consumedBatchCount
      deliveryIndex += creation.consumedDeliveryCount
      continue
    }
    const removal = applyCanonicalRemovalBatch
      ? classifyCanonicalRemovalBatch(publication, batchIndex)
      : null
    if (removal) {
      steps.push(
        Object.freeze({
          kind: 'canonical-removal',
          removals: removal.removals
        })
      )
      batchIndex += removal.consumedBatchCount
      deliveryIndex += removal.consumedDeliveryCount
      continue
    }
    const batch = publication.batches[batchIndex] as SharedDeliveryBatch
    batch.deliveries.forEach(() => {
      steps.push(
        Object.freeze({
          kind: 'event',
          event: events[deliveryIndex] as AllEvent
        })
      )
      deliveryIndex += 1
    })
    batchIndex += 1
  }
  return Object.freeze(steps)
}

export const createAsyraDesignPublicationProcessor =
  (
    runRemoteTransaction: RunRemoteTransaction,
    process: ProcessOperation,
    decideRemotePublication: DecideRemotePublication = (publication) =>
      publication,
    restoreOwners?: RemoteRestoreOwnerFacades,
    applyCanonicalCreationBatch?: ApplyRemoteCanonicalCreationBatch
  ): ((publication: SharedPublication) => boolean) =>
  (publication) => {
    return runWithDetachedBrowserTiming(() => {
      measureBrowserDragPhase('collaboration:remote-input-preflight', () =>
        publication.deliveries.forEach(toEvent)
      )
      const inboundRestore = measureBrowserDragPhase(
        'collaboration:remote-restore-classify',
        () => classifyRemoteRestore(publication)
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
      const events = measureBrowserDragPhase(
        'collaboration:remote-event-materialization',
        () => acceptedPublication.deliveries.map(toEvent)
      )
      const acceptedRestore = measureBrowserDragPhase(
        'collaboration:remote-accepted-restore-classify',
        () => classifyRemoteRestore(acceptedPublication)
      )
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
        const scenePlan = restoreOwners.preflightRestoreSubtree(
          acceptedRestore.sceneSnapshot
        )
        const propsPlan = restoreOwners.preflightRestoreProperties(
          acceptedRestore.propsSnapshot,
          scenePlan.propertyOwnerRelations
        )
        measureBrowserDragPhase('collaboration:remote-transaction-apply', () =>
          runCanonicalTransaction(() => {
            restoreOwners.applyRestoreProperties(propsPlan)
            restoreOwners.applyRestoreSubtree(scenePlan)
          })
        )
        publishEventsToObservers(events)
        return true
      }
      const applySteps = measureBrowserDragPhase(
        'collaboration:remote-canonical-batch-plan',
        () =>
          createRemoteApplySteps(
            acceptedPublication,
            events,
            replayMode === null ? applyCanonicalCreationBatch : undefined,
            restoreOwners?.removeElementsUsingActiveProperties
              ? (removals) =>
                  restoreOwners.removeElementsUsingActiveProperties?.(
                    removals
                  ) ?? []
              : undefined
          )
      )
      measureBrowserDragPhase('collaboration:remote-transaction-apply', () =>
        runCanonicalTransaction(() => {
          applySteps.forEach((step) => {
            if (step.kind === 'event') {
              if (step.event.type === EventTypes.ADD_ELEMENT) {
                emitDiagnosticCounter(
                  'collaboration:remote-add-element-single-count'
                )
              }
              if (process(step.event) === false) {
                throw new Error(
                  '[asyra-design collaboration] canonical remote event was not applied'
                )
              }
              return
            }
            if (step.kind === 'canonical-removal') {
              const appliedIds = measureBrowserDragPhase(
                'collaboration:remote-canonical-removal-batch-apply',
                () =>
                  restoreOwners?.removeElementsUsingActiveProperties?.(
                    step.removals
                  ) ?? []
              )
              const expectedIds = step.removals.map(({ data }) => data.id)
              if (
                appliedIds.length !== expectedIds.length ||
                appliedIds.some((id, index) => id !== expectedIds[index])
              ) {
                throw new Error(
                  '[asyra-design collaboration] canonical removal batch did not apply exact ids'
                )
              }
              return
            }
            const { batch } = step
            emitDiagnosticCounter(
              'collaboration:remote-add-element-batch-count'
            )
            emitDiagnosticCounter(
              'collaboration:remote-add-element-batch-size',
              batch.elements.length
            )
            const appliedIds = measureBrowserDragPhase(
              'collaboration:remote-canonical-batch-apply',
              () =>
                applyCanonicalCreationBatch?.(
                  batch.elements,
                  batch.properties,
                  batch.parentId,
                  batch.index
                ) ?? []
            )
            const expectedIds = batch.elements.map(({ id }) => id)
            if (
              appliedIds.length !== expectedIds.length ||
              appliedIds.some((id, index) => id !== expectedIds[index])
            ) {
              throw new Error(
                '[asyra-design collaboration] canonical creation batch did not apply exact ids'
              )
            }
          })
        })
      )
      publishEventsToObservers(events)
      return true
    })
  }
