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
  type PropertyComponentRawData,
  type PropsRestoreSnapshot,
  SCENE_TREE_ACTIONS,
  type SceneTreeRestoreSnapshot,
  type SubtreeChange,
  type UpdateElementDataChange,
  SharedDataChannelNames,
  emitDiagnosticCounter,
  measureBrowserDragPhase
} from '@asyra/utils'
import { isNonBlankString } from './wire-values'
import {
  decodePublicationFramePublication,
  type DocumentSessionBootstrap
} from './protocol'

type RunRemoteTransaction = (mutate: () => void) => void
type RunRemoteTransactionProgressively = (
  mutateSlices: readonly (() => void)[],
  settleAfterSlice: (completedSliceIndex: number) => Promise<void>
) => Promise<void>
type RemoteCanonicalElementRemoval = Extract<
  CanonicalChange,
  { kind: 'element-removal' }
>['removals'][number]
export type DecideRemotePublication = (
  publication: SharedPublication
) => SharedPublication | false

export interface PublicationProcessorOptions {
  readonly runRemoteTransaction: RunRemoteTransaction
  readonly runRemoteTransactionProgressively: RunRemoteTransactionProgressively
  readonly decideRemotePublication: DecideRemotePublication
  readonly applyCanonicalChanges: CanonicalChangeAPIs['applyCanonicalChanges']
  readonly settleRemoteSlice: () => Promise<void>
}

interface ClassifiedRemoteRestore {
  sceneSnapshot: SceneTreeRestoreSnapshot
  propsSnapshot: PropsRestoreSnapshot
}

type SharedPublicationSlice = SharedPublication['slices'][number]

interface OrganizedRemotePublication {
  readonly sourceSlices: readonly SharedPublicationSlice[]
  readonly batches: readonly SharedPublicationBatch[]
  readonly deliveries: readonly Readonly<{
    channel: string
    delivery: SharedPublicationDelivery
  }>[]
  readonly sliceByBatch: ReadonlyMap<
    SharedPublicationBatch,
    SharedPublicationSlice
  >
  readonly batchesBySlice: ReadonlyMap<
    SharedPublicationSlice,
    readonly SharedPublicationBatch[]
  >
}

const publicationReplayMode = (
  origin: SharedPublication['origin']
): TransactionReplayMode | null => {
  if (origin === 'undo' || origin === 'redo') {
    return origin
  }
  return origin === 'rollback-compensation' ? 'rollback' : null
}

type CanonicalElementEvidenceDirection = 'add' | 'remove'

const canonicalElementEntriesFromDelivery = (
  delivery: SharedPublicationDelivery,
  direction: CanonicalElementEvidenceDirection
): readonly AddRemoveElementEntry[] | null => {
  const scalarEvent =
    direction === 'add' ? EventTypes.ADD_ELEMENT : EventTypes.REMOVE_ELEMENT
  if (delivery.eventName === scalarEvent) {
    const { data, parentId, index } = delivery.payload as {
      readonly data: ElementRawData
      readonly parentId: string
      readonly index: number
    }
    return [{ data, parentId, index }]
  }

  const batchEvent =
    direction === 'add' ? EventTypes.ADD_ELEMENTS : EventTypes.REMOVE_ELEMENTS
  if (delivery.eventName === batchEvent) {
    return (
      delivery.payload as {
        readonly entries: readonly AddRemoveElementEntry[]
      }
    ).entries
  }
  return null
}

const classifyRemoteRestore = (
  organization: OrganizedRemotePublication
): ClassifiedRemoteRestore | undefined => {
  const { deliveries } = organization
  const restoreDeliveries = deliveries.filter(
    ({ channel, delivery }) =>
      channel === SharedDataChannelNames.SCENE_TREE &&
      delivery.eventName === EventTypes.CHANGE_SUBTREE &&
      (delivery.payload as { readonly action?: unknown }).action ===
        SCENE_TREE_ACTIONS.RESTORE_SUBTREE
  )
  if (restoreDeliveries.length === 0) {
    return
  }
  const restoreDelivery = restoreDeliveries[0]?.delivery
  const restoreIndex = deliveries.findIndex(
    ({ delivery }) => delivery === restoreDelivery
  )
  const propertyDeliveries = deliveries.slice(0, restoreIndex)
  if (!restoreDelivery) {
    throw new Error('[collaboration] invalid subtree restore publication')
  }

  const payload = restoreDelivery.payload as SubtreeChange
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

const isAddPropertyDelivery = (
  delivery: SharedPublicationDelivery | undefined
): delivery is SharedPublicationDelivery<
  Readonly<{
    data: readonly PropertyComponentRawData[]
  }>
> => Boolean(delivery && delivery.eventName === EventTypes.ADD_PROPERTY)

const isRemovePropertyDelivery = (
  delivery: SharedPublicationDelivery | undefined
): delivery is SharedPublicationDelivery<
  Readonly<{
    data: readonly PropertyComponentRawData[]
  }>
> => Boolean(delivery && delivery.eventName === EventTypes.REMOVE_PROPERTY)

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
  const batchesBySlice = new Map<
    SharedPublicationSlice,
    readonly SharedPublicationBatch[]
  >()
  if (slices.length === 0) {
    throw new Error(
      '[collaboration] publication delivery order does not match Factory batch evidence'
    )
  }

  for (const slice of slices) {
    const sliceBatches = slice.batches
    batchesBySlice.set(slice, sliceBatches)
    if (sliceBatches.length === 0) {
      throw new Error(
        '[collaboration] publication contains invalid direct Factory batch evidence'
      )
    }

    for (const batch of sliceBatches) {
      const batchDeliveries = batch.deliveries
      if (batchDeliveries.length === 0) {
        throw new Error(
          '[collaboration] publication contains invalid direct Factory batch evidence'
        )
      }
      sliceByBatch.set(batch, slice)
      batches.push(batch)

      for (const delivery of batchDeliveries) {
        deliveries.push({
          channel: batch.channel,
          delivery
        })
      }
    }
  }

  if (batches.length === 0 || deliveries.length === 0) {
    throw new Error(
      '[collaboration] publication delivery order does not match Factory batch evidence'
    )
  }
  return Object.freeze({
    sourceSlices: slices,
    batches: Object.freeze(batches),
    deliveries: Object.freeze(deliveries.map((entry) => Object.freeze(entry))),
    sliceByBatch,
    batchesBySlice
  })
}

const orderTrustedElementEntries = (
  entries: readonly AddRemoveElementEntry[],
  batch: SharedPublicationBatch
): readonly AddRemoveElementEntry[] => {
  const orderedIds = batch.deliveries.flatMap(({ orderedIds: ids }) => ids)
  if (orderedIds.length === 0) return entries
  const entriesById = new Map(entries.map((entry) => [entry.data.id, entry]))
  const orderedEntries = orderedIds.flatMap((orderedId) => {
    const entry = entriesById.get(orderedId)
    return entry ? [entry] : []
  })
  return orderedEntries.length > 0 ? orderedEntries : entries
}

const classifyPropertyComponentBatch = (
  batch: SharedPublicationBatch
): Readonly<{
  records: readonly Readonly<{
    propertyId: string
    key: string
    set?: Readonly<Record<string, Readonly<Record<string, unknown>>>>
    remove?: readonly string[]
  }>[]
  updates: readonly PropertyComponentValuesUpdate[]
}> | null => {
  if (
    !batch.deliveries.some(
      ({ eventName }) => eventName === EventTypes.UPDATE_PROPERTY
    )
  ) {
    return null
  }
  if (batch.channel !== SharedDataChannelNames.PROPS) {
    throw new Error('[collaboration] invalid property-component batch evidence')
  }
  const structuralDeliveries: {
    kind: 'add' | 'remove'
    ownerPropertyId: string
    components: readonly PropertyComponentRawData[]
  }[] = []
  const updateDeliveries: {
    delivery: SharedPublicationDelivery
    payload: Record<string, unknown>
  }[] = []
  const updatesByPropertyId = new Map<
    string,
    { propertyId: string; values: Record<string, unknown> }
  >()
  batch.deliveries.forEach((delivery) => {
    const isAddition = isAddPropertyDelivery(delivery)
    const isRemoval = isRemovePropertyDelivery(delivery)
    if (isAddition || isRemoval) {
      structuralDeliveries.push({
        kind: isAddition ? 'add' : 'remove',
        ownerPropertyId: delivery.orderedIds[0] as string,
        components: Object.freeze([...delivery.payload.data])
      })
      return
    }
    if (delivery.eventName !== EventTypes.UPDATE_PROPERTY) {
      throw new Error(
        '[collaboration] invalid property-component batch evidence'
      )
    }
    updateDeliveries.push({
      delivery,
      payload: delivery.payload as Record<string, unknown>
    })
  })

  const structuralOwners: string[] = []
  const structuralByOwner = new Map<
    string,
    {
      additions: PropertyComponentRawData[]
      removals: PropertyComponentRawData[]
    }
  >()
  structuralDeliveries.forEach(({ kind, ownerPropertyId, components }) => {
    let structural = structuralByOwner.get(ownerPropertyId)
    if (!structural) {
      structural = { additions: [], removals: [] }
      structuralByOwner.set(ownerPropertyId, structural)
      structuralOwners.push(ownerPropertyId)
    }
    structural[kind === 'add' ? 'additions' : 'removals'].push(...components)
  })

  const consumedUpdates = new Set<SharedPublicationDelivery>()
  const records = structuralOwners.map((ownerPropertyId) => {
    const structural = structuralByOwner.get(ownerPropertyId)
    if (!structural) {
      throw new Error(
        '[collaboration] invalid property-component batch evidence'
      )
    }
    const removedIds = structural.removals.map(({ id }) => id)
    const relationshipUpdate = updateDeliveries.find(
      ({ delivery, payload }) => {
        return !consumedUpdates.has(delivery) && payload.id === ownerPropertyId
      }
    )
    if (!relationshipUpdate) {
      throw new Error(
        '[collaboration] invalid property-component batch evidence'
      )
    }
    const { delivery, payload } = relationshipUpdate
    consumedUpdates.add(delivery)
    return Object.freeze({
      propertyId: ownerPropertyId,
      key: payload.key as string,
      ...(structural.additions.length > 0
        ? {
            set: Object.freeze(
              Object.fromEntries(
                structural.additions.map((component) => [
                  component.id,
                  Object.freeze({ ...component })
                ])
              )
            )
          }
        : {}),
      ...(removedIds.length > 0 ? { remove: Object.freeze(removedIds) } : {})
    })
  })

  updateDeliveries.forEach(({ delivery, payload }) => {
    if (consumedUpdates.has(delivery)) {
      return
    }
    const change = payload
    const propertyId = change.id as string
    const update = updatesByPropertyId.get(propertyId) ?? {
      propertyId,
      values: {}
    }
    update.values[change.key as string] = change.after
    updatesByPropertyId.set(propertyId, update)
  })
  return Object.freeze({
    records: Object.freeze(records),
    updates: Object.freeze(
      [...updatesByPropertyId.values()].map(({ propertyId, values }) =>
        Object.freeze({
          propertyId,
          values: Object.freeze({ ...values })
        })
      )
    )
  })
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
  if (batch.channel !== SharedDataChannelNames.SCENE_TREE) {
    throw new Error('[collaboration] invalid element-data batch evidence')
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
  if (batch.channel !== SharedDataChannelNames.SCENE_TREE) {
    throw new Error('[collaboration] invalid hierarchy-move batch evidence')
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
    (sceneDelivery.payload as { readonly action?: unknown }).action !==
      SCENE_TREE_ACTIONS.REMOVE_SUBTREE
  ) {
    return null
  }
  if (sceneBatch.deliveries.length !== 1) {
    throw new Error('[collaboration] invalid subtree removal Scene evidence')
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
    consumedBatchCount += 1
  }
  const payload = sceneDelivery.payload as SubtreeChange
  return Object.freeze({
    change: Object.freeze({
      action: payload.action,
      undoAction: payload.undoAction,
      eventName: payload.eventName,
      elementId: payload.elementId,
      removed: payload.removed,
      rootParentChildrenAfter: payload.rootParentChildrenAfter
    }),
    consumedBatchCount
  })
}

const classifyCanonicalCreationBatch = (
  organization: OrganizedRemotePublication,
  startBatchIndex: number
): Readonly<{
  changes: readonly CanonicalChange[]
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
  if (!isAddPropertyDelivery(propertyDeliveries[0])) {
    return null
  }
  const properties = propertyDeliveries.flatMap(
    ({ payload }) =>
      (
        payload as {
          readonly data: readonly PropertyComponentRawData[]
        }
      ).data
  )
  const elements: ElementRawData[] = []
  let parentId: string | undefined
  let insertionIndex: number | undefined
  let observedPropertyOwnerCount = 0
  const sourceEntries: AddRemoveElementEntry[] = []
  const hierarchyMoves: HierarchyMove[] = []
  let hierarchyMoveObserved = false

  for (const delivery of sceneBatch.deliveries) {
    const entries = canonicalElementEntriesFromDelivery(delivery, 'add')
    if (entries) {
      if (hierarchyMoveObserved) return null
      sourceEntries.push(...entries)
      continue
    }
    if (delivery.eventName !== EventTypes.MOVE_ELEMENTS) {
      return null
    }
    hierarchyMoveObserved = true
    hierarchyMoves.push(
      ...(delivery.payload as { readonly moves: readonly HierarchyMove[] })
        .moves
    )
  }
  for (const entry of orderTrustedElementEntries(sourceEntries, sceneBatch)) {
    const elementData = entry.data as unknown as {
      readonly props: Readonly<Record<string, string>>
    }

    parentId ??= entry.parentId
    insertionIndex ??= entry.index
    const propertyOwnerIds = Object.values(elementData.props)
    observedPropertyOwnerCount += propertyOwnerIds.length
    elements.push(entry.data)
  }

  if (
    elements.length === 0 ||
    parentId === undefined ||
    insertionIndex === undefined ||
    observedPropertyOwnerCount === 0
  ) {
    return null
  }

  const changes: CanonicalChange[] = [
    Object.freeze({
      kind: 'element-creation',
      elements: Object.freeze(elements),
      properties: Object.freeze(properties),
      parentId,
      index: insertionIndex
    })
  ]
  if (hierarchyMoves.length > 0) {
    changes.push(
      Object.freeze({
        kind: 'hierarchy-moves',
        moves: Object.freeze(hierarchyMoves)
      })
    )
  }
  return Object.freeze({
    changes: Object.freeze(changes),
    consumedBatchCount: 2
  })
}

const classifyCanonicalRemovalBatch = (
  organization: OrganizedRemotePublication,
  startBatchIndex: number
): Readonly<{
  changes: readonly CanonicalChange[]
  consumedBatchCount: number
}> | null => {
  const { batches, sliceByBatch } = organization
  const sceneBatch = batches[startBatchIndex]
  if (!sceneBatch || sceneBatch.channel !== SharedDataChannelNames.SCENE_TREE) {
    return null
  }

  const removals: RemoteCanonicalElementRemoval[] = []
  const sourceEntries: AddRemoveElementEntry[] = []
  const hierarchyMoves: HierarchyMove[] = []
  let removalObserved = false
  for (const delivery of sceneBatch.deliveries) {
    const entries = canonicalElementEntriesFromDelivery(delivery, 'remove')
    if (entries) {
      removalObserved = true
      sourceEntries.push(...entries)
      continue
    }
    if (removalObserved || delivery.eventName !== EventTypes.MOVE_ELEMENTS) {
      return null
    }
    hierarchyMoves.push(
      ...(delivery.payload as { readonly moves: readonly HierarchyMove[] })
        .moves
    )
  }
  for (const entry of orderTrustedElementEntries(sourceEntries, sceneBatch)) {
    removals.push(
      Object.freeze({
        data: entry.data,
        parentId: entry.parentId,
        index: entry.index
      })
    )
  }

  if (removals.length === 0) return null

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
    sliceByBatch.get(sceneBatch) !== sliceByBatch.get(propertyBatch)
  ) {
    return null
  }

  const changes: CanonicalChange[] = []
  if (hierarchyMoves.length > 0) {
    changes.push(
      Object.freeze({
        kind: 'hierarchy-moves',
        moves: Object.freeze(hierarchyMoves)
      })
    )
  }
  changes.push(
    Object.freeze({
      kind: 'element-removal',
      removals: Object.freeze(removals)
    })
  )
  return Object.freeze({
    changes: Object.freeze(changes),
    consumedBatchCount: propertyBatch ? 2 : 1
  })
}

const appendRemoteCanonicalChange = (
  changes: CanonicalChange[],
  change: CanonicalChange
): void => {
  const previous = changes.at(-1)
  if (
    previous?.kind === 'element-removal' &&
    change.kind === 'element-removal' &&
    !previous.removals.some(({ data }) =>
      Array.isArray((data as { children?: unknown }).children)
    ) &&
    !change.removals.some(({ data }) =>
      Array.isArray((data as { children?: unknown }).children)
    )
  ) {
    changes[changes.length - 1] = Object.freeze({
      kind: 'element-removal',
      removals: Object.freeze([...previous.removals, ...change.removals])
    })
    return
  }
  changes.push(change)
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
      changes.push(...creation.changes)
      batchIndex += creation.consumedBatchCount
      continue
    }
    const removal = classifyCanonicalRemovalBatch(organization, batchIndex)
    if (removal) {
      removal.changes.forEach((change) =>
        appendRemoteCanonicalChange(changes, change)
      )
      batchIndex += removal.consumedBatchCount
      continue
    }
    const batch = batches[batchIndex] as SharedPublicationBatch
    const propertyComponents = classifyPropertyComponentBatch(batch)
    if (propertyComponents) {
      changes.push(
        Object.freeze({
          kind: 'property-components',
          ...(propertyComponents.records.length > 0
            ? { records: propertyComponents.records }
            : {}),
          updates: propertyComponents.updates
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
      `[collaboration] unsupported canonical Factory batch evidence at batch ${batchIndex} ${batch.channel}/${batch.deliveries.map(({ eventName }) => eventName).join(',')}`
    )
  }
  return Object.freeze(changes)
}

const canonicalChangesFromOrganizedPublication = (
  organization: OrganizedRemotePublication,
  restore: ClassifiedRemoteRestore | undefined
): readonly CanonicalChange[] =>
  restore
    ? Object.freeze([
        Object.freeze({
          kind: 'subtree-restore' as const,
          sceneSnapshot: restore.sceneSnapshot,
          propsSnapshot: restore.propsSnapshot
        })
      ])
    : createRemoteApplySteps(organization)

const organizeSourceSlice = (
  slice: SharedPublicationSlice,
  publication: OrganizedRemotePublication
): OrganizedRemotePublication => {
  const batches = [...(publication.batchesBySlice.get(slice) ?? [])]
  const sliceByBatch = new Map<SharedPublicationBatch, SharedPublicationSlice>()
  const batchesBySlice = new Map<
    SharedPublicationSlice,
    readonly SharedPublicationBatch[]
  >([[slice, batches]])
  batches.forEach((batch) => sliceByBatch.set(batch, slice))
  return Object.freeze({
    sourceSlices: Object.freeze([slice]),
    batches: Object.freeze(batches),
    deliveries: Object.freeze(
      batches.flatMap((batch) =>
        batch.deliveries.map((delivery) =>
          Object.freeze({ channel: batch.channel, delivery })
        )
      )
    ),
    sliceByBatch,
    batchesBySlice
  })
}

export const decodeDocumentPublication = (
  publication: SharedPublication
): readonly CanonicalChange[] => {
  const organization = organizeRemotePublication(publication)
  return canonicalChangesFromOrganizedPublication(
    organization,
    classifyRemoteRestore(organization)
  )
}

export interface ApplyDocumentSessionBootstrapTailOptions {
  readonly bootstrap: DocumentSessionBootstrap
  readonly applyPublication: (
    publication: SharedPublication
  ) => void | Promise<void>
}

const decodeBase64PublicationFrame = (encoded: string): Uint8Array => {
  const binary = globalThis.atob(encoded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

export const applyDocumentSessionBootstrapTail = async ({
  bootstrap,
  applyPublication
}: ApplyDocumentSessionBootstrapTailOptions): Promise<number> => {
  const { durableSequence, headSequence, pendingTail } = bootstrap
  if (
    !Number.isSafeInteger(durableSequence) ||
    durableSequence < 0 ||
    !Number.isSafeInteger(headSequence) ||
    headSequence < durableSequence ||
    !Array.isArray(pendingTail) ||
    pendingTail.length !== headSequence - durableSequence
  ) {
    throw new Error(
      '[collaboration] document bootstrap sequence range is invalid'
    )
  }

  const publicationIds = new Set<string>()
  const decodedPublications = pendingTail.map(
    (
      { sequence, publicationId, encodedPublicationFrames, fromActorId },
      index
    ) => {
      const decoded = decodePublicationFramePublication(
        encodedPublicationFrames.map(decodeBase64PublicationFrame)
      ).publication
      if (
        sequence !== durableSequence + index + 1 ||
        !isNonBlankString(fromActorId) ||
        decoded.publicationId !== publicationId ||
        publicationIds.has(publicationId)
      ) {
        throw new Error(
          '[collaboration] document bootstrap tail is gapped or duplicated'
        )
      }
      publicationIds.add(publicationId)
      return decoded
    }
  )

  for (const publication of decodedPublications) {
    await applyPublication(publication)
  }
  return headSequence
}

export const createPublicationProcessor =
  ({
    runRemoteTransaction,
    runRemoteTransactionProgressively,
    decideRemotePublication,
    applyCanonicalChanges,
    settleRemoteSlice
  }: PublicationProcessorOptions): ((
    publication: SharedPublication
  ) => boolean | Promise<boolean>) =>
  (publication) => {
    return (() => {
      const acceptedPublication = measureBrowserDragPhase(
        'collaboration:remote-policy',
        () => decideRemotePublication(publication)
      )
      if (acceptedPublication === false) {
        return false
      }
      const replayMode = publicationReplayMode(acceptedPublication.origin)
      const acceptedOrganization = measureBrowserDragPhase(
        'collaboration:remote-input-organize',
        () => organizeRemotePublication(acceptedPublication)
      )
      const acceptedRestore = measureBrowserDragPhase(
        'collaboration:remote-restore-classify',
        () => classifyRemoteRestore(acceptedOrganization)
      )
      const canonicalSlices = measureBrowserDragPhase(
        'collaboration:remote-canonical-batch-derive',
        () => {
          if (acceptedRestore) {
            return [
              canonicalChangesFromOrganizedPublication(
                acceptedOrganization,
                acceptedRestore
              )
            ]
          }
          return acceptedOrganization.sourceSlices.map((slice) =>
            canonicalChangesFromOrganizedPublication(
              organizeSourceSlice(slice, acceptedOrganization),
              undefined
            )
          )
        }
      )
      const mutateSlices = canonicalSlices.map(
        (canonicalChanges): (() => void) =>
          () => {
            canonicalChanges.forEach((change) => {
              if (change.kind !== 'element-creation') return
              emitDiagnosticCounter(
                'collaboration:remote-add-element-batch-count'
              )
              emitDiagnosticCounter(
                'collaboration:remote-add-element-batch-size',
                change.elements.length
              )
            })
            const apply = () => applyCanonicalChanges(canonicalChanges)
            if (replayMode) {
              runInTransactionReplayMode(replayMode, apply)
              return
            }
            apply()
          }
      )
      if (mutateSlices.length === 1) {
        measureBrowserDragPhase('collaboration:remote-transaction-apply', () =>
          runRemoteTransaction(mutateSlices[0] as () => void)
        )
        return true
      }
      return runRemoteTransactionProgressively(mutateSlices, () =>
        settleRemoteSlice()
      ).then(() => true)
    })()
  }
