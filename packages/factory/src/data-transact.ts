import type {
  ComputedDataPatchChange,
  EndTransactionOptions,
  PropsChange,
  SceneTreeChange,
  SharedDeliveryMode,
  ElementSelectionChange,
  MoveElementsChange,
  TransactionFailure,
  TransactionOrigin,
  TransactionStatus,
  TransactionStatusPayload,
  UpdateElementPatchChange
} from '@asyra/utils'
import {
  UNDO,
  measureBrowserDragPhase,
  setOwnEnumerableValue
} from '@asyra/utils'

type TransactionPayload = PropsChange | SceneTreeChange | ElementSelectionChange
interface EffectiveMutationOptions {
  undoable: boolean
  rollbackable: boolean
  shared?: string
  sharedDelivery: SharedDeliveryMode
}

interface JournalSharedRecord {
  occurrence: number
  orderedIds: readonly string[]
  change: TransactionPayload
  delivered: boolean
  published: boolean
  batch?: SharedDeliveryBatch
  delivery?: SharedDelivery
  inverseEvents?: readonly AllEvent[]
  evidence?: FactoryMutationSharedRecordEvidence
}

interface JournalSharedChange {
  name: string
  change: TransactionPayload
  orderedIds: readonly string[]
  records: JournalSharedRecord[]
  recordInversesPrepared: boolean
  inverseEvents?: readonly AllEvent[]
}

interface TransactionJournalEntry {
  index: number
  event: AllEvent
  options: EffectiveMutationOptions
  source: 'action' | 'replay'
  inverseEvents?: readonly AllEvent[]
  shared?: JournalSharedChange
}
interface JournalSharedRecordRef {
  entry: TransactionJournalEntry
  record: JournalSharedRecord
}
interface PreparedHistoryTransition {
  complete: () => void
  rollback: () => void
}
interface HistorySharedReplay {
  name: string
  sharedDelivery: SharedDeliveryMode
  orderedIds: readonly string[]
  records: readonly {
    orderedIds: readonly string[]
    payload: TransactionPayload
  }[]
  deliveryPlan?: FactoryMutationDeliveryPlan
}
interface SuppressedHistorySharedReplay {
  suppress: true
}
type HistorySharedReplayDirective =
  | HistorySharedReplay
  | SuppressedHistorySharedReplay
type HistorySharedReplayOutputs = readonly (
  | HistorySharedReplayDirective
  | undefined
)[]
interface DataTransactCallbacks {
  onCommitCapture?: (payload: TransactionStatusPayload) => void
  onStatus?: (payload: TransactionStatusPayload) => void
  onUserActionCompleted?: (payload: UserActionCompletedPayload) => void
  onReplayEvent?: (
    event: AllEvent,
    mode: TransactionReplayMode
  ) => boolean | { handled: boolean; applied: boolean }
  onSharedDelivery?: (delivery: SharedDelivery) => void
  hasSharedDeliverySubscribers?: () => boolean
  onSharedDeliveryBatch?: (batch: SharedDeliveryBatch) => void
  onSharedPublication?: (publication: SharedPublication) => void
  onMutationBatchArtifact?: FactoryMutationBatchArtifactSubscriber
}
import type {
  AllEvent,
  TransactionReplayMode,
  UpdateTransactionEvent,
  UserActionCompletedPayload
} from '@asyra/reactive-events'
import {
  acknowledgeTransactionReplayApplied,
  EventTypes,
  endTransaction,
  isTransactionReplayApplied,
  publishEvent,
  publishEventToObservers,
  runInTransactionReplayMode,
  startTransaction,
  userActionCompleted,
  wasTransactionReplayApplied,
  updateUndoRedoStatus
} from '@asyra/reactive-events'
import {
  canPushFactoryOwnedBatchToSharedChannel,
  pushFactoryOwnedBatchToSharedChannel,
  SharedDataChannelRegistry
} from './shared-data-channel'
import {
  TransactionRollbackError,
  TransactionValidationError,
  type TransactionInverter,
  type CanonicalEventApply,
  type TransactionValidationContext,
  type TransactionValidator
} from './transaction'
import type {
  FactoryMutationDeliveryPlan,
  SharedDelivery,
  SharedDeliveryBatch,
  SharedPublication
} from './shared-delivery'
import {
  FactoryMutationBatchAcceptanceError,
  type FactoryMutationBatchArtifact,
  type FactoryMutationBatchArtifactSubscriber,
  type FactoryMutationBatchChange,
  type FactoryMutationBatchDeliveryEvidence,
  type FactoryMutationBatchDeliveryHandle,
  type FactoryMutationEventDeliveryEvidence,
  type FactoryMutationSharedRecordEvidence
} from './mutation-batch'
import {
  cloneAndDeepFreezeValue,
  cloneValue,
  deepFreezeValue
} from './value-clone'

const BUILT_IN_INVERTIBLE_EVENT_TYPES = new Set<string>([
  EventTypes.ADD_ELEMENT,
  EventTypes.REMOVE_ELEMENT,
  EventTypes.MOVE_ELEMENTS,
  EventTypes.CHANGE_SUBTREE,
  EventTypes.UPDATE_COMPUTED_DATA,
  EventTypes.UPDATE_COMPUTED_DATA_PATCH,
  EventTypes.ADD_PROPERTY,
  EventTypes.REMOVE_PROPERTY,
  EventTypes.UPDATE_PROPERTY,
  EventTypes.SELECT_ELEMENTS,
  EventTypes.SELECT_VECTOR_POINTS,
  EventTypes.SELECT_VECTOR_SEGMENTS
])

type TransactionPayloadOptions = NonNullable<TransactionPayload['options']>

const toDefinedMutationOptions = (
  options: TransactionPayload['options']
): TransactionPayloadOptions | undefined => {
  if (!options) return

  const definedOptions: TransactionPayloadOptions = {}
  if (options.undoable !== undefined) {
    definedOptions.undoable = options.undoable
  }
  if (options.rollbackable !== undefined) {
    definedOptions.rollbackable = options.rollbackable
  }
  if (options.shared !== undefined) {
    definedOptions.shared = options.shared
  }
  if (options.sharedDelivery !== undefined) {
    definedOptions.sharedDelivery = options.sharedDelivery
  }

  if (Object.keys(definedOptions).length === 0) return
  return definedOptions
}

const toSharedChannelPayload = (
  payload: TransactionPayload,
  options: UpdateTransactionEvent['options']
): TransactionPayload => {
  const { options: originalPayloadOptions, ...payloadWithoutUnsetOptions } =
    payload
  const existingPayloadOptions = toDefinedMutationOptions(
    originalPayloadOptions
  )
  const normalizedPayload = existingPayloadOptions
    ? { ...payloadWithoutUnsetOptions, options: existingPayloadOptions }
    : payloadWithoutUnsetOptions
  if (!options) {
    return normalizedPayload as TransactionPayload
  }

  const payloadOptions: Omit<NonNullable<typeof options>, 'shared'> = {}
  if (options.undoable !== undefined) {
    payloadOptions.undoable = options.undoable
  }
  if (options.rollbackable !== undefined) {
    payloadOptions.rollbackable = options.rollbackable
  }
  if (options.sharedDelivery !== undefined) {
    payloadOptions.sharedDelivery = options.sharedDelivery
  }
  const hasPayloadOptions = Object.keys(payloadOptions).length > 0
  if (!hasPayloadOptions) {
    return normalizedPayload as TransactionPayload
  }

  return {
    ...normalizedPayload,
    options: {
      ...(existingPayloadOptions ?? {}),
      ...payloadOptions
    }
  } as TransactionPayload
}

const invertComputedDataPatchChange = (
  patch: ComputedDataPatchChange
): ComputedDataPatchChange => {
  const inverted: ComputedDataPatchChange = {}

  Object.entries(patch.values ?? {}).forEach(([key, change]) => {
    inverted.values ??= {}
    setOwnEnumerableValue(inverted.values, key, {
      before: change.after,
      after: change.before
    })
  })

  Object.entries(patch.records ?? {}).forEach(([key, recordPatch]) => {
    const nextRecordPatch: NonNullable<
      ComputedDataPatchChange['records']
    >[string] = {}

    Object.entries(recordPatch.set ?? {}).forEach(([recordId, change]) => {
      if (!Object.prototype.hasOwnProperty.call(change, 'before')) {
        nextRecordPatch.remove ??= {}
        setOwnEnumerableValue(nextRecordPatch.remove, recordId, {
          before: change.after
        })
        return
      }

      nextRecordPatch.set ??= {}
      setOwnEnumerableValue(nextRecordPatch.set, recordId, {
        before: change.after,
        after: change.before
      })
    })

    Object.entries(recordPatch.remove ?? {}).forEach(([recordId, change]) => {
      nextRecordPatch.set ??= {}
      setOwnEnumerableValue(nextRecordPatch.set, recordId, {
        after: change.before
      })
    })

    if (
      Object.keys(nextRecordPatch.set ?? {}).length > 0 ||
      Object.keys(nextRecordPatch.remove ?? {}).length > 0
    ) {
      inverted.records ??= {}
      setOwnEnumerableValue(inverted.records, key, nextRecordPatch)
    }
  })

  return inverted
}

const cloneEvent = (event: AllEvent): AllEvent => cloneValue(event)

const isReplayEvent = (value: unknown): value is AllEvent =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { type?: unknown }).type === 'string'

const isPlainRecord = (value: unknown): value is object => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

const toReplayFailure = (cause: unknown): TransactionFailure => ({
  kind: 'explicit',
  message: cause instanceof Error ? cause.message : undefined,
  cause
})

class DataTransact {
  private journal: TransactionJournalEntry[] = []
  private undoStack: FactoryMutationBatchArtifact[] = []
  private redoStack: FactoryMutationBatchArtifact[] = []
  private isTransacting = 0
  private inUndo = false
  private inRedo = false
  private applyingReplayEvent = false
  private restoringNestedReplay = false
  private nestedReplaySourceEvents: AllEvent[] | null = null
  private nestedReplaySourceArtifact: FactoryMutationBatchArtifact | null = null
  private nestedReplayRestorationPlans: AllEvent[][] = []
  private actionId = 0
  private transactionId = 0
  private currentTransactionId = 0
  private currentArtifactId = ''
  private activeOrigin: TransactionOrigin = 'action'
  private rollbackOnly = false
  private rollbackFailure: TransactionFailure | undefined
  private readonly pendingMutationBatchArtifacts: FactoryMutationBatchArtifact[] =
    []
  private emittingMutationBatchArtifacts = false
  private transactionSettlementDepth = 0
  private readonly pendingSharedPublications: SharedPublication[] = []
  private emittingSharedPublications = false
  private readonly pendingImmediatePublicationEntries: TransactionJournalEntry[] =
    []
  private immediatePublicationToken = 0
  private scheduledImmediatePublicationToken: number | null = null
  private publicationSequence = 0
  private deliveryBatchSequence = 0
  private currentSharedDeliveryBatches: SharedDeliveryBatch[] = []
  private readonly preparedSharedBatchRecords = new Map<
    string,
    JournalSharedRecordRef[]
  >()
  private transactionEndDeliveryBatches: readonly SharedDeliveryBatch[] | null =
    null
  private readonly transactionEndBatchesBySlice = new Map<
    string,
    readonly SharedDeliveryBatch[]
  >()
  private readonly transactionEndRecordsBySlice = new Map<
    string,
    readonly JournalSharedRecordRef[]
  >()
  private currentMutationBatchArtifact: FactoryMutationBatchArtifact | undefined
  private activeDeliveryPlan: FactoryMutationDeliveryPlan | undefined
  private readonly activeDeliverySliceByOrderedId = new Map<string, string>()
  private readonly activeDeliverySliceOrder = new Map<string, number>()
  private readonly activeDeliveryBoundaryBySliceId = new Map<
    string,
    FactoryMutationDeliveryPlan['slices'][number]
  >()
  private readonly activeDeliveryOrderedIdOrder = new Map<string, number>()
  private activeDeliveryPlanValidated = false
  private nextDeliverySliceIndex = 0
  private activeDeliveryHandle: FactoryMutationBatchDeliveryHandle | undefined
  private activeDeliveryHandleToken: symbol | undefined
  private readonly deliveryArtifactFinalizers = new Map<
    string,
    (artifact: FactoryMutationBatchArtifact) => void
  >()
  private readonly pendingTransactionStatuses: TransactionStatusPayload[] = []
  private emittingTransactionStatuses = false
  private sharedEvidenceNotificationDepth = 0
  private readonly inverters = new Map<string, TransactionInverter>()
  private readonly validators = new Map<string, TransactionValidator>()
  private readonly onCommitCapture?: (payload: TransactionStatusPayload) => void
  private readonly onStatus?: (payload: TransactionStatusPayload) => void
  private readonly onUserActionCompleted?: (
    payload: UserActionCompletedPayload
  ) => void
  private readonly onReplayEvent?: (
    event: AllEvent,
    mode: TransactionReplayMode
  ) => boolean | { handled: boolean; applied: boolean }
  private readonly onSharedDelivery?: (delivery: SharedDelivery) => void
  private readonly hasSharedDeliverySubscribers?: () => boolean
  private readonly onSharedDeliveryBatch?: (batch: SharedDeliveryBatch) => void
  private readonly onSharedPublication?: (
    publication: SharedPublication
  ) => void
  private readonly onMutationBatchArtifact?: FactoryMutationBatchArtifactSubscriber
  private readonly sharedDataChannelRegistry: Pick<
    SharedDataChannelRegistry,
    'pushToSharedChannel'
  > &
    Partial<
      Pick<
        SharedDataChannelRegistry,
        'pushBatchToSharedChannel' | 'canPushBatchToSharedChannel'
      >
    >

  constructor(
    sharedDataChannelRegistry?: Pick<
      SharedDataChannelRegistry,
      'pushToSharedChannel'
    > &
      Partial<
        Pick<
          SharedDataChannelRegistry,
          'pushBatchToSharedChannel' | 'canPushBatchToSharedChannel'
        >
      >,
    callbacks?: DataTransactCallbacks
  ) {
    this.sharedDataChannelRegistry =
      sharedDataChannelRegistry ?? new SharedDataChannelRegistry()
    this.onCommitCapture = callbacks?.onCommitCapture
    this.onStatus = callbacks?.onStatus
    this.onUserActionCompleted = callbacks
      ? callbacks.onUserActionCompleted
      : userActionCompleted
    this.onReplayEvent = callbacks?.onReplayEvent
    this.onSharedDelivery = callbacks?.onSharedDelivery
    this.hasSharedDeliverySubscribers = callbacks?.hasSharedDeliverySubscribers
    this.onSharedDeliveryBatch = callbacks?.onSharedDeliveryBatch
    this.onSharedPublication = callbacks?.onSharedPublication
    this.onMutationBatchArtifact = callbacks?.onMutationBatchArtifact
  }

  start(origin?: TransactionOrigin) {
    if (this.sharedEvidenceNotificationDepth > 0) {
      throw new Error(
        'Factory shared evidence observers cannot start a canonical transaction'
      )
    }
    if (
      this.isTransacting > 0 &&
      origin !== undefined &&
      origin !== this.activeOrigin
    ) {
      throw new Error(
        `Nested transaction origin ${origin} cannot join ${this.activeOrigin}`
      )
    }
    this.isTransacting++
    if (this.isTransacting > 1) {
      return
    }

    this.activeOrigin = origin ?? 'action'
    this.journal = []
    this.pendingImmediatePublicationEntries.length = 0
    this.immediatePublicationToken += 1
    this.scheduledImmediatePublicationToken = null
    this.publicationSequence = 0
    this.deliveryBatchSequence = 0
    this.currentSharedDeliveryBatches = []
    this.preparedSharedBatchRecords.clear()
    this.transactionEndDeliveryBatches = null
    this.transactionEndBatchesBySlice.clear()
    this.transactionEndRecordsBySlice.clear()
    this.currentMutationBatchArtifact = undefined
    this.activeDeliveryPlan = undefined
    this.activeDeliverySliceByOrderedId.clear()
    this.activeDeliverySliceOrder.clear()
    this.activeDeliveryBoundaryBySliceId.clear()
    this.activeDeliveryOrderedIdOrder.clear()
    this.activeDeliveryPlanValidated = false
    this.nextDeliverySliceIndex = 0
    this.nestedReplayRestorationPlans = []
    this.rollbackOnly = false
    this.rollbackFailure = undefined
    this.transactionId += 1
    this.currentTransactionId = this.transactionId
    this.currentArtifactId = `${this.currentTransactionId}:artifact`
    const transactionId = this.currentTransactionId
    const artifactId = this.currentArtifactId
    const handleToken = Symbol(artifactId)
    this.activeDeliveryHandleToken = handleToken
    let artifact: FactoryMutationBatchArtifact | null = null
    this.deliveryArtifactFinalizers.set(artifactId, (committedArtifact) => {
      artifact = committedArtifact
    })
    this.activeDeliveryHandle = Object.freeze({
      artifactId,
      transactionId,
      get artifact() {
        return artifact
      },
      setDeliveryPlan: (plan: FactoryMutationDeliveryPlan) => {
        if (
          this.isTransacting <= 0 ||
          this.activeDeliveryHandleToken !== handleToken ||
          this.currentTransactionId !== transactionId ||
          this.currentArtifactId !== artifactId
        ) {
          throw new Error(
            'Factory mutation batch delivery handle is no longer active'
          )
        }
        this.assertSharedEvidenceCanonicalControlAllowed()
        if (this.activeDeliveryPlan) {
          throw new Error(
            'Factory mutation batch delivery plan is already configured'
          )
        }
        try {
          this.configureActiveDeliveryPlan(plan)
        } catch (error) {
          this.rollbackOnly = true
          this.rollbackFailure ??= toReplayFailure(error)
          throw error
        }
      },
      deliverSlice: (sliceId: string) => {
        if (
          this.isTransacting <= 0 ||
          this.activeDeliveryHandleToken !== handleToken ||
          this.currentTransactionId !== transactionId ||
          this.currentArtifactId !== artifactId
        ) {
          throw new Error(
            'Factory mutation batch delivery handle is no longer active'
          )
        }
        this.assertSharedEvidenceCanonicalControlAllowed()
        this.deliverActiveSlice(sliceId)
      }
    })
  }

  private assertSharedEvidenceCanonicalControlAllowed(): void {
    if (this.sharedEvidenceNotificationDepth > 0) {
      throw new Error(
        'Factory shared evidence observers cannot mutate canonical transaction controls'
      )
    }
  }

  registerInverter(eventName: string, inverter: TransactionInverter) {
    if (this.inverters.has(eventName)) {
      throw new Error(
        `Transaction inverter is already registered for ${eventName}`
      )
    }
    this.inverters.set(eventName, inverter)
  }

  registerValidator(name: string, validator: TransactionValidator) {
    if (this.validators.has(name)) {
      throw new Error(`Transaction validator is already registered: ${name}`)
    }
    this.validators.set(name, validator)
  }

  private hasInverseContract(eventName: string, payload: unknown) {
    if (this.inverters.has(eventName)) {
      return true
    }
    if (!BUILT_IN_INVERTIBLE_EVENT_TYPES.has(eventName)) {
      return false
    }
    if (!payload || typeof payload !== 'object') {
      return false
    }

    return (
      'undoType' in payload ||
      'undoAction' in payload ||
      'after' in payload ||
      'patch' in payload ||
      ('moves' in payload && Array.isArray(payload.moves)) ||
      ('changes' in payload && Array.isArray(payload.changes))
    )
  }

  update(
    event: UpdateTransactionEvent
  ): FactoryMutationBatchDeliveryHandle | null {
    return this.updateBatch([event])
  }

  updateBatch(
    events: readonly UpdateTransactionEvent[],
    deliveryEvidence?: FactoryMutationBatchDeliveryEvidence
  ): FactoryMutationBatchDeliveryHandle | null {
    this.assertSharedEvidenceCanonicalControlAllowed()
    if (this.isTransacting <= 0 || this.restoringNestedReplay) {
      return null
    }

    const deliveryHandle = this.activeDeliveryHandle ?? null
    const journalStart = this.journal.length
    let batchAccepted = false
    try {
      if (deliveryEvidence && deliveryEvidence.length !== events.length) {
        throw new Error(
          'Factory mutation delivery evidence requires one entry for each canonical event'
        )
      }
      if (this.transactionEndDeliveryBatches !== null) {
        throw new Error(
          'Factory mutation batch cannot change after progressive delivery preparation'
        )
      }
      const recordedEntries = events.map((event, index) =>
        this.recordJournalEntry(event, deliveryEvidence?.[index])
      )
      batchAccepted = true
      if (
        this.nestedReplaySourceEvents &&
        recordedEntries.some((entry) => entry.source === 'action')
      ) {
        throw new Error(
          'Nested undo or redo cannot accept a new action mutation'
        )
      }
      const immediateEntries = recordedEntries.filter(
        (entry) => entry.shared && entry.options.sharedDelivery === 'immediate'
      )
      this.deliverSharedEntries(immediateEntries)
      this.queueImmediatePublicationEntries(
        immediateEntries.filter((entry) =>
          entry.shared?.records.some((record) => record.delivered)
        )
      )
      return recordedEntries.length > 0 ? deliveryHandle : null
    } catch (error) {
      if (!batchAccepted) {
        this.journal.splice(journalStart)
      }
      this.rollbackOnly = true
      this.rollbackFailure ??= toReplayFailure(error)
      throw new FactoryMutationBatchAcceptanceError(batchAccepted, error)
    }
  }

  private validateEventDeliveryEvidence(
    evidence: FactoryMutationEventDeliveryEvidence,
    eventIndex: number
  ): void {
    if (evidence.orderedIds.length === 0) {
      throw new Error(
        `Factory mutation delivery evidence ${eventIndex} requires at least one canonical ordered id`
      )
    }
    const canonicalIds = new Set<string>()
    evidence.orderedIds.forEach((orderedId) => {
      if (!orderedId) {
        throw new Error(
          `Factory mutation delivery evidence ${eventIndex} has an empty canonical ordered id`
        )
      }
      if (canonicalIds.has(orderedId)) {
        throw new Error(
          `Factory mutation delivery evidence ${eventIndex} has a duplicate canonical ordered id: ${orderedId}`
        )
      }
      canonicalIds.add(orderedId)
    })
    if (
      evidence.sharedRecords !== undefined &&
      evidence.sharedRecords.length === 0
    ) {
      throw new Error(
        `Factory mutation delivery evidence ${eventIndex} requires at least one shared record`
      )
    }
    if (!evidence.sharedRecords) return

    const firstOccurrences: string[] = []
    const seenOccurrences = new Set<string>()
    evidence.sharedRecords.forEach((record, recordIndex) => {
      if (record.orderedIds.length === 0) {
        throw new Error(
          `Factory mutation shared record ${eventIndex}:${recordIndex} requires at least one ordered id`
        )
      }
      const recordIds = new Set<string>()
      record.orderedIds.forEach((orderedId) => {
        if (!orderedId || !canonicalIds.has(orderedId)) {
          throw new Error(
            `Factory mutation shared record ${eventIndex}:${recordIndex} contains an unknown canonical ordered id: ${orderedId}`
          )
        }
        if (recordIds.has(orderedId)) {
          throw new Error(
            `Factory mutation shared record ${eventIndex}:${recordIndex} has a duplicate ordered id: ${orderedId}`
          )
        }
        recordIds.add(orderedId)
        if (!seenOccurrences.has(orderedId)) {
          seenOccurrences.add(orderedId)
          firstOccurrences.push(orderedId)
        }
      })
      if (!isPlainRecord(record.payload)) {
        throw new Error(
          `Factory mutation shared record ${eventIndex}:${recordIndex} requires a plain record payload`
        )
      }
    })
    if (seenOccurrences.size !== canonicalIds.size) {
      throw new Error(
        `Factory mutation shared records ${eventIndex} must cover every canonical ordered id`
      )
    }
    if (
      firstOccurrences.some(
        (orderedId, index) => evidence.orderedIds[index] !== orderedId
      )
    ) {
      throw new Error(
        `Factory mutation shared records ${eventIndex} must preserve canonical ordered id order`
      )
    }
  }

  private recordJournalEntry(
    event: UpdateTransactionEvent,
    deliveryEvidence?: FactoryMutationEventDeliveryEvidence
  ): TransactionJournalEntry {
    const payload = event.payload as TransactionPayload
    const newType = event.eventName as AllEvent['type']
    const detachedHandoff = measureBrowserDragPhase(
      'factory:journal-payload-clone',
      () =>
        cloneAndDeepFreezeValue({
          payload,
          deliveryEvidence
        })
    )
    const newPayload = detachedHandoff.payload
    const detachedDeliveryEvidence = detachedHandoff.deliveryEvidence
    if (detachedDeliveryEvidence) {
      this.validateEventDeliveryEvidence(
        detachedDeliveryEvidence,
        this.journal.length
      )
      if (!event.options?.shared) {
        throw new Error(
          `Factory mutation delivery evidence ${this.journal.length} requires a shared canonical event`
        )
      }
    }
    const newEvent: AllEvent = deepFreezeValue({
      type: newType,
      payload: newPayload
    } as AllEvent)

    const origin = this.transactionOrigin()
    const isReplayOrigin = origin === 'undo' || origin === 'redo'
    const options: EffectiveMutationOptions = {
      undoable:
        origin === 'remote' || isReplayOrigin
          ? false
          : event.options?.undoable !== false,
      rollbackable:
        origin === 'remote' ? true : event.options?.rollbackable !== false,
      shared: event.options?.shared,
      sharedDelivery: event.options?.sharedDelivery ?? 'transaction-end'
    }
    if (
      (options.rollbackable || options.undoable) &&
      !this.hasInverseContract(event.eventName, payload)
    ) {
      throw new Error(
        `Reversible transaction event ${event.eventName} requires an inverter`
      )
    }
    const journalEntry: TransactionJournalEntry = {
      index: this.journal.length,
      event: newEvent,
      options,
      source: this.applyingReplayEvent ? 'replay' : 'action'
    }

    const sharedChannelName = event.options?.shared
    if (sharedChannelName) {
      const sharedOptions =
        origin === 'remote'
          ? { ...event.options, undoable: false, rollbackable: true }
          : event.options
      const sharedChange = measureBrowserDragPhase(
        'factory:shared-payload-normalize',
        () => deepFreezeValue(toSharedChannelPayload(newPayload, sharedOptions))
      )
      const recordInputs = detachedDeliveryEvidence?.sharedRecords ?? [
        {
          orderedIds: detachedDeliveryEvidence?.orderedIds ?? [],
          payload: newPayload
        }
      ]
      journalEntry.shared = {
        name: sharedChannelName,
        change: sharedChange,
        orderedIds: detachedDeliveryEvidence?.orderedIds ?? [],
        recordInversesPrepared: false,
        records: recordInputs.map((record, occurrence) => ({
          occurrence,
          orderedIds: record.orderedIds,
          change:
            record.payload === newPayload
              ? sharedChange
              : deepFreezeValue(
                  toSharedChannelPayload(
                    record.payload as TransactionPayload,
                    sharedOptions
                  )
                ),
          delivered: false,
          published: false
        }))
      }
    }

    this.journal.push(journalEntry)

    return journalEntry
  }

  private prepareEntryInverses(entry: TransactionJournalEntry): void {
    if (!entry.inverseEvents) {
      entry.inverseEvents = deepFreezeValue(
        entry.options.rollbackable || entry.options.undoable
          ? this.createReplayEvents(
              entry.event,
              'inverse',
              'factory-owned-journal'
            )
          : []
      )
    }
    if (entry.shared && !entry.shared.inverseEvents) {
      const sharedPayloadOptions = toDefinedMutationOptions(
        entry.shared.change.options
      )
      entry.shared.inverseEvents = deepFreezeValue(
        entry.options.rollbackable
          ? (entry.inverseEvents ?? []).map((inverseEvent) => {
              const inversePayload = (
                inverseEvent as AllEvent & {
                  payload: TransactionPayload
                }
              ).payload
              const { options: _canonicalOptions, ...payloadWithoutOptions } =
                inversePayload
              return deepFreezeValue({
                type: inverseEvent.type,
                payload: deepFreezeValue({
                  ...payloadWithoutOptions,
                  ...(sharedPayloadOptions
                    ? { options: sharedPayloadOptions }
                    : {})
                })
              } as AllEvent)
            })
          : []
      )
    }
    if (entry.shared && !entry.shared.recordInversesPrepared) {
      let inverseCountMismatch:
        | {
            recordId: string
            canonicalCount: number
            recordCount: number
          }
        | undefined
      measureBrowserDragPhase('factory:prepare-shared-record-inverses', () => {
        entry.shared?.records.forEach((record) => {
          if (!record.inverseEvents) {
            const recordEvent = deepFreezeValue({
              type: entry.event.type,
              payload: record.change
            } as AllEvent)
            record.inverseEvents = deepFreezeValue(
              entry.options.rollbackable || entry.options.undoable
                ? this.createReplayEvents(
                    recordEvent,
                    'inverse',
                    'factory-owned-journal'
                  )
                : []
            )
          }
          if (
            !inverseCountMismatch &&
            record.inverseEvents.length !== (entry.inverseEvents ?? []).length
          ) {
            inverseCountMismatch = {
              recordId: this.sharedRecordId(entry, record),
              canonicalCount: (entry.inverseEvents ?? []).length,
              recordCount: record.inverseEvents.length
            }
          }
          if (!record.evidence) {
            record.evidence = deepFreezeValue({
              recordId: this.sharedRecordId(entry, record),
              deliveryId: this.forwardDeliveryId(entry, record),
              occurrence: record.occurrence,
              orderedIds: record.orderedIds,
              payload: record.change,
              inverseEvents: record.inverseEvents
            })
          }
        })
      })
      entry.shared.recordInversesPrepared = true
      if (inverseCountMismatch) {
        throw new Error(
          `Factory mutation shared record inverse output count must match canonical inverse output count: ${inverseCountMismatch.recordId} (${inverseCountMismatch.recordCount} !== ${inverseCountMismatch.canonicalCount})`
        )
      }
    }
  }

  private sharedRecordId(
    entry: TransactionJournalEntry,
    record: JournalSharedRecord
  ): string {
    return `${this.currentTransactionId}:${entry.index}:record:${record.occurrence}`
  }

  private forwardDeliveryId(
    entry: TransactionJournalEntry,
    record: JournalSharedRecord
  ): string {
    return record.occurrence === 0
      ? `${this.currentTransactionId}:${entry.index}:forward`
      : `${this.currentTransactionId}:${entry.index}:record:${record.occurrence}:forward`
  }

  private nextDeliveryBatchId(): string {
    this.deliveryBatchSequence += 1
    return `${this.currentArtifactId}:batch:${this.deliveryBatchSequence}`
  }

  private emitForwardSharedDelivery({ record }: JournalSharedRecordRef): void {
    if (this.transactionOrigin() === 'remote') return
    const delivery = record.delivery
    if (!delivery) return
    this.onSharedDelivery?.(delivery)
  }

  private shouldEmitLegacySharedDeliveries(): boolean {
    return this.hasSharedDeliverySubscribers
      ? this.hasSharedDeliverySubscribers()
      : this.onSharedDelivery !== undefined
  }

  private createForwardSharedDelivery(
    { entry, record }: JournalSharedRecordRef,
    batchId: string
  ): SharedDelivery | undefined {
    const shared = entry.shared
    if (!shared) return
    const evidence = record.evidence
    if (!evidence) return
    return deepFreezeValue({
      deliveryId: evidence.deliveryId,
      artifactId: this.currentArtifactId,
      batchId,
      transactionId: this.currentTransactionId,
      origin: this.transactionOrigin(),
      kind: 'forward',
      channel: shared.name,
      eventName: entry.event.type,
      payload: record.change,
      recordId: evidence.recordId,
      record: evidence,
      sharedDelivery: entry.options.sharedDelivery
    })
  }

  private configureActiveDeliveryPlan(plan: FactoryMutationDeliveryPlan): void {
    if (this.currentSharedDeliveryBatches.length > 0) {
      throw new Error(
        'Factory mutation delivery plan must be configured before shared delivery'
      )
    }
    const detachedPlan = cloneAndDeepFreezeValue(plan)
    const sliceIds = new Set<string>()
    const orderedIds = new Set<string>()
    const sliceByOrderedId = new Map<string, string>()
    const sliceOrder = new Map<string, number>()
    const boundaryBySliceId = new Map<
      string,
      FactoryMutationDeliveryPlan['slices'][number]
    >()
    const orderedIdOrder = new Map<string, number>()
    let orderedIdIndex = 0
    detachedPlan.slices.forEach((slice, sliceIndex) => {
      if (!slice.sliceId || sliceIds.has(slice.sliceId)) {
        throw new Error(
          `Factory mutation delivery plan has an invalid slice at index ${sliceIndex}`
        )
      }
      sliceIds.add(slice.sliceId)
      sliceOrder.set(slice.sliceId, sliceIndex)
      boundaryBySliceId.set(slice.sliceId, slice)
      slice.orderedIds.forEach((orderedId) => {
        if (!orderedId || orderedIds.has(orderedId)) {
          throw new Error(
            `Factory mutation delivery plan has a duplicate ordered id: ${orderedId}`
          )
        }
        orderedIds.add(orderedId)
        sliceByOrderedId.set(orderedId, slice.sliceId)
        orderedIdOrder.set(orderedId, orderedIdIndex)
        orderedIdIndex += 1
      })
    })
    if (
      detachedPlan.mode === 'progressive' &&
      detachedPlan.slices.length === 0
    ) {
      throw new Error(
        'Progressive Factory mutation delivery plan requires at least one slice'
      )
    }
    if (detachedPlan.mode === 'atomic' && detachedPlan.slices.length > 1) {
      throw new Error(
        'Atomic Factory mutation delivery plan accepts at most one slice'
      )
    }
    this.activeDeliverySliceByOrderedId.clear()
    sliceByOrderedId.forEach((sliceId, orderedId) =>
      this.activeDeliverySliceByOrderedId.set(orderedId, sliceId)
    )
    this.activeDeliverySliceOrder.clear()
    sliceOrder.forEach((sliceIndex, sliceId) =>
      this.activeDeliverySliceOrder.set(sliceId, sliceIndex)
    )
    this.activeDeliveryBoundaryBySliceId.clear()
    boundaryBySliceId.forEach((boundary, sliceId) =>
      this.activeDeliveryBoundaryBySliceId.set(sliceId, boundary)
    )
    this.activeDeliveryOrderedIdOrder.clear()
    orderedIdOrder.forEach((index, orderedId) =>
      this.activeDeliveryOrderedIdOrder.set(orderedId, index)
    )
    this.activeDeliveryPlan = detachedPlan
    this.activeDeliveryPlanValidated = false
  }

  private sharedRecordRefs(
    entries: readonly TransactionJournalEntry[]
  ): JournalSharedRecordRef[] {
    return entries.flatMap((entry) =>
      (entry.shared?.records ?? []).map((record) => ({ entry, record }))
    )
  }

  private validateActiveDeliveryPlanCoverage(
    records: readonly JournalSharedRecordRef[]
  ): void {
    if (
      this.activeDeliveryPlanValidated ||
      this.activeDeliveryPlan?.mode !== 'progressive'
    ) {
      return
    }
    const seenAssignedOrderedIds = new Set<string>()
    const seenEntries = new Set<TransactionJournalEntry>()
    records.forEach(({ entry }) => {
      if (seenEntries.has(entry)) return
      seenEntries.add(entry)
      let previousOrderedIdIndex = -1
      entry.shared?.orderedIds.forEach((orderedId) => {
        const orderedIdIndex = this.activeDeliveryOrderedIdOrder.get(orderedId)
        if (orderedIdIndex === undefined) {
          throw new Error(
            `Factory mutation ordered id is not assigned to a progressive delivery slice: ${orderedId}`
          )
        }
        if (orderedIdIndex <= previousOrderedIdIndex) {
          throw new Error(
            'Factory mutation delivery slices must preserve canonical order'
          )
        }
        previousOrderedIdIndex = orderedIdIndex
        seenAssignedOrderedIds.add(orderedId)
      })
    })
    if (
      seenAssignedOrderedIds.size !== this.activeDeliveryOrderedIdOrder.size
    ) {
      throw new Error(
        'Factory mutation delivery plan must cover every shared canonical id exactly once'
      )
    }
    this.activeDeliveryPlanValidated = true
  }

  private orderSharedRecordsByActiveSlice(
    records: readonly JournalSharedRecordRef[]
  ): JournalSharedRecordRef[] {
    if (this.activeDeliveryPlan?.mode !== 'progressive') {
      return [...records]
    }
    const recordsBySlice = new Map<string, JournalSharedRecordRef[]>()
    this.activeDeliveryPlan.slices.forEach(({ sliceId }) =>
      recordsBySlice.set(sliceId, [])
    )
    records.forEach((recordRef) => {
      const sliceId = this.plannedSliceIdForRecord(recordRef)
      const sliceRecords = sliceId ? recordsBySlice.get(sliceId) : undefined
      if (!sliceId || !sliceRecords) {
        throw new Error(
          `Factory mutation shared record ${this.sharedRecordId(recordRef.entry, recordRef.record)} is not assigned to a progressive delivery slice`
        )
      }
      sliceRecords.push(recordRef)
    })
    return this.activeDeliveryPlan.slices.flatMap(
      ({ sliceId }) => recordsBySlice.get(sliceId) ?? []
    )
  }

  private plannedSliceIdForRecord({
    entry,
    record
  }: JournalSharedRecordRef): string | undefined {
    if (this.activeDeliveryPlan?.mode === 'atomic') {
      return this.activeDeliveryPlan.slices[0]?.sliceId
    }
    if (this.activeDeliveryPlan?.mode !== 'progressive') return
    if (record.orderedIds.length === 0) {
      throw new Error(
        `Factory mutation shared record ${this.sharedRecordId(entry, record)} is not assigned to a progressive delivery slice`
      )
    }
    const sliceIds = new Set<string>()
    record.orderedIds.forEach((orderedId) => {
      const sliceId = this.activeDeliverySliceByOrderedId.get(orderedId)
      if (!sliceId) {
        throw new Error(
          `Factory mutation ordered id is not assigned to a progressive delivery slice: ${orderedId}`
        )
      }
      sliceIds.add(sliceId)
    })
    if (sliceIds.size > 1) {
      throw new Error(
        `Factory mutation shared record ${this.sharedRecordId(entry, record)} cannot span delivery slices`
      )
    }
    return [...sliceIds][0]
  }

  private prepareSharedDeliveryBatches(
    entries: readonly TransactionJournalEntry[],
    orderedRecords?: readonly JournalSharedRecordRef[]
  ): SharedDeliveryBatch[] {
    const records = orderedRecords ?? this.sharedRecordRefs(entries)
    const preparedBatches: SharedDeliveryBatch[] = []
    const seenBatchIds = new Set<string>()
    const plannedSliceIds = new Map<JournalSharedRecord, string>()
    records.forEach((recordRef) => {
      const sliceId =
        recordRef.record.batch?.sliceId ??
        this.plannedSliceIdForRecord(recordRef)
      if (!sliceId) return
      if (
        this.activeDeliveryPlan &&
        !this.activeDeliverySliceOrder.has(sliceId)
      ) {
        throw new Error(
          `Factory mutation delivery slice is unknown: ${sliceId}`
        )
      }
      plannedSliceIds.set(recordRef.record, sliceId)
    })
    let cursor = 0
    while (cursor < records.length) {
      const first = records[cursor]
      const shared = first?.entry.shared
      if (!first || !shared) {
        cursor += 1
        continue
      }
      if (first.record.batch) {
        if (!seenBatchIds.has(first.record.batch.batchId)) {
          seenBatchIds.add(first.record.batch.batchId)
          preparedBatches.push(first.record.batch)
        }
        cursor += 1
        continue
      }
      const group: JournalSharedRecordRef[] = [first]
      const plannedSliceId = plannedSliceIds.get(first.record)
      const supportsBatch = canPushFactoryOwnedBatchToSharedChannel(
        this.sharedDataChannelRegistry,
        shared.name
      )
      cursor += 1
      while (cursor < records.length) {
        const candidate = records[cursor]
        const candidateShared = candidate?.entry.shared
        if (
          !supportsBatch ||
          !candidate ||
          !candidateShared ||
          candidate.record.batch ||
          candidateShared.name !== shared.name ||
          candidate.entry.options.sharedDelivery !==
            first.entry.options.sharedDelivery ||
          plannedSliceIds.get(candidate.record) !== plannedSliceId
        ) {
          break
        }
        group.push(candidate)
        cursor += 1
      }

      new Set(group.map(({ entry }) => entry)).forEach((entry) =>
        this.prepareEntryInverses(entry)
      )
      const batchId = this.nextDeliveryBatchId()
      const deliveries = deepFreezeValue(
        group.flatMap((recordRef) => {
          const delivery = this.createForwardSharedDelivery(recordRef, batchId)
          return delivery ? [delivery] : []
        })
      )
      const batch: SharedDeliveryBatch = deepFreezeValue({
        batchId,
        sliceId: plannedSliceId ?? batchId,
        artifactId: this.currentArtifactId,
        transactionId: this.currentTransactionId,
        origin: this.transactionOrigin(),
        kind: 'forward',
        channel: shared.name,
        sharedDelivery: first.entry.options.sharedDelivery,
        deliveries,
        records: deepFreezeValue(deliveries.map((delivery) => delivery.record)),
        changes: deepFreezeValue(deliveries.map((delivery) => delivery.payload))
      })
      group.forEach(({ record }, index) => {
        record.batch = batch
        record.delivery = deliveries[index]
      })
      this.preparedSharedBatchRecords.set(batch.batchId, group)
      this.currentSharedDeliveryBatches.push(batch)
      preparedBatches.push(batch)
      seenBatchIds.add(batch.batchId)
    }
    return preparedBatches
  }

  private deliverPreparedSharedBatch(batch: SharedDeliveryBatch): boolean {
    const records = (
      this.preparedSharedBatchRecords.get(batch.batchId) ?? []
    ).filter(({ record }) => !record.delivered)
    if (records.length === 0) return true
    this.sharedEvidenceNotificationDepth += 1
    try {
      const delivered = pushFactoryOwnedBatchToSharedChannel(
        this.sharedDataChannelRegistry,
        batch.channel,
        batch.changes
      )
      if (!delivered) return false

      records.forEach(({ record }) => {
        record.delivered = true
      })
      if (this.transactionOrigin() !== 'remote') {
        this.onSharedDeliveryBatch?.(batch)
        if (this.shouldEmitLegacySharedDeliveries()) {
          records.forEach((recordRef) =>
            this.emitForwardSharedDelivery(recordRef)
          )
        }
      }
      return true
    } finally {
      this.sharedEvidenceNotificationDepth -= 1
    }
  }

  private deliverSharedEntries(
    entries: readonly TransactionJournalEntry[]
  ): void {
    this.prepareSharedDeliveryBatches(entries).forEach((batch) =>
      this.deliverPreparedSharedBatch(batch)
    )
  }

  private prepareTransactionEndDeliveryIndex(): readonly SharedDeliveryBatch[] {
    if (this.transactionEndDeliveryBatches) {
      return this.transactionEndDeliveryBatches
    }
    return measureBrowserDragPhase(
      'factory:index-shared-delivery-records',
      () => {
        const transactionEndEntries = this.journal.filter(
          (entry) =>
            entry.shared && entry.options.sharedDelivery === 'transaction-end'
        )
        const records = this.sharedRecordRefs(transactionEndEntries)
        this.validateActiveDeliveryPlanCoverage(records)
        const orderedRecords = this.orderSharedRecordsByActiveSlice(records)
        const batches = this.prepareSharedDeliveryBatches(
          transactionEndEntries,
          orderedRecords
        )
        const batchesBySlice = new Map<string, SharedDeliveryBatch[]>()
        const recordsBySlice = new Map<string, JournalSharedRecordRef[]>()
        batches.forEach((batch) => {
          const sliceBatches = batchesBySlice.get(batch.sliceId) ?? []
          sliceBatches.push(batch)
          batchesBySlice.set(batch.sliceId, sliceBatches)
          const sliceRecords = recordsBySlice.get(batch.sliceId) ?? []
          sliceRecords.push(
            ...(this.preparedSharedBatchRecords.get(batch.batchId) ?? [])
          )
          recordsBySlice.set(batch.sliceId, sliceRecords)
        })
        if (
          this.activeDeliveryPlan?.mode === 'progressive' &&
          this.activeDeliveryPlan.slices.some(
            ({ sliceId }) => !batchesBySlice.has(sliceId)
          )
        ) {
          throw new Error(
            'Factory mutation delivery plan contains an empty progressive slice'
          )
        }
        batchesBySlice.forEach((sliceBatches, sliceId) =>
          this.transactionEndBatchesBySlice.set(
            sliceId,
            deepFreezeValue(sliceBatches)
          )
        )
        recordsBySlice.forEach((sliceRecords, sliceId) =>
          this.transactionEndRecordsBySlice.set(sliceId, sliceRecords)
        )
        this.transactionEndDeliveryBatches = deepFreezeValue(batches)
        return this.transactionEndDeliveryBatches
      }
    )
  }

  private deliverActiveSlice(sliceId: string): void {
    try {
      const plan = this.activeDeliveryPlan
      if (plan?.mode !== 'progressive') {
        throw new Error(
          'Factory mutation delivery slice requires a progressive delivery plan'
        )
      }
      const expectedSlice = plan.slices[this.nextDeliverySliceIndex]
      if (!expectedSlice || expectedSlice.sliceId !== sliceId) {
        throw new Error(
          `Factory mutation delivery slice must follow plan order: ${expectedSlice?.sliceId ?? 'complete'}`
        )
      }
      this.prepareTransactionEndDeliveryIndex()
      const batches = this.transactionEndBatchesBySlice.get(sliceId) ?? []
      if (batches.length === 0) {
        throw new Error(
          `Factory mutation delivery slice has no shared changes: ${sliceId}`
        )
      }
      if (!batches.every((batch) => this.deliverPreparedSharedBatch(batch))) {
        throw new Error(
          `Factory mutation delivery slice could not be delivered: ${sliceId}`
        )
      }
      const records = this.transactionEndRecordsBySlice.get(sliceId) ?? []
      this.queueSharedPublication(
        this.createSharedPublicationFromRecords(records)
      )
      this.flushSharedPublications()
      this.nextDeliverySliceIndex += 1
    } catch (error) {
      this.rollbackOnly = true
      this.rollbackFailure ??= toReplayFailure(error)
      throw error
    }
  }

  private nextPublicationId(): string {
    this.publicationSequence += 1
    return `${this.currentTransactionId}:publication:${this.publicationSequence}`
  }

  private createSharedPublication(
    entries: readonly TransactionJournalEntry[],
    origin: SharedPublication['origin'] = this.transactionOrigin()
  ): SharedPublication | undefined {
    return this.createSharedPublicationFromRecords(
      this.sharedRecordRefs(entries),
      origin
    )
  }

  private createSharedPublicationFromRecords(
    records: readonly JournalSharedRecordRef[],
    origin: SharedPublication['origin'] = this.transactionOrigin()
  ): SharedPublication | undefined {
    return measureBrowserDragPhase('factory:create-shared-publication', () => {
      if (this.transactionOrigin() === 'remote') return
      const publishableRecords = records.filter(({ record }) => {
        if (!record.delivered || record.published) {
          return false
        }
        return true
      })
      const batches: SharedDeliveryBatch[] = []
      const seenBatchIds = new Set<string>()
      publishableRecords.forEach(({ record }) => {
        const batch = record.batch
        if (!batch || seenBatchIds.has(batch.batchId)) return
        seenBatchIds.add(batch.batchId)
        batches.push(batch)
      })
      if (batches.length === 0) return
      publishableRecords.forEach(({ record }) => {
        record.published = true
      })
      return this.createSharedPublicationFromBatches(batches, origin)
    })
  }

  private createSharedPublicationFromBatches(
    batches: readonly SharedDeliveryBatch[],
    origin: SharedPublication['origin']
  ): SharedPublication | undefined {
    if (batches.length === 0) return
    const frozenBatches = deepFreezeValue([...batches])
    const deliveries = deepFreezeValue(
      frozenBatches.flatMap((batch) => batch.deliveries)
    )
    return deepFreezeValue({
      publicationId: this.nextPublicationId(),
      artifactId: this.currentArtifactId,
      transactionId: this.currentTransactionId,
      origin,
      deliveries,
      batches: frozenBatches,
      deliveryPlan: this.resolveDeliveryPlan(frozenBatches, {
        includeActivePlan: origin !== 'rollback-compensation',
        modeOverride:
          origin === 'rollback-compensation' &&
          this.activeDeliveryPlan?.mode === 'progressive'
            ? 'progressive'
            : undefined,
        orderedIdsFromRecords:
          origin === 'rollback-compensation' &&
          this.activeDeliveryPlan?.mode === 'progressive'
      })
    })
  }

  private resolveDeliveryPlan(
    batches: readonly SharedDeliveryBatch[] = this.currentSharedDeliveryBatches,
    options: {
      includeActivePlan?: boolean
      modeOverride?: FactoryMutationDeliveryPlan['mode']
      orderedIdsFromRecords?: boolean
    } = {}
  ): FactoryMutationDeliveryPlan {
    if (
      this.activeDeliveryPlan &&
      this.activeDeliveryPlan.slices.length > 0 &&
      options.includeActivePlan !== false
    ) {
      if (batches.length === 0) return this.activeDeliveryPlan
      return measureBrowserDragPhase(
        'factory:select-delivery-plan-boundaries',
        () => {
          const seenSliceIds = new Set<string>()
          const slices: FactoryMutationDeliveryPlan['slices'][number][] = []
          batches.forEach((batch) => {
            if (seenSliceIds.has(batch.sliceId)) return
            const boundary = this.activeDeliveryBoundaryBySliceId.get(
              batch.sliceId
            )
            if (!boundary) {
              throw new Error(
                `Factory mutation delivery slice is unknown: ${batch.sliceId}`
              )
            }
            seenSliceIds.add(batch.sliceId)
            slices.push(boundary)
          })
          return deepFreezeValue({
            mode: this.activeDeliveryPlan?.mode ?? 'atomic',
            slices
          })
        }
      )
    }
    const slices = new Map<string, string[]>()
    const seenSliceOrderedIds = new Map<string, Set<string>>()
    batches.forEach((batch) => {
      const orderedIds = slices.get(batch.sliceId) ?? []
      if (options.orderedIdsFromRecords) {
        const seenOrderedIds =
          seenSliceOrderedIds.get(batch.sliceId) ?? new Set<string>()
        batch.records.forEach((record) =>
          [...record.orderedIds].reverse().forEach((orderedId) => {
            if (seenOrderedIds.has(orderedId)) return
            seenOrderedIds.add(orderedId)
            orderedIds.push(orderedId)
          })
        )
        seenSliceOrderedIds.set(batch.sliceId, seenOrderedIds)
      } else {
        orderedIds.push(
          ...batch.deliveries.map((delivery) => delivery.deliveryId)
        )
      }
      slices.set(batch.sliceId, orderedIds)
    })
    return deepFreezeValue({
      mode:
        options.modeOverride ??
        (batches.some((batch) => batch.sharedDelivery === 'immediate')
          ? 'progressive'
          : 'atomic'),
      slices: [...slices].map(([sliceId, orderedIds]) => ({
        sliceId,
        orderedIds
      }))
    })
  }

  private createMutationBatchArtifact(
    options: { preparedDeliveryBatchIds?: ReadonlySet<string> } = {}
  ): FactoryMutationBatchArtifact | undefined {
    if (this.journal.length === 0) return
    if (this.currentMutationBatchArtifact) {
      return this.currentMutationBatchArtifact
    }

    const artifact = measureBrowserDragPhase(
      'factory:finalize-mutation-batch-artifact',
      () => {
        this.journal.forEach((entry) => this.prepareEntryInverses(entry))
        const changes = deepFreezeValue(
          this.journal.map((entry): FactoryMutationBatchChange => {
            return deepFreezeValue({
              changeId: `${this.currentTransactionId}:change:${entry.index}`,
              index: entry.index,
              event: entry.event,
              inverseEvents: entry.inverseEvents ?? deepFreezeValue([]),
              options: deepFreezeValue({ ...entry.options }),
              ...(entry.shared
                ? {
                    shared: deepFreezeValue({
                      channel: entry.shared.name,
                      payload: entry.shared.change,
                      deliveryIds: deepFreezeValue(
                        entry.shared.records.flatMap((record) => {
                          const deliveryId = record.delivery?.deliveryId
                          const included =
                            record.delivered ||
                            (record.batch !== undefined &&
                              options.preparedDeliveryBatchIds?.has(
                                record.batch.batchId
                              ) === true)
                          return included && deliveryId ? [deliveryId] : []
                        })
                      ),
                      inverseEvents:
                        entry.shared.inverseEvents ?? deepFreezeValue([]),
                      records: deepFreezeValue(
                        entry.shared.records.flatMap((record) =>
                          record.evidence ? [record.evidence] : []
                        )
                      )
                    })
                  }
                : {})
            })
          })
        )
        const batches = deepFreezeValue([...this.currentSharedDeliveryBatches])
        return deepFreezeValue({
          artifactId: this.currentArtifactId,
          transactionId: this.currentTransactionId,
          origin: this.transactionOrigin(),
          orderedChangeIds: deepFreezeValue(
            changes.map((change) => change.changeId)
          ),
          changes,
          inverses: deepFreezeValue(
            [...changes].reverse().flatMap((change) => change.inverseEvents)
          ),
          deliveryPlan: this.resolveDeliveryPlan(batches),
          batches
        })
      }
    )
    this.currentMutationBatchArtifact = artifact
    return artifact
  }

  private queueImmediatePublicationEntries(
    entries: readonly TransactionJournalEntry[]
  ): void {
    if (entries.length === 0) return
    this.pendingImmediatePublicationEntries.push(...entries)
    const token = this.immediatePublicationToken
    if (this.scheduledImmediatePublicationToken === token) return
    this.scheduledImmediatePublicationToken = token
    queueMicrotask(() => {
      if (this.scheduledImmediatePublicationToken === token) {
        this.scheduledImmediatePublicationToken = null
      }
      if (token !== this.immediatePublicationToken) return
      this.queuePendingImmediatePublication()
      this.flushSharedPublications()
    })
  }

  private queuePendingImmediatePublication(): void {
    this.scheduledImmediatePublicationToken = null
    this.immediatePublicationToken += 1
    const entries = this.pendingImmediatePublicationEntries.splice(0)
    this.queueSharedPublication(this.createSharedPublication(entries))
  }

  private discardPendingImmediatePublication(): void {
    this.scheduledImmediatePublicationToken = null
    this.immediatePublicationToken += 1
    this.pendingImmediatePublicationEntries.length = 0
  }

  private queueSharedPublication(
    publication: SharedPublication | undefined
  ): void {
    if (!publication) return
    this.pendingSharedPublications.push(publication)
  }

  private queueMutationBatchArtifact(
    artifact: FactoryMutationBatchArtifact
  ): void {
    this.pendingMutationBatchArtifacts.push(artifact)
  }

  private flushMutationBatchArtifacts(): void {
    if (
      this.emittingMutationBatchArtifacts ||
      this.transactionSettlementDepth > 1
    ) {
      return
    }
    this.emittingMutationBatchArtifacts = true
    try {
      let artifact: FactoryMutationBatchArtifact | undefined
      while ((artifact = this.pendingMutationBatchArtifacts.shift())) {
        this.onMutationBatchArtifact?.(artifact)
      }
    } finally {
      this.emittingMutationBatchArtifacts = false
    }
  }

  private flushSharedPublications(): void {
    if (this.emittingSharedPublications) return
    this.emittingSharedPublications = true
    try {
      let publication: SharedPublication | undefined
      while ((publication = this.pendingSharedPublications.shift())) {
        this.sharedEvidenceNotificationDepth += 1
        try {
          this.onSharedPublication?.(publication)
        } finally {
          this.sharedEvidenceNotificationDepth -= 1
        }
      }
    } finally {
      this.emittingSharedPublications = false
    }
  }

  private flushReplaySharedPublications(): void {
    this.discardPendingImmediatePublication()
    this.flushPendingSharedChannelChanges()
    this.queueSharedPublication(this.createSharedPublication(this.journal))
    this.flushSharedPublications()
  }

  private emitCompensationSharedDelivery(
    { entry, record }: JournalSharedRecordRef,
    eventName: string,
    payload: TransactionPayload,
    compensationIndex: number,
    batchId: string
  ): SharedDelivery | undefined {
    if (this.transactionOrigin() === 'remote') return
    const shared = entry.shared
    const evidence = record.evidence
    if (!shared || !evidence) return
    const deliveryPrefix =
      record.occurrence === 0
        ? `${this.currentTransactionId}:${entry.index}`
        : `${this.currentTransactionId}:${entry.index}:record:${record.occurrence}`
    return deepFreezeValue({
      deliveryId: `${deliveryPrefix}:compensation:${compensationIndex}`,
      artifactId: this.currentArtifactId,
      batchId,
      transactionId: this.currentTransactionId,
      origin: 'rollback-compensation',
      kind: 'compensation',
      channel: shared.name,
      eventName,
      payload,
      recordId: evidence.recordId,
      record: evidence,
      sharedDelivery: entry.options.sharedDelivery,
      compensatesDeliveryId: this.forwardDeliveryId(entry, record)
    })
  }

  private createFactoryOwnedBuiltInInverse(event: AllEvent): AllEvent[] {
    const payload = (event as AllEvent & { payload: unknown }).payload
    if (!payload || typeof payload !== 'object') {
      throw new Error(
        `Transaction event ${event.type} has no invertible payload`
      )
    }
    if (
      event.type === EventTypes.MOVE_ELEMENTS &&
      'moves' in payload &&
      Array.isArray(payload.moves)
    ) {
      const movePayload = payload as MoveElementsChange
      return [
        {
          ...event,
          payload: {
            ...movePayload,
            moves: movePayload.moves.map((move) => ({
              ...move,
              before: move.after,
              after: move.before
            }))
          }
        } as AllEvent
      ]
    }
    if ('changes' in payload && Array.isArray(payload.changes)) {
      const inverseChanges = [...payload.changes]
        .reverse()
        .map((change, index) => {
          if (
            !change ||
            typeof change !== 'object' ||
            !('before' in change) ||
            !('after' in change)
          ) {
            throw new Error(
              `Transaction event ${event.type} has an invalid change at index ${index}`
            )
          }
          return {
            ...change,
            before: change.after,
            after: change.before
          }
        })
      return [
        {
          ...event,
          payload: {
            ...payload,
            changes: inverseChanges
          }
        } as AllEvent
      ]
    }

    let inverseType = event.type
    const inversePayload = { ...payload } as Record<PropertyKey, unknown>
    if ('undoType' in payload && payload.undoType !== undefined) {
      inverseType = payload.undoType as AllEvent['type']
      inversePayload.undoType = event.type
      if ('eventName' in payload) {
        inversePayload.eventName = inverseType
      }
    }
    if ('undoAction' in payload && payload.undoAction !== undefined) {
      inversePayload.action = (payload as { undoAction: unknown }).undoAction
      inversePayload.undoAction = (payload as { action?: unknown }).action
    }
    if ('after' in payload) {
      inversePayload.before = (payload as { after?: unknown }).after
      inversePayload.after = (payload as { before?: unknown }).before
    }
    if ('patch' in payload) {
      inversePayload.patch = invertComputedDataPatchChange(
        (payload as unknown as UpdateElementPatchChange).patch
      )
    }
    return [
      {
        ...event,
        type: inverseType,
        payload: inversePayload
      } as AllEvent
    ]
  }

  private createReplayEvents(
    event: AllEvent,
    direction: 'forward' | 'inverse',
    provenance: 'detached' | 'factory-owned-journal' = 'detached'
  ): AllEvent[] {
    if (direction === 'inverse') {
      const customInverter = this.inverters.get(event.type)
      if (customInverter) {
        const result = customInverter(cloneEvent(event))
        const replayEvents = Array.isArray(result) ? result : [result]
        if (replayEvents.length === 0) {
          throw new Error(
            `Transaction inverter ${event.type} produced no replay event`
          )
        }
        return replayEvents.map((item, index) => {
          if (!isReplayEvent(item)) {
            throw new Error(
              `Transaction inverter ${event.type} produced an invalid replay event at index ${index}`
            )
          }
          return cloneEvent(item)
        })
      }
    }

    if (direction === 'inverse' && provenance === 'factory-owned-journal') {
      return this.createFactoryOwnedBuiltInInverse(event)
    }

    const replayEvent = cloneEvent(event)
    const payload = (replayEvent as AllEvent & { payload: unknown }).payload
    if (
      direction === 'inverse' &&
      replayEvent.type === EventTypes.MOVE_ELEMENTS &&
      payload &&
      typeof payload === 'object' &&
      'moves' in payload &&
      Array.isArray(payload.moves)
    ) {
      const movePayload = payload as MoveElementsChange
      return [
        {
          type: replayEvent.type,
          payload: {
            ...movePayload,
            moves: movePayload.moves.map((move) => ({
              elementId: move.elementId,
              before: { ...move.after },
              after: { ...move.before }
            }))
          }
        } as AllEvent
      ]
    }
    if (
      direction === 'inverse' &&
      payload &&
      typeof payload === 'object' &&
      'changes' in payload
    ) {
      const changes = payload.changes
      if (Array.isArray(changes)) {
        const { changes: _changes, ...basePayload } = payload
        const inverseChanges = [...changes].reverse().map((change, index) => {
          if (
            !change ||
            typeof change !== 'object' ||
            !('before' in change) ||
            !('after' in change)
          ) {
            throw new Error(
              `Transaction event ${event.type} has an invalid change at index ${index}`
            )
          }
          return {
            ...change,
            before: change.after,
            after: change.before
          }
        })
        return [
          {
            type: replayEvent.type,
            payload: {
              ...basePayload,
              changes: inverseChanges
            }
          } as AllEvent
        ]
      }
    }

    if (direction === 'forward') {
      return [replayEvent]
    }

    if (!payload || typeof payload !== 'object') {
      throw new Error(
        `Transaction event ${event.type} has no invertible payload`
      )
    }

    if ('undoType' in payload && payload.undoType !== undefined) {
      const originalType = replayEvent.type
      replayEvent.type = payload.undoType as AllEvent['type']
      ;(payload as { undoType?: unknown }).undoType = originalType
      if ('eventName' in payload) {
        ;(payload as { eventName?: unknown }).eventName = replayEvent.type
      }
    }
    if ('undoAction' in payload && payload.undoAction !== undefined) {
      const originalAction = (payload as { action?: unknown }).action
      ;(payload as { action?: unknown }).action = payload.undoAction
      ;(payload as { undoAction?: unknown }).undoAction = originalAction
    }
    if ('after' in payload) {
      const originalBefore = (payload as { before?: unknown }).before
      const originalAfter = payload.after
      ;(payload as { before?: unknown }).before = originalAfter
      ;(payload as { after?: unknown }).after = originalBefore
    }
    if ('patch' in payload) {
      ;(payload as unknown as UpdateElementPatchChange).patch =
        invertComputedDataPatchChange(
          (payload as unknown as UpdateElementPatchChange).patch
        )
    }

    return [replayEvent]
  }

  applyForwardEvent(event: AllEvent, apply: CanonicalEventApply): boolean {
    return apply(cloneEvent(event)) !== false
  }

  private applyReplayEvent(
    event: AllEvent,
    mode: TransactionReplayMode
  ): boolean {
    const previousApplyingReplayEvent = this.applyingReplayEvent
    this.applyingReplayEvent = true
    try {
      return runInTransactionReplayMode(mode, () => {
        const result = this.onReplayEvent?.(event, mode)
        const handled =
          typeof result === 'object' ? result.handled : result === true
        const applied =
          typeof result === 'object' ? result.applied : result === true
        if (handled) {
          if (applied) {
            acknowledgeTransactionReplayApplied()
          }
          publishEventToObservers(event)
        } else {
          publishEvent(event)
        }
        return isTransactionReplayApplied()
      })
    } finally {
      this.applyingReplayEvent = previousApplyingReplayEvent
    }
  }

  private replay(
    events: readonly AllEvent[],
    direction: 'forward' | 'inverse',
    mode: TransactionReplayMode,
    restorationPlans?: AllEvent[][],
    sharedReplay?: readonly (HistorySharedReplayOutputs | undefined)[],
    preparedReplayEvents?: readonly (readonly AllEvent[] | undefined)[]
  ): unknown[] {
    const failures: unknown[] = []
    const entries = events.map((event, index) => ({
      event,
      shared: sharedReplay?.[index],
      preparedReplayEvents: preparedReplayEvents?.[index]
    }))
    const orderedEntries = direction === 'inverse' ? entries.reverse() : entries

    orderedEntries.forEach(
      ({ event, shared: sharedOutputs, preparedReplayEvents }) => {
        let replayEvents: AllEvent[]
        try {
          replayEvents = preparedReplayEvents
            ? preparedReplayEvents.map(cloneEvent)
            : this.createReplayEvents(event, direction)
        } catch (error) {
          failures.push(error)
          return
        }

        replayEvents.forEach((replayEvent, replayOutputIndex) => {
          const shared = sharedOutputs?.[replayOutputIndex]
          let restorationEvents: AllEvent[] | undefined
          const mustValidateReplayOutput =
            restorationPlans !== undefined ||
            (direction === 'inverse' && this.inverters.has(event.type))
          const replayPayload = (
            replayEvent as AllEvent & { payload?: unknown }
          ).payload
          if (
            mustValidateReplayOutput &&
            !this.hasInverseContract(replayEvent.type, replayPayload)
          ) {
            failures.push(
              new Error(
                `Replay output ${replayEvent.type} requires an inverse contract`
              )
            )
            return
          }
          if (restorationPlans || this.inverters.has(replayEvent.type)) {
            try {
              const inverseOutputEvents = this.createReplayEvents(
                replayEvent,
                'inverse'
              ).map(cloneEvent)
              if (inverseOutputEvents.length === 0) {
                throw new Error(
                  `Replay output ${replayEvent.type} produced no restoration event`
                )
              }
              if (restorationPlans) {
                restorationEvents = inverseOutputEvents
              }
            } catch (error) {
              failures.push(error)
              return
            }
          }

          try {
            const journalStart = this.journal.length
            const applied = this.applyReplayEvent(replayEvent, mode)
            if (restorationEvents && applied) {
              restorationPlans?.push(restorationEvents)
            }
            if (
              applied &&
              shared &&
              !('suppress' in shared) &&
              (mode === 'undo' || mode === 'redo')
            ) {
              const recordedSharedEntries = this.journal
                .slice(journalStart)
                .filter((entry) => entry.shared?.name === shared.name)
              if (recordedSharedEntries.length === 0) {
                this.recordReplaySharedChange(replayEvent, shared)
              } else {
                this.alignReplaySharedEntries(recordedSharedEntries, shared)
              }
            } else if (
              applied &&
              shared &&
              'suppress' in shared &&
              (mode === 'undo' || mode === 'redo')
            ) {
              this.journal.slice(journalStart).forEach((entry) => {
                entry.options.shared = undefined
                entry.shared = undefined
              })
            }
          } catch (error) {
            if (restorationEvents && wasTransactionReplayApplied(error)) {
              restorationPlans?.push(restorationEvents)
            }
            failures.push(error)
          }
        })
        if (
          sharedOutputs?.some(
            (shared) =>
              shared &&
              !('suppress' in shared) &&
              shared.sharedDelivery === 'immediate'
          ) &&
          (mode === 'undo' || mode === 'redo')
        ) {
          this.flushReplaySharedPublications()
        }
      }
    )

    return failures
  }

  private alignReplaySharedEntries(
    entries: readonly TransactionJournalEntry[],
    sharedReplay: HistorySharedReplay
  ): void {
    const immediateEntries: TransactionJournalEntry[] = []
    entries.forEach((entry) => {
      const shared = entry.shared
      if (!shared || shared.name !== sharedReplay.name) return

      entry.options.sharedDelivery = sharedReplay.sharedDelivery
      shared.change = deepFreezeValue(
        toSharedChannelPayload(shared.change, {
          sharedDelivery: sharedReplay.sharedDelivery
        })
      )
      shared.orderedIds = sharedReplay.orderedIds
      shared.recordInversesPrepared = false
      shared.records = sharedReplay.records.map((record, occurrence) => ({
        occurrence,
        orderedIds: record.orderedIds,
        change: deepFreezeValue(
          toSharedChannelPayload(record.payload, {
            undoable: false,
            rollbackable: true,
            sharedDelivery: sharedReplay.sharedDelivery
          })
        ),
        delivered: false,
        published: false
      }))
      if (sharedReplay.deliveryPlan && !this.activeDeliveryPlan) {
        this.configureActiveDeliveryPlan(sharedReplay.deliveryPlan)
      }
      if (
        sharedReplay.sharedDelivery !== 'immediate' ||
        shared.records.some((record) => record.delivered)
      ) {
        return
      }

      immediateEntries.push(entry)
    })
    this.deliverSharedEntries(immediateEntries)
    this.queueImmediatePublicationEntries(
      immediateEntries.filter((entry) =>
        entry.shared?.records.some((record) => record.delivered)
      )
    )
  }

  private recordReplaySharedChange(
    event: AllEvent,
    sharedReplay: HistorySharedReplay
  ): void {
    const payload = cloneAndDeepFreezeValue(
      (event as AllEvent & { payload: TransactionPayload }).payload
    )
    const options: EffectiveMutationOptions = {
      undoable: false,
      rollbackable: true,
      shared: sharedReplay.name,
      sharedDelivery: sharedReplay.sharedDelivery
    }
    const sharedChange = deepFreezeValue(
      toSharedChannelPayload(payload, {
        undoable: false,
        rollbackable: true,
        shared: sharedReplay.name,
        sharedDelivery: sharedReplay.sharedDelivery
      })
    )
    const journalEntry: TransactionJournalEntry = {
      index: this.journal.length,
      event: deepFreezeValue(cloneEvent(event)),
      options,
      source: 'replay',
      shared: {
        name: sharedReplay.name,
        change: sharedChange,
        orderedIds: sharedReplay.orderedIds,
        recordInversesPrepared: false,
        records: sharedReplay.records.map((record, occurrence) => ({
          occurrence,
          orderedIds: record.orderedIds,
          change: deepFreezeValue(
            toSharedChannelPayload(record.payload, {
              undoable: false,
              rollbackable: true,
              sharedDelivery: sharedReplay.sharedDelivery
            })
          ),
          delivered: false,
          published: false
        }))
      }
    }
    this.journal.push(journalEntry)
    if (sharedReplay.deliveryPlan && !this.activeDeliveryPlan) {
      this.configureActiveDeliveryPlan(sharedReplay.deliveryPlan)
    }
    if (journalEntry.shared && sharedReplay.sharedDelivery === 'immediate') {
      this.deliverSharedEntries([journalEntry])
      if (journalEntry.shared.records.some((record) => record.delivered)) {
        this.queueImmediatePublicationEntries([journalEntry])
      }
    }
  }

  private restoreNestedReplay(): unknown[] {
    const failures: unknown[] = []
    ;[...this.nestedReplayRestorationPlans]
      .reverse()
      .forEach((restorationEvents) => {
        restorationEvents.forEach((event) => {
          try {
            this.applyReplayEvent(cloneEvent(event), 'rollback')
          } catch (error) {
            failures.push(error)
          }
        })
      })
    return failures
  }

  private rollbackJournal(
    source?: TransactionJournalEntry['source'],
    artifact?: FactoryMutationBatchArtifact
  ): unknown[] {
    const failures: unknown[] = []
    const rollbackableEntries = this.journal.filter(
      (entry) =>
        entry.options.rollbackable &&
        (source === undefined || entry.source === source)
    )
    const preparedEntries = rollbackableEntries.filter((entry) => {
      const artifactChange = artifact?.changes[entry.index]
      if (artifactChange?.index === entry.index) {
        return true
      }
      try {
        this.prepareEntryInverses(entry)
        return true
      } catch (error) {
        failures.push(error)
        return false
      }
    })
    return [
      ...failures,
      ...this.replay(
        preparedEntries.map(({ event }) => event),
        'inverse',
        'rollback',
        undefined,
        undefined,
        preparedEntries.map(
          (entry) =>
            artifact?.changes[entry.index]?.inverseEvents ?? entry.inverseEvents
        )
      )
    ]
  }

  private compensateImmediateSharedChanges(
    artifact?: FactoryMutationBatchArtifact
  ): unknown[] {
    const failures: unknown[] = []
    const publishedCompensationBatches: SharedDeliveryBatch[] = []
    const artifactRecordsById = measureBrowserDragPhase(
      'factory:index-compensation-records',
      () =>
        new Map(
          (artifact?.changes ?? []).flatMap((change) =>
            (change.shared?.records ?? []).map(
              (record) => [record.recordId, record] as const
            )
          )
        )
    )
    const inversePreparedEntries = new Set<TransactionJournalEntry>()
    const groupedRecords = new Map<
      string,
      {
        forwardBatch: SharedDeliveryBatch
        records: JournalSharedRecordRef[]
      }
    >()
    ;[...this.journal].reverse().forEach((entry) => {
      ;[...(entry.shared?.records ?? [])].reverse().forEach((record) => {
        const forwardBatch = record.batch
        if (!entry.options.rollbackable || !record.delivered || !forwardBatch) {
          return
        }
        const group = groupedRecords.get(forwardBatch.batchId)
        if (group) {
          group.records.push({ entry, record })
        } else {
          groupedRecords.set(forwardBatch.batchId, {
            forwardBatch,
            records: [{ entry, record }]
          })
        }
      })
    })

    groupedRecords.forEach(({ forwardBatch, records }) => {
      try {
        const inverseRecords = records.flatMap((recordRef) => {
          const { entry, record } = recordRef
          if (!inversePreparedEntries.has(entry)) {
            inversePreparedEntries.add(entry)
            this.prepareEntryInverses(entry)
          }
          const artifactRecord = record.evidence
            ? artifactRecordsById.get(record.evidence.recordId)
            : undefined
          const inverseEvents =
            artifactRecord?.inverseEvents ?? record.inverseEvents ?? []
          return inverseEvents.map((inverseEvent, compensationIndex) => ({
            recordRef,
            inverseEvent,
            compensationIndex,
            payload: (
              inverseEvent as AllEvent & { payload: TransactionPayload }
            ).payload
          }))
        })
        const inverseChanges = deepFreezeValue(
          inverseRecords.map(({ payload }) => payload)
        )
        const isRemote = this.transactionOrigin() === 'remote'
        const batchId = this.nextDeliveryBatchId()
        const deliveries = deepFreezeValue(
          isRemote
            ? []
            : inverseRecords.flatMap(
                ({ recordRef, inverseEvent, compensationIndex, payload }) => {
                  const delivery = this.emitCompensationSharedDelivery(
                    recordRef,
                    inverseEvent.type,
                    payload,
                    compensationIndex,
                    batchId
                  )
                  return delivery ? [delivery] : []
                }
              )
        )
        const compensationBatch: SharedDeliveryBatch = deepFreezeValue({
          batchId,
          sliceId: `${forwardBatch.sliceId}:compensation`,
          artifactId: this.currentArtifactId,
          transactionId: this.currentTransactionId,
          origin: 'rollback-compensation',
          kind: 'compensation',
          channel: forwardBatch.channel,
          sharedDelivery: forwardBatch.sharedDelivery,
          deliveries,
          records: deepFreezeValue(
            records.flatMap(({ record }) =>
              record.evidence ? [record.evidence] : []
            )
          ),
          changes: isRemote
            ? inverseChanges
            : deepFreezeValue(deliveries.map((delivery) => delivery.payload)),
          compensatesBatchId: forwardBatch.batchId
        })
        this.sharedEvidenceNotificationDepth += 1
        try {
          const delivered = pushFactoryOwnedBatchToSharedChannel(
            this.sharedDataChannelRegistry,
            compensationBatch.channel,
            compensationBatch.changes
          )
          if (!delivered) {
            throw new Error(
              `Failed to compensate shared channel ${compensationBatch.channel}`
            )
          }
          if (!isRemote) {
            this.onSharedDeliveryBatch?.(compensationBatch)
            if (this.shouldEmitLegacySharedDeliveries()) {
              compensationBatch.deliveries.forEach((delivery) =>
                this.onSharedDelivery?.(delivery)
              )
            }
          }
        } finally {
          this.sharedEvidenceNotificationDepth -= 1
        }
        if (records.some(({ record }) => record.published)) {
          publishedCompensationBatches.push(compensationBatch)
        }
      } catch (error) {
        failures.push(error)
      }
    })

    this.queueSharedPublication(
      this.createSharedPublicationFromBatches(
        publishedCompensationBatches,
        'rollback-compensation'
      )
    )
    this.flushSharedPublications()

    return failures
  }

  private transactionOrigin(): TransactionOrigin {
    if (this.isInUndo()) {
      return 'undo'
    }
    if (this.isInRedo()) {
      return 'redo'
    }
    return this.activeOrigin
  }

  private createStatusPayload(
    status: TransactionStatus,
    failure?: TransactionFailure,
    error?: unknown
  ): TransactionStatusPayload {
    return {
      transactionId: this.currentTransactionId,
      origin: this.transactionOrigin(),
      status,
      ...this.validationContext(),
      ...(failure ? { failure } : {}),
      ...(error !== undefined ? { error } : {}),
      timestamp: Date.now()
    }
  }

  private queueStatus(payload: TransactionStatusPayload): void {
    this.pendingTransactionStatuses.push(payload)
  }

  private flushStatuses(): void {
    if (this.emittingTransactionStatuses) return
    this.emittingTransactionStatuses = true
    try {
      let payload: TransactionStatusPayload | undefined
      while ((payload = this.pendingTransactionStatuses.shift())) {
        this.onStatus?.(payload)
      }
    } finally {
      this.emittingTransactionStatuses = false
    }
  }

  private emitStatus(
    status: TransactionStatus,
    failure?: TransactionFailure,
    error?: unknown
  ) {
    this.queueStatus(this.createStatusPayload(status, failure, error))
    this.flushStatuses()
  }

  private emitCommitCapture(payload: TransactionStatusPayload): void {
    if (!['action', 'undo', 'redo'].includes(payload.origin)) {
      return
    }
    try {
      this.onCommitCapture?.(payload)
    } catch {
      // Persistence capture observers cannot alter canonical settlement.
    }
  }

  private emitReplayCommitted(events: readonly AllEvent[]) {
    const payload: TransactionStatusPayload = {
      transactionId: this.currentTransactionId,
      origin: this.transactionOrigin(),
      status: 'committed',
      changeCount: events.length,
      undoableChangeCount: events.length,
      rollbackableChangeCount: events.length,
      nonRollbackableChangeCount: 0,
      timestamp: Date.now()
    }
    this.emitCommitCapture(payload)
    this.onStatus?.(payload)
  }

  private commitNestedReplayHistory(artifact: FactoryMutationBatchArtifact) {
    if (this.inUndo) {
      if (this.undoStack[this.undoStack.length - 1] !== artifact) {
        throw new Error('Nested undo source history changed before commit')
      }
      this.undoStack.pop()
      this.redoStack.push(artifact)
      return
    }

    if (this.inRedo) {
      if (this.redoStack[this.redoStack.length - 1] !== artifact) {
        throw new Error('Nested redo source history changed before commit')
      }
      this.redoStack.pop()
      this.undoStack.push(artifact)
    }
  }

  private ensureReplayTransactionId() {
    if (this.isTransacting > 0) {
      return
    }
    this.transactionId += 1
    this.currentTransactionId = this.transactionId
  }

  private settleRollback(
    failure?: TransactionFailure,
    precedingFailures: unknown[] = []
  ) {
    this.discardPendingImmediatePublication()
    let rollbackArtifact: FactoryMutationBatchArtifact | undefined
    const artifactFailures: unknown[] = []
    if (this.journal.length > 0) {
      try {
        rollbackArtifact = this.createMutationBatchArtifact()
      } catch (error) {
        artifactFailures.push(error)
      }
    }
    if (this.nestedReplaySourceEvents) {
      this.restoringNestedReplay = true
      let failures: unknown[]
      try {
        failures = [
          ...this.rollbackJournal('action', rollbackArtifact),
          ...this.restoreNestedReplay()
        ]
      } finally {
        this.restoringNestedReplay = false
      }
      const rollbackFailures = [
        ...precedingFailures,
        ...artifactFailures,
        ...failures,
        ...this.compensateImmediateSharedChanges(rollbackArtifact)
      ]
      if (rollbackFailures.length > 0) {
        const rollbackError = new TransactionRollbackError(rollbackFailures)
        this.emitStatus('rollback-failed', failure, rollbackError)
        throw rollbackError
      }

      this.emitStatus('rolled-back', failure)
      return
    }

    if (this.journal.length === 0) {
      this.emitStatus('discarded', failure)
      return
    }

    const failures = [
      ...precedingFailures,
      ...artifactFailures,
      ...this.rollbackJournal(undefined, rollbackArtifact),
      ...this.compensateImmediateSharedChanges(rollbackArtifact)
    ]
    if (failures.length > 0) {
      const rollbackError = new TransactionRollbackError(failures)
      this.emitStatus('rollback-failed', failure, rollbackError)
      throw rollbackError
    }

    this.emitStatus('rolled-back', failure)
  }

  private validationContext(): TransactionValidationContext {
    const undoableChangeCount = this.journal.filter(
      ({ options }) => options.undoable
    ).length
    const rollbackableChangeCount = this.journal.filter(
      ({ options }) => options.rollbackable
    ).length

    return {
      changeCount: this.journal.length,
      undoableChangeCount,
      rollbackableChangeCount,
      nonRollbackableChangeCount: this.journal.length - rollbackableChangeCount
    }
  }

  private validateRequestedCommit() {
    const context = this.validationContext()
    for (const [name, validator] of this.validators) {
      let result: ReturnType<TransactionValidator>
      try {
        result = validator(context)
      } catch (error) {
        throw new TransactionValidationError(
          name,
          'validator-threw',
          `Transaction validator ${name} threw an error`,
          error
        )
      }

      if (
        result &&
        typeof result === 'object' &&
        'then' in result &&
        typeof result.then === 'function'
      ) {
        void Promise.resolve(result).catch(() => undefined)
        throw new TransactionValidationError(
          name,
          'async-validator',
          `Transaction validator ${name} must be synchronous`
        )
      }
      if (result && result.valid === false) {
        throw new TransactionValidationError(name, result.code, result.message)
      }
    }
  }

  private prepareHistoryTransition(
    artifact?: FactoryMutationBatchArtifact
  ): PreparedHistoryTransition | null {
    if (this.nestedReplaySourceArtifact && this.nestedReplaySourceEvents) {
      const sourceArtifact = this.nestedReplaySourceArtifact
      const events = this.nestedReplaySourceEvents
      this.commitNestedReplayHistory(sourceArtifact)

      return {
        complete: () => this.emitReplayCommitted(events),
        rollback: () => {
          if (this.inUndo) {
            if (this.redoStack[this.redoStack.length - 1] !== sourceArtifact) {
              throw new Error('Undo target history changed before rollback')
            }
            this.redoStack.pop()
            this.undoStack.push(sourceArtifact)
            return
          }

          if (this.inRedo) {
            if (this.undoStack[this.undoStack.length - 1] !== sourceArtifact) {
              throw new Error('Redo target history changed before rollback')
            }
            this.undoStack.pop()
            this.redoStack.push(sourceArtifact)
          }
        }
      }
    }

    if (this.isInUndo() || this.isInRedo()) {
      return null
    }

    if (!artifact) {
      throw new Error(
        'Committed mutation batch artifact is required for local history'
      )
    }

    const committedChanges = artifact.changes.filter(
      ({ options }) => options.undoable
    )
    if (committedChanges.length === 0) {
      return null
    }

    const previousRedoStack = this.redoStack
    this.undoStack.push(artifact)
    this.redoStack = []

    return {
      complete: () => {
        this.actionId += 1
        this.onUserActionCompleted?.({
          actionId: this.actionId,
          changeCount: committedChanges.length,
          timestamp: Date.now()
        })
      },
      rollback: () => {
        if (this.undoStack[this.undoStack.length - 1] !== artifact) {
          throw new Error('Action undo history changed before rollback')
        }
        this.undoStack.pop()
        this.redoStack = previousRedoStack
      }
    }
  }

  end(options: EndTransactionOptions = {}) {
    this.assertSharedEvidenceCanonicalControlAllowed()
    if (this.isTransacting <= 0) {
      return
    }

    if (options.outcome === 'rollback') {
      this.rollbackOnly = true
      this.rollbackFailure ??= options.failure
    }

    this.isTransacting--

    if (this.isTransacting === 0) {
      const endingArtifactId = this.currentArtifactId
      this.transactionSettlementDepth += 1
      try {
        if (this.rollbackOnly) {
          this.settleRollback(this.rollbackFailure)
        } else {
          try {
            if (
              this.journal.length > 0 &&
              !this.isInUndo() &&
              !this.isInRedo()
            ) {
              this.validateRequestedCommit()
            }
          } catch (error) {
            this.rollbackFailure = {
              kind: 'validation-failed',
              message: error instanceof Error ? error.message : undefined,
              cause: error
            }
            this.settleRollback(this.rollbackFailure)
            throw error
          }
          if (this.journal.length === 0) {
            if (this.nestedReplaySourceEvents) {
              this.prepareHistoryTransition()?.complete()
            } else if (!this.isInUndo() && !this.isInRedo()) {
              this.emitStatus('discarded')
            }
          } else {
            let historyTransition: PreparedHistoryTransition | null = null
            let artifact: FactoryMutationBatchArtifact
            const sharedPublications: SharedPublication[] = []
            try {
              this.queuePendingImmediatePublication()
              const transactionEndBatches =
                this.prepareTransactionEndDeliveryIndex()
              const transactionEndEntries = this.journal.filter(
                (entry) => entry.options.sharedDelivery === 'transaction-end'
              )
              const preparedArtifact = this.createMutationBatchArtifact({
                preparedDeliveryBatchIds: new Set(
                  transactionEndBatches.map((batch) => batch.batchId)
                )
              })
              if (!preparedArtifact) {
                throw new Error(
                  'Non-empty transaction did not produce a mutation batch artifact'
                )
              }
              artifact = preparedArtifact
              historyTransition = this.prepareHistoryTransition(artifact)
              let allPreparedDeliveriesSucceeded = true
              measureBrowserDragPhase('factory:flush-shared-channels', () => {
                if (this.activeDeliveryPlan?.mode === 'progressive') {
                  this.activeDeliveryPlan.slices.forEach(({ sliceId }) => {
                    const sliceBatches =
                      this.transactionEndBatchesBySlice.get(sliceId) ?? []
                    sliceBatches.forEach((batch) => {
                      if (!this.deliverPreparedSharedBatch(batch)) {
                        allPreparedDeliveriesSucceeded = false
                      }
                    })
                    const sliceRecords =
                      this.transactionEndRecordsBySlice.get(sliceId) ?? []
                    const publication =
                      this.createSharedPublicationFromRecords(sliceRecords)
                    this.queueSharedPublication(publication)
                    this.flushSharedPublications()
                  })
                  return
                }
                transactionEndBatches.forEach((batch) => {
                  if (!this.deliverPreparedSharedBatch(batch)) {
                    allPreparedDeliveriesSucceeded = false
                  }
                })
                const publication = this.createSharedPublication(
                  transactionEndEntries
                )
                if (publication) sharedPublications.push(publication)
              })
              if (!allPreparedDeliveriesSucceeded) {
                historyTransition?.rollback()
                historyTransition = null
                this.currentMutationBatchArtifact = undefined
                const deliveredArtifact = this.createMutationBatchArtifact()
                if (!deliveredArtifact) {
                  throw new Error(
                    'Delivered transaction did not produce a mutation batch artifact'
                  )
                }
                artifact = deliveredArtifact
                historyTransition = this.prepareHistoryTransition(artifact)
              }
              if (!artifact) {
                throw new Error(
                  'Non-empty transaction did not produce a mutation batch artifact'
                )
              }
            } catch (error) {
              this.rollbackFailure = toReplayFailure(error)
              const historyFailures: unknown[] = []
              try {
                historyTransition?.rollback()
              } catch (historyError) {
                historyFailures.push(historyError)
              }
              this.settleRollback(this.rollbackFailure, historyFailures)
              throw error
            }
            sharedPublications.forEach((publication) =>
              this.queueSharedPublication(publication)
            )
            this.deliveryArtifactFinalizers.get(artifact.artifactId)?.(artifact)
            this.queueMutationBatchArtifact(artifact)
            const committedStatus =
              !this.nestedReplaySourceEvents &&
              !this.isInUndo() &&
              !this.isInRedo()
                ? this.createStatusPayload('committed')
                : undefined
            if (committedStatus) {
              this.queueStatus(committedStatus)
              this.emitCommitCapture(committedStatus)
            }
            historyTransition?.complete()
            this.flushMutationBatchArtifacts()
            this.flushSharedPublications()
            this.flushStatuses()
          }
        }
      } finally {
        this.discardPendingImmediatePublication()
        this.journal = []
        this.rollbackOnly = false
        this.rollbackFailure = undefined
        this.activeOrigin = 'action'
        this.activeDeliveryPlan = undefined
        this.activeDeliverySliceByOrderedId.clear()
        this.activeDeliverySliceOrder.clear()
        this.activeDeliveryBoundaryBySliceId.clear()
        this.activeDeliveryOrderedIdOrder.clear()
        this.activeDeliveryPlanValidated = false
        this.nextDeliverySliceIndex = 0
        this.activeDeliveryHandle = undefined
        this.activeDeliveryHandleToken = undefined
        this.deliveryArtifactFinalizers.delete(endingArtifactId)
        this.currentSharedDeliveryBatches = []
        this.preparedSharedBatchRecords.clear()
        this.transactionEndDeliveryBatches = null
        this.transactionEndBatchesBySlice.clear()
        this.transactionEndRecordsBySlice.clear()
        this.currentMutationBatchArtifact = undefined
        if (this.nestedReplaySourceEvents) {
          this.nestedReplaySourceEvents = null
          this.nestedReplaySourceArtifact = null
          this.nestedReplayRestorationPlans = []
          this.inUndo = false
          this.inRedo = false
        }
        this.transactionSettlementDepth -= 1
        if (this.transactionSettlementDepth === 0) {
          this.flushMutationBatchArtifacts()
          this.flushSharedPublications()
          this.flushStatuses()
        }
      }
    }
  }

  flushPendingSharedChannelChanges() {
    measureBrowserDragPhase('factory:flush-shared-channels', () => {
      this.deliverSharedEntries(
        this.journal.filter((entry) =>
          entry.shared?.records.some((record) => !record.delivered)
        )
      )
    })
  }

  private historyChanges(artifact: FactoryMutationBatchArtifact) {
    return artifact.changes.filter(({ options }) => options.undoable)
  }

  private historySharedReplay(
    artifact: FactoryMutationBatchArtifact,
    direction: 'forward' | 'inverse'
  ): readonly (HistorySharedReplayOutputs | undefined)[] {
    const historyChanges = this.historyChanges(artifact)
    const deliveredRecordsByChange = historyChanges.map((change) => {
      if (!change.shared) return []
      const deliveredIds = new Set(change.shared.deliveryIds)
      return change.shared.records.filter((record) =>
        deliveredIds.has(record.deliveryId)
      )
    })
    const deliveredOrderedIds = new Set<string>()
    deliveredRecordsByChange.forEach((records) =>
      records.forEach((record) =>
        record.orderedIds.forEach((orderedId) =>
          deliveredOrderedIds.add(orderedId)
        )
      )
    )
    const hasExplicitOrderedIds = deliveredOrderedIds.size > 0
    const deliveryPlan =
      hasExplicitOrderedIds && artifact.deliveryPlan.mode === 'progressive'
        ? deepFreezeValue({
            mode: 'progressive' as const,
            slices:
              direction === 'forward'
                ? artifact.deliveryPlan.slices.flatMap((slice) => {
                    const orderedIds = slice.orderedIds.filter((orderedId) =>
                      deliveredOrderedIds.has(orderedId)
                    )
                    return orderedIds.length > 0
                      ? [{ sliceId: slice.sliceId, orderedIds }]
                      : []
                  })
                : [...artifact.deliveryPlan.slices]
                    .reverse()
                    .flatMap((slice) => {
                      const orderedIds = [...slice.orderedIds]
                        .reverse()
                        .filter((orderedId) =>
                          deliveredOrderedIds.has(orderedId)
                        )
                      return orderedIds.length > 0
                        ? [
                            {
                              sliceId: `${slice.sliceId}:inverse`,
                              orderedIds
                            }
                          ]
                        : []
                    })
          })
        : undefined
    return historyChanges.map((change, changeIndex) => {
      if (!change.shared) return
      const deliveredRecords = deliveredRecordsByChange[changeIndex] ?? []
      const outputCount =
        direction === 'forward' ? 1 : change.inverseEvents.length
      if (deliveredRecords.length === 0) {
        return deepFreezeValue(
          Array.from(
            { length: outputCount },
            (): SuppressedHistorySharedReplay => ({ suppress: true })
          )
        )
      }
      const sourceRecords =
        direction === 'forward'
          ? deliveredRecords
          : [...deliveredRecords].reverse()
      return deepFreezeValue(
        Array.from({ length: outputCount }, (_, outputIndex) => {
          const records = sourceRecords.map((record) => ({
            orderedIds:
              direction === 'forward'
                ? record.orderedIds
                : [...record.orderedIds].reverse(),
            payload:
              direction === 'forward'
                ? (record.payload as TransactionPayload)
                : (
                    record.inverseEvents[outputIndex] as AllEvent & {
                      payload: TransactionPayload
                    }
                  ).payload
          }))
          const orderedIds: string[] = []
          const seenOrderedIds = new Set<string>()
          records.forEach((record) =>
            record.orderedIds.forEach((orderedId) => {
              if (seenOrderedIds.has(orderedId)) return
              seenOrderedIds.add(orderedId)
              orderedIds.push(orderedId)
            })
          )
          return {
            name: change.shared?.channel ?? '',
            sharedDelivery: change.options.sharedDelivery,
            orderedIds: deepFreezeValue(orderedIds),
            records: deepFreezeValue(records),
            deliveryPlan
          }
        })
      )
    })
  }

  undo() {
    if (this.isTransacting > 0 && this.activeOrigin === 'remote') {
      throw new Error('Remote transaction cannot consume local undo history')
    }
    if (!this.undoStack.length) {
      return
    }

    const hasOuterBoundary = this.isTransacting > 0
    if (
      hasOuterBoundary &&
      (this.journal.length > 0 || this.nestedReplaySourceEvents)
    ) {
      throw new Error('Undo cannot join a non-empty transaction journal')
    }

    const sourceArtifact = this.undoStack[this.undoStack.length - 1]
    if (!sourceArtifact) return
    const sourceChanges = this.historyChanges(sourceArtifact)
    const lastChanges = sourceChanges.map(({ event }) => event)
    let openedBoundary = false
    this.inUndo = true
    updateUndoRedoStatus(UNDO.UNDO)

    try {
      if (!hasOuterBoundary) {
        startTransaction()
        openedBoundary = true
      }
      this.ensureReplayTransactionId()

      this.nestedReplaySourceEvents = lastChanges
      this.nestedReplaySourceArtifact = sourceArtifact
      this.nestedReplayRestorationPlans = []
      const failures = this.replay(
        lastChanges,
        'inverse',
        'undo',
        this.nestedReplayRestorationPlans,
        this.historySharedReplay(sourceArtifact, 'inverse'),
        sourceChanges.map(({ inverseEvents }) => inverseEvents)
      )
      if (failures.length > 0) {
        throw new TransactionRollbackError(failures)
      }

      if (!hasOuterBoundary) {
        endTransaction()
        openedBoundary = false
      }
    } catch (error) {
      const failure = toReplayFailure(error)
      if (hasOuterBoundary) {
        this.rollbackOnly = true
        this.rollbackFailure ??= failure
      } else if (openedBoundary) {
        endTransaction({ outcome: 'rollback', failure })
        openedBoundary = false
      }
      throw error
    } finally {
      updateUndoRedoStatus(UNDO.NONE)
      if (!hasOuterBoundary) {
        this.journal = []
        this.inUndo = false
      }
    }
  }

  redo() {
    if (this.isTransacting > 0 && this.activeOrigin === 'remote') {
      throw new Error('Remote transaction cannot consume local redo history')
    }
    if (!this.redoStack.length) {
      return
    }

    const hasOuterBoundary = this.isTransacting > 0
    if (
      hasOuterBoundary &&
      (this.journal.length > 0 || this.nestedReplaySourceEvents)
    ) {
      throw new Error('Redo cannot join a non-empty transaction journal')
    }

    const sourceArtifact = this.redoStack[this.redoStack.length - 1]
    if (!sourceArtifact) return
    const sourceChanges = this.historyChanges(sourceArtifact)
    const lastChanges = sourceChanges.map(({ event }) => event)
    let openedBoundary = false
    this.inRedo = true
    updateUndoRedoStatus(UNDO.REDO)

    try {
      if (!hasOuterBoundary) {
        startTransaction()
        openedBoundary = true
      }
      this.ensureReplayTransactionId()

      this.nestedReplaySourceEvents = lastChanges
      this.nestedReplaySourceArtifact = sourceArtifact
      this.nestedReplayRestorationPlans = []
      const failures = this.replay(
        lastChanges,
        'forward',
        'redo',
        this.nestedReplayRestorationPlans,
        this.historySharedReplay(sourceArtifact, 'forward')
      )
      if (failures.length > 0) {
        throw new TransactionRollbackError(failures)
      }

      if (!hasOuterBoundary) {
        endTransaction()
        openedBoundary = false
      }
    } catch (error) {
      const failure = toReplayFailure(error)
      if (hasOuterBoundary) {
        this.rollbackOnly = true
        this.rollbackFailure ??= failure
      } else if (openedBoundary) {
        endTransaction({ outcome: 'rollback', failure })
        openedBoundary = false
      }
      throw error
    } finally {
      updateUndoRedoStatus(UNDO.NONE)
      if (!hasOuterBoundary) {
        this.journal = []
        this.inRedo = false
      }
    }
  }

  isInUndo() {
    return this.inUndo
  }

  isInRedo() {
    return this.inRedo
  }

  dispose() {
    this.discardPendingImmediatePublication()
    this.pendingMutationBatchArtifacts.length = 0
    this.pendingSharedPublications.length = 0
    this.emittingMutationBatchArtifacts = false
    this.transactionSettlementDepth = 0
    this.publicationSequence = 0
    this.journal = []
    this.undoStack = []
    this.redoStack = []
    this.isTransacting = 0
    this.inUndo = false
    this.inRedo = false
    this.applyingReplayEvent = false
    this.restoringNestedReplay = false
    this.nestedReplaySourceEvents = null
    this.nestedReplaySourceArtifact = null
    this.nestedReplayRestorationPlans = []
    this.actionId = 0
    this.transactionId = 0
    this.currentTransactionId = 0
    this.currentArtifactId = ''
    this.activeOrigin = 'action'
    this.deliveryBatchSequence = 0
    this.currentSharedDeliveryBatches = []
    this.preparedSharedBatchRecords.clear()
    this.transactionEndDeliveryBatches = null
    this.transactionEndBatchesBySlice.clear()
    this.transactionEndRecordsBySlice.clear()
    this.currentMutationBatchArtifact = undefined
    this.activeDeliveryPlan = undefined
    this.activeDeliverySliceByOrderedId.clear()
    this.activeDeliverySliceOrder.clear()
    this.activeDeliveryBoundaryBySliceId.clear()
    this.activeDeliveryOrderedIdOrder.clear()
    this.activeDeliveryPlanValidated = false
    this.nextDeliverySliceIndex = 0
    this.activeDeliveryHandle = undefined
    this.activeDeliveryHandleToken = undefined
    this.deliveryArtifactFinalizers.clear()
    this.sharedEvidenceNotificationDepth = 0
    this.rollbackOnly = false
    this.rollbackFailure = undefined
  }

  reset() {
    this.dispose()
  }
}

export default DataTransact
