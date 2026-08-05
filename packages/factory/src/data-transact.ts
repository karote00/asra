import type {
  EndTransactionOptions,
  PropsChange,
  ReplaceLatestHistoryOptions,
  SceneTreeChange,
  SharedDeliveryMode,
  ElementSelectionChange,
  MoveElementsChange,
  TransactionFailure,
  TransactionOrigin,
  TransactionStatus,
  TransactionStatusPayload
} from '@asyra/utils'
import { UNDO, measureBrowserDragPhase } from '@asyra/utils'

type TransactionPayload = PropsChange | SceneTreeChange | ElementSelectionChange
interface EffectiveMutationOptions {
  undoable: boolean
  rollbackable: boolean
  shared?: string
  sharedDelivery: SharedDeliveryMode
  history?: ReplaceLatestHistoryOptions
}

interface JournalSharedRecord {
  occurrence: number
  orderedIds: readonly string[]
  change: TransactionPayload
  delivered: boolean
  publicationId?: string
  compensationPublicationId?: string
  acknowledgedPublicationId?: string
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
  orderedIds: readonly string[]
  options: EffectiveMutationOptions
  source: 'action' | 'replay'
  trustedOwnerValues: boolean
  inverseEvents?: readonly AllEvent[]
  shared?: JournalSharedChange
}
interface FactoryHistoryEntry {
  readonly entries: readonly TransactionJournalEntry[]
  readonly progressiveDeliverySequence?: FactoryMutationDeliverySequence
}
interface ReplaceLatestHistoryStage {
  readonly first: ReplaceLatestHistoryCandidate
  latest: ReplaceLatestHistoryCandidate
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
    readinessKey: string
    orderedIds: readonly string[]
    payload: TransactionPayload
  }[]
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
interface HistoryReplaySharedBatchState {
  readonly batch: SharedDeliveryBatch
  readonly requiredReadinessKeys: ReadonlySet<string>
  readonly readyReadinessKeys: Set<string>
  delivered: boolean
  publicationId?: string
  compensationPublicationId?: string
  acknowledgedPublicationId?: string
}
interface HistoryReplaySharedState {
  readonly direction: 'forward' | 'inverse'
  readonly ownsReplayEvidence: boolean
  readonly batchStates: readonly HistoryReplaySharedBatchState[]
  readonly batchStateById: ReadonlyMap<string, HistoryReplaySharedBatchState>
  readonly batchStatesByReadinessKey: ReadonlyMap<
    string,
    readonly HistoryReplaySharedBatchState[]
  >
}
interface HistoryReplaySliceSettlement {
  readonly explicitBoundary: boolean
  readonly workItemKeys: readonly string[]
}
interface PreparedReplayStep {
  readonly replayEvent: AllEvent
  readonly restorationEvents?: AllEvent[]
  readonly shared?: HistorySharedReplayDirective
}
interface DataTransactCallbacks {
  canReplayEventBatch?: (eventType: string) => boolean
  onCommitCapture?: (payload: TransactionStatusPayload) => void
  onStatus?: (payload: TransactionStatusPayload) => void
  onUserActionCompleted?: (payload: UserActionCompletedPayload) => void
  onReplayEvent?: (
    event: AllEvent,
    mode: TransactionReplayMode
  ) => boolean | { handled: boolean; applied: boolean }
  onSharedDeliveryBatch?: (batch: SharedDeliveryBatch) => void
  onSharedPublication?: (publication: SharedPublication) => boolean
}
import type {
  AllEvent,
  CooperativeRenderBatchOptions,
  ReplaceLatestHistoryCandidate,
  TransactionCanonicalEvidence,
  TransactionReplayMode,
  UpdateTransactionEvent,
  UserActionCompletedPayload
} from '@asyra/reactive-events'
import {
  acknowledgeTransactionReplayApplied,
  applyEventBatchToSynchronousOwners,
  EventTypes,
  endTransaction,
  hasSynchronousEventBatchHandler,
  isDetachedTransactionValue,
  isTransactionReplayApplied,
  publishEvent,
  publishEventsToObservers,
  publishEventToObservers,
  resolveCooperativeRenderMaxItemsPerSlice,
  runInTransactionReplayMode,
  startTransaction,
  userActionCompleted,
  wasTransactionReplayApplied,
  updateUndoRedoStatus
} from '@asyra/reactive-events'
import {
  pushFactoryOwnedBatchToSharedChannel,
  SharedDataChannelRegistry
} from './shared-data-channel.js'
import {
  TransactionRollbackError,
  TransactionValidationError,
  type TransactionInverter,
  type CanonicalEventApply,
  type TransactionValidationContext,
  type TransactionValidator
} from './transaction.js'
import type {
  FactoryMutationDeliverySequence,
  SharedDelivery,
  SharedDeliveryBatch,
  SharedDeliveryOrigin,
  SharedPublication,
  SharedPublicationBatch,
  SharedPublicationDelivery,
  SharedPublicationSlice
} from './shared-delivery.js'
import {
  FactoryMutationBatchAcceptanceError,
  type FactoryMutationBatchDeliveryHandle,
  type FactoryMutationSharedRecordEvidence,
  type FactoryStagedDeliveryController
} from './mutation-batch.js'
import {
  adoptDeeplyFrozenValue,
  cloneAndDeepFreezeValue,
  cloneValue,
  deepFreezeValue,
  freezeTrustedValue,
  isDeeplyFrozenValue
} from './value-clone.js'

const BUILT_IN_INVERTIBLE_EVENT_TYPES = new Set<string>([
  EventTypes.ADD_ELEMENT,
  EventTypes.ADD_ELEMENTS,
  EventTypes.REMOVE_ELEMENT,
  EventTypes.REMOVE_ELEMENTS,
  EventTypes.MOVE_ELEMENTS,
  EventTypes.CHANGE_SUBTREE,
  EventTypes.UPDATE_ELEMENT_DATA,
  EventTypes.ADD_PROPERTY,
  EventTypes.REMOVE_PROPERTY,
  EventTypes.UPDATE_PROPERTY,
  EventTypes.SELECT_ELEMENTS,
  EventTypes.SELECT_VECTOR_POINTS,
  EventTypes.SELECT_VECTOR_SEGMENTS
])

const LOCAL_ONLY_COMPUTED_EVENT_TYPES = new Set<string>([
  EventTypes.UPDATE_COMPUTED_DATA,
  EventTypes.UPDATE_COMPUTED_DATA_PATCH
])

const MAX_CANONICAL_REPLAY_OWNER_BATCH_ITEMS = 32
const DEFAULT_SHARED_PUBLICATION_MAX_WORK_ITEMS = 512

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

const freezeTrustedTransactionPayload = (
  payload: TransactionPayload
): TransactionPayload => {
  if (payload.options) {
    freezeTrustedValue(payload.options)
  }
  return freezeTrustedValue(payload)
}

const freezeSharedChannelPayload = (
  payload: TransactionPayload,
  options: UpdateTransactionEvent['options'],
  trustedOwnerValues: boolean
): TransactionPayload => {
  const sharedPayload = toSharedChannelPayload(payload, options)
  return trustedOwnerValues
    ? freezeTrustedTransactionPayload(sharedPayload)
    : deepFreezeValue(sharedPayload)
}

const freezeReplayEvents = (
  events: AllEvent[],
  trustedOwnerValues: boolean
): readonly AllEvent[] => {
  if (!trustedOwnerValues) {
    return deepFreezeValue(events)
  }

  events.forEach((event) => {
    const payload = (event as AllEvent & { payload?: unknown }).payload
    if (payload && typeof payload === 'object') {
      ;(['changes', 'moves'] as const).forEach((key) => {
        if (!(key in payload)) return
        const values = (payload as Record<string, unknown>)[key]
        if (!Array.isArray(values)) return
        values.forEach((value) => {
          if (value && typeof value === 'object') {
            freezeTrustedValue(value)
          }
        })
        freezeTrustedValue(values)
      })
      const options = (payload as { options?: unknown }).options
      if (options && typeof options === 'object') {
        freezeTrustedValue(options)
      }
      freezeTrustedValue(payload)
    }
    freezeTrustedValue(event)
  })
  return freezeTrustedValue(events)
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

const areHistoryValuesEqual = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) return true
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => areHistoryValuesEqual(value, right[index]))
    )
  }
  if (!isPlainRecord(left) || !isPlainRecord(right)) return false

  const leftRecord = left as Record<string, unknown>
  const rightRecord = right as Record<string, unknown>
  const leftKeys = Reflect.ownKeys(leftRecord)
  const rightKeys = Reflect.ownKeys(rightRecord)
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(rightRecord, key) &&
        areHistoryValuesEqual(
          Reflect.get(leftRecord, key),
          Reflect.get(rightRecord, key)
        )
    )
  )
}

const toReplayFailure = (cause: unknown): TransactionFailure => ({
  kind: 'explicit',
  message: cause instanceof Error ? cause.message : undefined,
  cause
})

class DataTransact {
  private journal: TransactionJournalEntry[] = []
  private readonly replaceLatestHistoryStages = new Map<
    string,
    ReplaceLatestHistoryStage
  >()
  private preparedActionHistoryEntries:
    | readonly TransactionJournalEntry[]
    | null = null
  private undoStack: FactoryHistoryEntry[] = []
  private redoStack: FactoryHistoryEntry[] = []
  private isTransacting = 0
  private inUndo = false
  private inRedo = false
  private applyingReplayEvent = false
  private restoringNestedReplay = false
  private nestedReplaySourceEvents: AllEvent[] | null = null
  private nestedReplaySourceHistory: FactoryHistoryEntry | null = null
  private nestedReplayRestorationBatches: AllEvent[][] = []
  private actionId = 0
  private transactionId = 0
  private currentTransactionId = 0
  private currentArtifactId = ''
  private activeOrigin: TransactionOrigin = 'action'
  private rollbackOnly = false
  private rollbackFailure: TransactionFailure | undefined
  private transactionSettlementDepth = 0
  private readonly pendingSharedPublications: SharedPublication[] = []
  private readonly publicationAcknowledgements = new Map<
    SharedPublication,
    () => void
  >()
  private readonly unacknowledgedSharedPublications: SharedPublication[] = []
  private emittingSharedPublications = false
  private readonly pendingImmediatePublicationEntries: TransactionJournalEntry[] =
    []
  private readonly pendingImmediatePublicationRecords: JournalSharedRecordRef[] =
    []
  private readonly pendingImmediatePublicationWorkItemKeys = new Set<string>()
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
  private readonly pendingProgressivePublicationRecords: JournalSharedRecordRef[] =
    []
  private readonly pendingProgressivePublicationWorkItemKeys = new Set<string>()
  private readonly pendingHistoryReplayPublicationBatches: SharedDeliveryBatch[] =
    []
  private readonly pendingHistoryReplayPublicationWorkItemKeys =
    new Set<string>()
  private historyReplaySharedState: HistoryReplaySharedState | undefined
  private retainingHistoryReplaySharedEvidence = false
  private activeDeliverySequence: FactoryMutationDeliverySequence | undefined
  private readonly activeDeliverySliceByOrderedId = new Map<string, string>()
  private readonly activeDeliverySliceOrder = new Map<string, number>()
  private readonly activeDeliveryBoundaryBySliceId = new Map<
    string,
    FactoryMutationDeliverySequence['slices'][number]
  >()
  private readonly activeDeliveryOrderedIdOrder = new Map<string, number>()
  private activeDeliverySequenceValidated = false
  private nextDeliverySliceIndex = 0
  private activeStagedDeliveryController:
    | FactoryStagedDeliveryController
    | undefined
  private activeDeliveryHandle: FactoryMutationBatchDeliveryHandle | undefined
  private activeDeliveryHandleToken: symbol | undefined
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
  private readonly canReplayEventBatch?: (eventType: string) => boolean
  private readonly onSharedDeliveryBatch?: (batch: SharedDeliveryBatch) => void
  private readonly onSharedPublication?: (
    publication: SharedPublication
  ) => boolean
  private readonly sharedDataChannelRegistry: Pick<
    SharedDataChannelRegistry,
    'pushBatchToSharedChannel'
  >

  constructor(
    sharedDataChannelRegistry?: Pick<
      SharedDataChannelRegistry,
      'pushBatchToSharedChannel'
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
    this.canReplayEventBatch = callbacks?.canReplayEventBatch
    this.onSharedDeliveryBatch = callbacks?.onSharedDeliveryBatch
    this.onSharedPublication = callbacks?.onSharedPublication
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
    this.replaceLatestHistoryStages.clear()
    this.preparedActionHistoryEntries = null
    this.pendingImmediatePublicationEntries.length = 0
    this.pendingImmediatePublicationRecords.length = 0
    this.pendingImmediatePublicationWorkItemKeys.clear()
    this.immediatePublicationToken += 1
    this.scheduledImmediatePublicationToken = null
    this.publicationSequence = 0
    this.deliveryBatchSequence = 0
    this.currentSharedDeliveryBatches = []
    this.preparedSharedBatchRecords.clear()
    this.transactionEndDeliveryBatches = null
    this.transactionEndBatchesBySlice.clear()
    this.transactionEndRecordsBySlice.clear()
    this.pendingProgressivePublicationRecords.length = 0
    this.pendingProgressivePublicationWorkItemKeys.clear()
    this.pendingHistoryReplayPublicationBatches.length = 0
    this.pendingHistoryReplayPublicationWorkItemKeys.clear()
    this.historyReplaySharedState = undefined
    this.retainingHistoryReplaySharedEvidence = false
    this.activeDeliverySequence = undefined
    this.activeDeliverySliceByOrderedId.clear()
    this.activeDeliverySliceOrder.clear()
    this.activeDeliveryBoundaryBySliceId.clear()
    this.activeDeliveryOrderedIdOrder.clear()
    this.activeDeliverySequenceValidated = false
    this.nextDeliverySliceIndex = 0
    this.nestedReplayRestorationBatches = []
    this.rollbackOnly = false
    this.rollbackFailure = undefined
    this.transactionId += 1
    this.currentTransactionId = this.transactionId
    this.currentArtifactId = `${this.currentTransactionId}:artifact`
    const transactionId = this.currentTransactionId
    const artifactId = this.currentArtifactId
    const handleToken = Symbol(artifactId)
    this.activeDeliveryHandleToken = handleToken
    const assertControllerActive = () => {
      if (
        this.isTransacting <= 0 ||
        this.activeDeliveryHandleToken !== handleToken ||
        this.currentTransactionId !== transactionId ||
        this.currentArtifactId !== artifactId
      ) {
        throw new Error(
          'Factory staged delivery controller is no longer active'
        )
      }
      this.assertSharedEvidenceCanonicalControlAllowed()
    }
    const setDeliverySequence = (sequence: FactoryMutationDeliverySequence) => {
      assertControllerActive()
      if (this.activeDeliverySequence) {
        throw new Error(
          'Factory mutation batch delivery sequence is already configured'
        )
      }
      try {
        this.configureActiveDeliverySequence(sequence)
      } catch (error) {
        this.rollbackOnly = true
        this.rollbackFailure ??= toReplayFailure(error)
        throw error
      }
    }
    const stageSlice = (sliceId: string) => {
      assertControllerActive()
      this.deliverActiveSlice(sliceId)
    }
    this.activeStagedDeliveryController = Object.freeze({
      artifactId,
      transactionId,
      setDeliverySequence,
      stageSlice
    })
    this.activeDeliveryHandle = Object.freeze({
      artifactId,
      transactionId,
      setDeliverySequence,
      deliverSlice: stageSlice
    })
  }

  getActiveStagedDeliveryController(): FactoryStagedDeliveryController | null {
    return this.activeStagedDeliveryController ?? null
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
    events: readonly UpdateTransactionEvent[]
  ): FactoryMutationBatchDeliveryHandle | null {
    this.assertSharedEvidenceCanonicalControlAllowed()
    if (this.isTransacting <= 0 || this.restoringNestedReplay) {
      return null
    }

    const deliveryHandle = this.activeDeliveryHandle ?? null
    const journalStart = this.journal.length
    const trustedOwnerValues = isDetachedTransactionValue(events)
    let batchAccepted = false
    try {
      const ownerHandoff = measureBrowserDragPhase(
        'factory:owner-batch-clone',
        () =>
          isDeeplyFrozenValue(events)
            ? events
            : cloneAndDeepFreezeValue([...events])
      )
      const detachedEvents = ownerHandoff
      const localComputedEvent = detachedEvents.find((event) =>
        LOCAL_ONLY_COMPUTED_EVENT_TYPES.has(event.eventName)
      )
      if (localComputedEvent) {
        throw new Error(
          `Factory canonical mutation batch cannot contain local-only computed event: ${localComputedEvent.eventName}`
        )
      }
      if (
        this.transactionEndDeliveryBatches !== null &&
        detachedEvents.some(
          (event) =>
            event.options?.shared !== undefined &&
            (event.options.sharedDelivery ?? 'transaction-end') ===
              'transaction-end'
        )
      ) {
        throw new Error(
          'Factory mutation batch cannot change after progressive delivery preparation'
        )
      }
      if (
        !(
          this.applyingReplayEvent && this.retainingHistoryReplaySharedEvidence
        ) &&
        this.activeDeliverySequence?.mode === 'progressive' &&
        this.nextDeliverySliceIndex <
          this.activeDeliverySequence.slices.length &&
        detachedEvents.some(
          (event) =>
            event.options?.shared !== undefined &&
            event.options.sharedDelivery === 'immediate'
        )
      ) {
        throw new Error(
          'Factory mutation immediate delivery requires every progressive slice to be delivered first'
        )
      }
      const recordedEntries = detachedEvents.map((event) =>
        this.recordJournalEntry(event, trustedOwnerValues)
      )
      this.stageReplaceLatestHistory(detachedEvents)
      batchAccepted = true
      if (
        this.nestedReplaySourceEvents &&
        recordedEntries.some((entry) => entry.source === 'action')
      ) {
        throw new Error(
          'Nested undo or redo cannot accept a new action mutation'
        )
      }
      const immediateEntries =
        this.applyingReplayEvent && this.retainingHistoryReplaySharedEvidence
          ? []
          : recordedEntries.filter(
              (entry) =>
                entry.shared && entry.options.sharedDelivery === 'immediate'
            )
      this.deliverSharedEntries(
        immediateEntries,
        immediateEntries.length > 0
          ? `${this.currentArtifactId}:owner-batch:${journalStart}`
          : undefined
      )
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

  private stageReplaceLatestHistory(
    events: readonly UpdateTransactionEvent[]
  ): void {
    const firstEvent = events[0]
    if (!firstEvent) return

    const history = firstEvent.options?.history
    const candidate = firstEvent.historyCandidate
    if (!history && !candidate) return
    if (history?.mode !== 'replace-latest') {
      throw new Error(
        'Factory History candidate requires replace-latest transaction options'
      )
    }
    if (!history.key || !candidate || candidate.key !== history.key) {
      throw new Error(
        'Factory replace-latest History candidate must match its gesture key'
      )
    }
    if (candidate.events.length === 0) {
      throw new Error(
        'Factory replace-latest History candidate requires a complete event bundle'
      )
    }

    const existing = this.replaceLatestHistoryStages.get(history.key)
    if (existing) {
      existing.latest = candidate
      return
    }
    this.replaceLatestHistoryStages.set(history.key, {
      first: candidate,
      latest: candidate
    })
  }

  private validateEventDeliveryEvidence(
    evidence: TransactionCanonicalEvidence,
    eventIndex: number,
    trustedOwnerValues: boolean
  ): void {
    if (trustedOwnerValues) {
      adoptDeeplyFrozenValue(evidence)
      adoptDeeplyFrozenValue(evidence.orderedIds)
      if (evidence.sharedRecords) {
        adoptDeeplyFrozenValue(evidence.sharedRecords)
      }
    }
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
      if (trustedOwnerValues) {
        adoptDeeplyFrozenValue(record)
        adoptDeeplyFrozenValue(record.orderedIds)
        adoptDeeplyFrozenValue(record.payload)
      }
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
    trustedOwnerValues: boolean
  ): TransactionJournalEntry {
    const journalEntry = this.createJournalEntry(
      event,
      trustedOwnerValues,
      this.journal.length,
      this.applyingReplayEvent ? 'replay' : 'action'
    )
    this.journal.push(journalEntry)
    return journalEntry
  }

  private createJournalEntry(
    event: UpdateTransactionEvent,
    trustedOwnerValues: boolean,
    entryIndex: number,
    source: TransactionJournalEntry['source']
  ): TransactionJournalEntry {
    const deliveryEvidence = event.canonicalEvidence
    const newPayload = event.payload as TransactionPayload
    const newType = event.eventName as AllEvent['type']
    if (trustedOwnerValues) {
      adoptDeeplyFrozenValue(newPayload)
    }
    if (deliveryEvidence) {
      this.validateEventDeliveryEvidence(
        deliveryEvidence,
        entryIndex,
        trustedOwnerValues
      )
      if (deliveryEvidence.sharedRecords && !event.options?.shared) {
        throw new Error(
          `Factory mutation shared record evidence ${entryIndex} requires a shared canonical event`
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
      sharedDelivery: event.options?.sharedDelivery ?? 'transaction-end',
      history: event.options?.history
    }
    if (
      (options.rollbackable || options.undoable) &&
      !this.hasInverseContract(event.eventName, newPayload)
    ) {
      throw new Error(
        `Reversible transaction event ${event.eventName} requires an inverter`
      )
    }
    const journalEntry: TransactionJournalEntry = {
      index: entryIndex,
      event: newEvent,
      orderedIds:
        deliveryEvidence?.orderedIds ?? deepFreezeValue<readonly string[]>([]),
      options,
      source,
      trustedOwnerValues
    }

    const sharedChannelName = event.options?.shared
    if (sharedChannelName) {
      const sharedOptions =
        origin === 'remote'
          ? { ...event.options, undoable: false, rollbackable: true }
          : event.options
      const sharedChange = measureBrowserDragPhase(
        'factory:shared-payload-normalize',
        () =>
          freezeSharedChannelPayload(
            newPayload,
            sharedOptions,
            trustedOwnerValues
          )
      )
      const recordInputs = deliveryEvidence?.sharedRecords ?? [
        {
          orderedIds: deliveryEvidence?.orderedIds ?? [],
          payload: newPayload
        }
      ]
      journalEntry.shared = {
        name: sharedChannelName,
        change: sharedChange,
        orderedIds: deliveryEvidence?.orderedIds ?? [],
        recordInversesPrepared: false,
        records: recordInputs.map((record, occurrence) => ({
          occurrence,
          orderedIds: record.orderedIds,
          change:
            record.payload === newPayload
              ? sharedChange
              : freezeSharedChannelPayload(
                  record.payload as TransactionPayload,
                  sharedOptions,
                  trustedOwnerValues
                ),
          delivered: false
        }))
      }
    }

    this.prepareEntryInverses(journalEntry)

    return journalEntry
  }

  private mergeReplaceLatestHistoryPayload(
    firstPayload: unknown,
    latestPayload: unknown,
    candidateIndex: number
  ): TransactionPayload | null {
    if (!isPlainRecord(firstPayload) || !isPlainRecord(latestPayload)) {
      throw new Error(
        `Factory replace-latest History candidate ${candidateIndex} requires plain record payloads`
      )
    }
    if (
      !Object.prototype.hasOwnProperty.call(firstPayload, 'before') ||
      !Object.prototype.hasOwnProperty.call(firstPayload, 'after') ||
      !Object.prototype.hasOwnProperty.call(latestPayload, 'before') ||
      !Object.prototype.hasOwnProperty.call(latestPayload, 'after')
    ) {
      throw new Error(
        `Factory replace-latest History candidate ${candidateIndex} requires before and after values`
      )
    }

    const firstRecord = firstPayload as Record<string, unknown>
    const latestRecord = latestPayload as Record<string, unknown>
    const identityKeys = new Set(
      [
        ...Reflect.ownKeys(firstRecord),
        ...Reflect.ownKeys(latestRecord)
      ].filter((key) => key !== 'before' && key !== 'after')
    )
    if (
      [...identityKeys].some(
        (key) =>
          !Object.prototype.hasOwnProperty.call(firstRecord, key) ||
          !Object.prototype.hasOwnProperty.call(latestRecord, key) ||
          !areHistoryValuesEqual(
            Reflect.get(firstRecord, key),
            Reflect.get(latestRecord, key)
          )
      )
    ) {
      throw new Error(
        `Factory replace-latest History candidate ${candidateIndex} changed identity`
      )
    }

    const before = firstRecord.before
    const after = latestRecord.after
    if (areHistoryValuesEqual(before, after)) {
      return null
    }
    return {
      ...latestRecord,
      before,
      after
    } as TransactionPayload
  }

  private materializeReplaceLatestHistoryStage(
    key: string,
    stage: ReplaceLatestHistoryStage,
    firstSyntheticIndex: number
  ): TransactionJournalEntry[] {
    if (stage.first.key !== key || stage.latest.key !== key) {
      throw new Error(
        `Factory replace-latest History stage changed gesture key: ${key}`
      )
    }
    if (stage.first.events.length !== stage.latest.events.length) {
      throw new Error(
        `Factory replace-latest History stage changed bundle size: ${key}`
      )
    }

    const entries: TransactionJournalEntry[] = []
    stage.first.events.forEach((firstEvent, candidateIndex) => {
      const latestEvent = stage.latest.events[candidateIndex]
      if (
        !latestEvent ||
        firstEvent.eventName !== latestEvent.eventName ||
        firstEvent.options?.history?.mode !== 'replace-latest' ||
        firstEvent.options.history.key !== key ||
        latestEvent.options?.history?.mode !== 'replace-latest' ||
        latestEvent.options.history.key !== key
      ) {
        throw new Error(
          `Factory replace-latest History candidate ${candidateIndex} does not preserve its event contract`
        )
      }
      const payload = this.mergeReplaceLatestHistoryPayload(
        firstEvent.payload,
        latestEvent.payload,
        candidateIndex
      )
      if (!payload) return

      const { history: _history, ...options } = latestEvent.options
      entries.push(
        this.createJournalEntry(
          {
            type: latestEvent.type,
            eventName: latestEvent.eventName,
            payload,
            options,
            canonicalEvidence: latestEvent.canonicalEvidence
          },
          false,
          firstSyntheticIndex + entries.length,
          'action'
        )
      )
    })
    return entries
  }

  private prepareReplaceLatestHistorySourceBatches(
    entries: readonly TransactionJournalEntry[]
  ): void {
    const sharedEntries = entries.filter((entry) => entry.shared)
    if (sharedEntries.length === 0) return
    const unsupportedEntry = sharedEntries.find(
      (entry) => entry.options.sharedDelivery !== 'immediate'
    )
    if (unsupportedEntry) {
      throw new Error(
        'Factory replace-latest shared History requires immediate delivery'
      )
    }

    const currentBatchCount = this.currentSharedDeliveryBatches.length
    const batches = this.prepareSharedDeliveryBatches(sharedEntries)
    this.currentSharedDeliveryBatches.splice(currentBatchCount)
    batches.forEach((batch) =>
      this.preparedSharedBatchRecords.delete(batch.batchId)
    )
    this.sharedRecordRefs(sharedEntries).forEach(({ record }) => {
      record.delivered = true
    })
  }

  private prepareCommittedActionHistoryEntries(): readonly TransactionJournalEntry[] {
    if (this.replaceLatestHistoryStages.size === 0) {
      return this.journal
    }

    const entries: TransactionJournalEntry[] = []
    const emittedKeys = new Set<string>()
    const syntheticEntries: TransactionJournalEntry[] = []
    let nextSyntheticIndex = this.journal.length
    this.journal.forEach((entry) => {
      const history = entry.options.history
      if (history?.mode !== 'replace-latest') {
        entries.push(entry)
        return
      }
      if (emittedKeys.has(history.key)) return

      const stage = this.replaceLatestHistoryStages.get(history.key)
      if (!stage) {
        throw new Error(
          `Factory replace-latest History stage is missing: ${history.key}`
        )
      }
      emittedKeys.add(history.key)
      const materialized = this.materializeReplaceLatestHistoryStage(
        history.key,
        stage,
        nextSyntheticIndex
      )
      nextSyntheticIndex += materialized.length
      entries.push(...materialized)
      syntheticEntries.push(...materialized)
    })
    if (emittedKeys.size !== this.replaceLatestHistoryStages.size) {
      throw new Error(
        'Factory replace-latest History stage has no canonical journal entry'
      )
    }
    this.prepareReplaceLatestHistorySourceBatches(syntheticEntries)
    return entries
  }

  private prepareEntryInverses(entry: TransactionJournalEntry): void {
    const trustedBuiltInReplayValues =
      entry.trustedOwnerValues && !this.inverters.has(entry.event.type)
    if (!entry.inverseEvents) {
      entry.inverseEvents = freezeReplayEvents(
        entry.options.rollbackable || entry.options.undoable
          ? this.createReplayEvents(
              entry.event,
              'inverse',
              'factory-owned-journal'
            )
          : [],
        trustedBuiltInReplayValues
      )
    }
    if (entry.shared && !entry.shared.inverseEvents) {
      const sharedPayloadOptions = toDefinedMutationOptions(
        entry.shared.change.options
      )
      const sharedInverseEvents =
        entry.options.rollbackable || entry.options.undoable
          ? (entry.inverseEvents ?? []).map((inverseEvent) => {
              const inversePayload = (
                inverseEvent as AllEvent & {
                  payload: TransactionPayload
                }
              ).payload
              const { options: _canonicalOptions, ...payloadWithoutOptions } =
                inversePayload
              const payload = {
                ...payloadWithoutOptions,
                ...(sharedPayloadOptions
                  ? { options: sharedPayloadOptions }
                  : {})
              } as TransactionPayload
              return {
                type: inverseEvent.type,
                payload: entry.trustedOwnerValues
                  ? freezeTrustedTransactionPayload(payload)
                  : deepFreezeValue(payload)
              } as AllEvent
            })
          : []
      entry.shared.inverseEvents = freezeReplayEvents(
        sharedInverseEvents,
        entry.trustedOwnerValues
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
            const recordInverseEvents =
              record.change === entry.shared?.change
                ? entry.shared.inverseEvents
                : this.projectFrameworkRecordInverseEvents(entry, record)
            if (recordInverseEvents) {
              record.inverseEvents = recordInverseEvents
            } else {
              const recordEvent = (
                trustedBuiltInReplayValues
                  ? freezeTrustedValue
                  : deepFreezeValue
              )({
                type: entry.event.type,
                payload: record.change
              } as AllEvent)
              record.inverseEvents = freezeReplayEvents(
                entry.options.rollbackable || entry.options.undoable
                  ? this.createReplayEvents(
                      recordEvent,
                      'inverse',
                      'factory-owned-journal'
                    )
                  : [],
                trustedBuiltInReplayValues
              )
            }
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

  private projectFrameworkRecordInverseEvents(
    entry: TransactionJournalEntry,
    record: JournalSharedRecord
  ): readonly AllEvent[] | undefined {
    if (
      this.inverters.has(entry.event.type) ||
      (!entry.options.rollbackable && !entry.options.undoable)
    ) {
      return
    }
    const sharedInverseEvents = entry.shared?.inverseEvents
    if (sharedInverseEvents?.length !== 1) return
    const inverseEvent = sharedInverseEvents[0]
    if (!inverseEvent) return
    const inversePayload = (
      inverseEvent as AllEvent & { payload: Record<string, unknown> }
    ).payload
    const recordPayload = record.change as unknown as Record<string, unknown>

    let projectedCollection:
      | { key: string; value: readonly unknown[] }
      | undefined
    if (
      Array.isArray(inversePayload.entries) &&
      Array.isArray(recordPayload.entries)
    ) {
      projectedCollection = { key: 'entries', value: recordPayload.entries }
    } else if (
      Array.isArray(inversePayload.data) &&
      Array.isArray(recordPayload.data)
    ) {
      projectedCollection = { key: 'data', value: recordPayload.data }
    } else if (
      Array.isArray(inversePayload.changes) &&
      Array.isArray(recordPayload.changes)
    ) {
      projectedCollection = {
        key: 'changes',
        value: [...recordPayload.changes].reverse().map((change) => {
          if (
            !isPlainRecord(change) ||
            !('before' in change) ||
            !('after' in change)
          ) {
            throw new Error(
              `Transaction event ${entry.event.type} has an invalid record change`
            )
          }
          return {
            ...change,
            before: change.after,
            after: change.before
          }
        })
      }
    } else if (
      Array.isArray(inversePayload.moves) &&
      Array.isArray(recordPayload.moves)
    ) {
      projectedCollection = {
        key: 'moves',
        value: recordPayload.moves.map((move) => {
          if (
            !isPlainRecord(move) ||
            !('before' in move) ||
            !('after' in move)
          ) {
            throw new Error(
              `Transaction event ${entry.event.type} has an invalid record move`
            )
          }
          return {
            ...move,
            before: move.after,
            after: move.before
          }
        })
      }
    }
    if (!projectedCollection) return

    return freezeReplayEvents(
      [
        {
          ...inverseEvent,
          payload: {
            ...inversePayload,
            [projectedCollection.key]: projectedCollection.value
          }
        } as AllEvent
      ],
      entry.trustedOwnerValues
    )
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

  private compensationDeliveryId(
    entry: TransactionJournalEntry,
    record: JournalSharedRecord,
    compensationIndex: number
  ): string {
    const deliveryPrefix =
      record.occurrence === 0
        ? `${this.currentTransactionId}:${entry.index}`
        : `${this.currentTransactionId}:${entry.index}:record:${record.occurrence}`
    return `${deliveryPrefix}:compensation:${compensationIndex}`
  }

  private nextDeliveryBatchId(): string {
    this.deliveryBatchSequence += 1
    return `${this.currentArtifactId}:batch:${this.deliveryBatchSequence}`
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
      sharedDelivery: entry.options.sharedDelivery,
      compensationDeliveryIds: deepFreezeValue(
        evidence.inverseEvents.map((_event, compensationIndex) =>
          this.compensationDeliveryId(entry, record, compensationIndex)
        )
      )
    })
  }

  private configureActiveDeliverySequence(
    sequence: FactoryMutationDeliverySequence
  ): void {
    if (
      this.currentSharedDeliveryBatches.some(
        (batch) => batch.sharedDelivery !== 'immediate'
      )
    ) {
      throw new Error(
        'Factory mutation delivery sequence must be configured before shared delivery'
      )
    }
    const detachedSequence = cloneAndDeepFreezeValue(sequence)
    const sliceIds = new Set<string>()
    const orderedIds = new Set<string>()
    const sliceByOrderedId = new Map<string, string>()
    const sliceOrder = new Map<string, number>()
    const boundaryBySliceId = new Map<
      string,
      FactoryMutationDeliverySequence['slices'][number]
    >()
    const orderedIdOrder = new Map<string, number>()
    let orderedIdIndex = 0
    detachedSequence.slices.forEach((slice, sliceIndex) => {
      if (!slice.sliceId || sliceIds.has(slice.sliceId)) {
        throw new Error(
          `Factory mutation delivery sequence has an invalid slice at index ${sliceIndex}`
        )
      }
      sliceIds.add(slice.sliceId)
      sliceOrder.set(slice.sliceId, sliceIndex)
      boundaryBySliceId.set(slice.sliceId, slice)
      slice.orderedIds.forEach((orderedId) => {
        if (!orderedId || orderedIds.has(orderedId)) {
          throw new Error(
            `Factory mutation delivery sequence has a duplicate ordered id: ${orderedId}`
          )
        }
        orderedIds.add(orderedId)
        sliceByOrderedId.set(orderedId, slice.sliceId)
        orderedIdOrder.set(orderedId, orderedIdIndex)
        orderedIdIndex += 1
      })
    })
    if (
      detachedSequence.mode === 'progressive' &&
      detachedSequence.slices.length === 0
    ) {
      throw new Error(
        'Progressive Factory mutation delivery sequence requires at least one slice'
      )
    }
    if (
      detachedSequence.mode === 'atomic' &&
      detachedSequence.slices.length > 1
    ) {
      throw new Error(
        'Atomic Factory mutation delivery sequence accepts at most one slice'
      )
    }
    if (
      detachedSequence.batchPublications !== undefined &&
      typeof detachedSequence.batchPublications !== 'boolean'
    ) {
      throw new Error(
        'Factory mutation delivery sequence batchPublications must be boolean'
      )
    }
    const alreadyDeliveredImmediateOrderedId = this.currentSharedDeliveryBatches
      .filter((batch) => batch.sharedDelivery === 'immediate')
      .flatMap((batch) => batch.records)
      .flatMap((record) => record.orderedIds)
      .find((orderedId) => orderedIds.has(orderedId))
    if (alreadyDeliveredImmediateOrderedId) {
      throw new Error(
        `Factory mutation delivery sequence cannot include an already delivered immediate ordered id: ${alreadyDeliveredImmediateOrderedId}`
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
    this.activeDeliverySequence = detachedSequence
    this.activeDeliverySequenceValidated = false
  }

  private sharedRecordRefs(
    entries: readonly TransactionJournalEntry[]
  ): JournalSharedRecordRef[] {
    return entries.flatMap((entry) =>
      (entry.shared?.records ?? []).map((record) => ({ entry, record }))
    )
  }

  private validateActiveDeliverySequenceCoverage(
    entries: readonly TransactionJournalEntry[]
  ): void {
    if (
      this.activeDeliverySequenceValidated ||
      this.activeDeliverySequence?.mode !== 'progressive'
    ) {
      return
    }
    const seenAssignedOrderedIds = new Set<string>()
    entries.forEach((entry) => {
      let previousOrderedIdIndex = -1
      entry.orderedIds.forEach((orderedId) => {
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
        'Factory mutation delivery sequence must cover every canonical id exactly once'
      )
    }
    this.activeDeliverySequenceValidated = true
  }

  private orderSharedRecordsByActiveSlice(
    records: readonly JournalSharedRecordRef[]
  ): JournalSharedRecordRef[] {
    if (this.activeDeliverySequence?.mode !== 'progressive') {
      return [...records]
    }
    const recordsBySlice = new Map<string, JournalSharedRecordRef[]>()
    this.activeDeliverySequence.slices.forEach(({ sliceId }) =>
      recordsBySlice.set(sliceId, [])
    )
    records.forEach((recordRef) => {
      const sliceId = this.deliverySliceIdForRecord(recordRef)
      const sliceRecords = sliceId ? recordsBySlice.get(sliceId) : undefined
      if (!sliceId || !sliceRecords) {
        throw new Error(
          `Factory mutation shared record ${this.sharedRecordId(recordRef.entry, recordRef.record)} is not assigned to a progressive delivery slice`
        )
      }
      sliceRecords.push(recordRef)
    })
    return this.activeDeliverySequence.slices.flatMap(
      ({ sliceId }) => recordsBySlice.get(sliceId) ?? []
    )
  }

  private deliverySliceIdForRecord({
    entry,
    record
  }: JournalSharedRecordRef): string | undefined {
    if (entry.options.sharedDelivery === 'immediate') return
    if (this.activeDeliverySequence?.mode === 'atomic') {
      return this.activeDeliverySequence.slices[0]?.sliceId
    }
    if (this.activeDeliverySequence?.mode !== 'progressive') return
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
    orderedRecords?: readonly JournalSharedRecordRef[],
    deliverySliceIdOverride?: string
  ): SharedDeliveryBatch[] {
    const records = orderedRecords ?? this.sharedRecordRefs(entries)
    const preparedBatches: SharedDeliveryBatch[] = []
    const seenBatchIds = new Set<string>()
    const deliverySliceIds = new Map<JournalSharedRecord, string>()
    records.forEach((recordRef) => {
      const sliceId =
        recordRef.record.batch?.sliceId ??
        deliverySliceIdOverride ??
        this.deliverySliceIdForRecord(recordRef)
      if (!sliceId) return
      if (
        this.activeDeliverySequence &&
        recordRef.entry.options.sharedDelivery !== 'immediate' &&
        !this.activeDeliverySliceOrder.has(sliceId)
      ) {
        throw new Error(
          `Factory mutation delivery slice is unknown: ${sliceId}`
        )
      }
      deliverySliceIds.set(recordRef.record, sliceId)
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
      const deliverySliceId = deliverySliceIds.get(first.record)
      cursor += 1
      while (cursor < records.length) {
        const candidate = records[cursor]
        const candidateShared = candidate?.entry.shared
        if (
          !candidate ||
          !candidateShared ||
          candidate.record.batch ||
          candidateShared.name !== shared.name ||
          candidate.entry.options.sharedDelivery !==
            first.entry.options.sharedDelivery ||
          deliverySliceIds.get(candidate.record) !== deliverySliceId
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
        sliceId: deliverySliceId ?? batchId,
        artifactId: this.currentArtifactId,
        transactionId: this.currentTransactionId,
        origin: this.transactionOrigin(),
        kind: 'forward',
        channel: shared.name,
        sharedDelivery: first.entry.options.sharedDelivery,
        deliveries,
        records: deepFreezeValue(deliveries.map((delivery) => delivery.record)),
        changes: deepFreezeValue(
          deliveries.map((delivery) => delivery.payload)
        ),
        compensationBatchId: `${batchId}:compensation`
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
    const historyReplayState =
      this.historyReplaySharedState?.batchStateById.get(batch.batchId)
    if (historyReplayState) {
      if (historyReplayState.delivered) return true
      if (
        historyReplayState.readyReadinessKeys.size !==
        historyReplayState.requiredReadinessKeys.size
      ) {
        return false
      }
      this.sharedEvidenceNotificationDepth += 1
      try {
        const delivered = pushFactoryOwnedBatchToSharedChannel(
          this.sharedDataChannelRegistry,
          batch.channel,
          batch.changes
        )
        if (!delivered) return false

        historyReplayState.delivered = true
        if (this.transactionOrigin() !== 'remote') {
          this.onSharedDeliveryBatch?.(batch)
        }
        return true
      } finally {
        this.sharedEvidenceNotificationDepth -= 1
      }
    }

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
      }
      return true
    } finally {
      this.sharedEvidenceNotificationDepth -= 1
    }
  }

  private deliverSharedEntries(
    entries: readonly TransactionJournalEntry[],
    deliverySliceIdOverride?: string
  ): void {
    this.prepareSharedDeliveryBatches(
      entries,
      undefined,
      deliverySliceIdOverride
    ).forEach((batch) => this.deliverPreparedSharedBatch(batch))
  }

  private prepareTransactionEndDeliveryIndex(): readonly SharedDeliveryBatch[] {
    if (this.transactionEndDeliveryBatches) {
      return this.transactionEndDeliveryBatches
    }
    return measureBrowserDragPhase(
      'factory:index-shared-delivery-records',
      () => {
        if (this.historyReplaySharedState?.batchStates.length) {
          const batches = this.historyReplaySharedState.batchStates
            .filter(({ batch }) => batch.sharedDelivery === 'transaction-end')
            .map(({ batch }) => batch)
          const unreadyBatch = batches.find((batch) => {
            const state = this.historyReplaySharedState?.batchStateById.get(
              batch.batchId
            )
            return (
              !state ||
              state.readyReadinessKeys.size !== state.requiredReadinessKeys.size
            )
          })
          if (unreadyBatch) {
            throw new Error(
              `Factory history replay batch is not ready: ${unreadyBatch.batchId}`
            )
          }
          const batchesBySlice = new Map<string, SharedDeliveryBatch[]>()
          batches.forEach((batch) => {
            const sliceBatches = batchesBySlice.get(batch.sliceId) ?? []
            sliceBatches.push(batch)
            batchesBySlice.set(batch.sliceId, sliceBatches)
          })
          const immediateSliceIds = new Set(
            this.historyReplaySharedState.batchStates.flatMap(({ batch }) =>
              batch.sharedDelivery === 'immediate' ? [batch.sliceId] : []
            )
          )
          if (
            this.activeDeliverySequence?.mode === 'progressive' &&
            this.activeDeliverySequence.slices.some(
              ({ sliceId }) =>
                !batchesBySlice.has(sliceId) && !immediateSliceIds.has(sliceId)
            )
          ) {
            throw new Error(
              'Factory mutation delivery sequence contains an empty progressive slice'
            )
          }
          batchesBySlice.forEach((sliceBatches, sliceId) =>
            this.transactionEndBatchesBySlice.set(
              sliceId,
              deepFreezeValue(sliceBatches)
            )
          )
          this.transactionEndDeliveryBatches = deepFreezeValue(batches)
          return this.transactionEndDeliveryBatches
        }

        const canonicalTransactionEndEntries = this.journal.filter(
          (entry) => entry.options.sharedDelivery === 'transaction-end'
        )
        const transactionEndEntries = canonicalTransactionEndEntries.filter(
          (entry) => entry.shared !== undefined
        )
        const records = this.sharedRecordRefs(transactionEndEntries)
        this.validateActiveDeliverySequenceCoverage(
          canonicalTransactionEndEntries
        )
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
          records.length > 0 &&
          this.activeDeliverySequence?.mode === 'progressive' &&
          this.activeDeliverySequence.slices.some(
            ({ sliceId }) => !batchesBySlice.has(sliceId)
          )
        ) {
          throw new Error(
            'Factory mutation delivery sequence contains an empty progressive slice'
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

  private sharedRecordPublicationWorkItemKeys(
    records: readonly JournalSharedRecordRef[]
  ): readonly string[] {
    return records.flatMap(({ entry, record }) =>
      record.orderedIds.length > 0
        ? record.orderedIds.map((orderedId) => `ordered:${orderedId}`)
        : [
            `delivery:${
              record.delivery?.deliveryId ??
              record.evidence?.deliveryId ??
              `${entry.index}:${record.occurrence}`
            }`
          ]
    )
  }

  private sharedBatchPublicationWorkItemKeys(
    batches: readonly SharedDeliveryBatch[]
  ): readonly string[] {
    return batches.flatMap(({ deliveries }) =>
      deliveries.flatMap(({ deliveryId, record }) =>
        record.orderedIds.length > 0
          ? record.orderedIds.map((orderedId) => `ordered:${orderedId}`)
          : [`delivery:${deliveryId}`]
      )
    )
  }

  private publicationWindowWouldExceedTarget(
    pendingWorkItemKeys: ReadonlySet<string>,
    currentWorkItemKeys: readonly string[],
    maxItemsPerPublication = DEFAULT_SHARED_PUBLICATION_MAX_WORK_ITEMS
  ): boolean {
    if (pendingWorkItemKeys.size === 0) return false
    let distinctCount = pendingWorkItemKeys.size
    for (const workItemKey of currentWorkItemKeys) {
      if (!pendingWorkItemKeys.has(workItemKey)) distinctCount += 1
    }
    return distinctCount > maxItemsPerPublication
  }

  private shouldFlushPublicationWindow(
    pendingWorkItemKeys: ReadonlySet<string>,
    finalSlice: boolean,
    maxItemsPerPublication = DEFAULT_SHARED_PUBLICATION_MAX_WORK_ITEMS
  ): boolean {
    return (
      this.activeDeliverySequence?.batchPublications === false ||
      pendingWorkItemKeys.size >= maxItemsPerPublication ||
      finalSlice
    )
  }

  private flushPendingProgressivePublication(): void {
    const records = this.pendingProgressivePublicationRecords.splice(0)
    this.pendingProgressivePublicationWorkItemKeys.clear()
    if (records.length === 0) return
    this.queueSharedPublication(
      this.createSharedPublicationFromRecords(records)
    )
    this.flushSharedPublications()
  }

  private queueProgressiveSlicePublication(
    records: readonly JournalSharedRecordRef[],
    sliceOrderedIds: readonly string[],
    finalSlice: boolean
  ): void {
    const publishableRecords = records.filter(
      ({ record }) => record.delivered && record.publicationId === undefined
    )
    const workItemKeys =
      sliceOrderedIds.length > 0
        ? sliceOrderedIds.map((orderedId) => `ordered:${orderedId}`)
        : this.sharedRecordPublicationWorkItemKeys(publishableRecords)
    if (
      publishableRecords.length > 0 &&
      this.activeDeliverySequence?.batchPublications !== false &&
      this.publicationWindowWouldExceedTarget(
        this.pendingProgressivePublicationWorkItemKeys,
        workItemKeys
      )
    ) {
      this.flushPendingProgressivePublication()
    }
    this.pendingProgressivePublicationRecords.push(...publishableRecords)
    workItemKeys.forEach((workItemKey) =>
      this.pendingProgressivePublicationWorkItemKeys.add(workItemKey)
    )
    if (
      this.shouldFlushPublicationWindow(
        this.pendingProgressivePublicationWorkItemKeys,
        finalSlice
      )
    ) {
      this.flushPendingProgressivePublication()
    }
  }

  private deliverActiveSlice(sliceId: string): void {
    try {
      const sequence = this.activeDeliverySequence
      if (sequence?.mode !== 'progressive') {
        throw new Error(
          'Factory mutation delivery slice requires a progressive delivery sequence'
        )
      }
      const expectedSlice = sequence.slices[this.nextDeliverySliceIndex]
      if (!expectedSlice || expectedSlice.sliceId !== sliceId) {
        throw new Error(
          `Factory mutation delivery slice must follow sequence order: ${expectedSlice?.sliceId ?? 'complete'}`
        )
      }
      this.prepareTransactionEndDeliveryIndex()
      const batches = this.transactionEndBatchesBySlice.get(sliceId) ?? []
      if (!batches.every((batch) => this.deliverPreparedSharedBatch(batch))) {
        throw new Error(
          `Factory mutation delivery slice could not be delivered: ${sliceId}`
        )
      }
      const records = this.transactionEndRecordsBySlice.get(sliceId) ?? []
      this.queueProgressiveSlicePublication(
        records,
        expectedSlice.orderedIds,
        this.nextDeliverySliceIndex === sequence.slices.length - 1
      )
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
    origin: SharedDeliveryOrigin = this.transactionOrigin()
  ): SharedPublication | undefined {
    return this.createSharedPublicationFromRecords(
      this.sharedRecordRefs(entries),
      origin
    )
  }

  private createSharedPublicationFromRecords(
    records: readonly JournalSharedRecordRef[],
    origin: SharedDeliveryOrigin = this.transactionOrigin()
  ): SharedPublication | undefined {
    return measureBrowserDragPhase('factory:create-shared-publication', () => {
      if (this.transactionOrigin() === 'remote' || origin === 'remote') return
      const publishableRecords = records.filter(({ record }) => {
        if (!record.delivered || record.publicationId !== undefined) {
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
      const publication = this.createSharedPublicationFromBatches(
        batches,
        origin
      )
      if (!publication) return
      publishableRecords.forEach(({ record }) => {
        record.publicationId = publication.publicationId
        record.compensationPublicationId = `${publication.publicationId}:compensation`
      })
      this.publicationAcknowledgements.set(publication, () => {
        publishableRecords.forEach(({ record }) => {
          record.acknowledgedPublicationId = publication.publicationId
        })
      })
      return publication
    })
  }

  private createSharedPublicationFromBatches(
    batches: readonly SharedDeliveryBatch[],
    origin: SharedDeliveryOrigin,
    identity: {
      publicationId?: string
      compensatesPublicationId?: string
    } = {}
  ): SharedPublication | undefined {
    if (
      batches.length === 0 ||
      origin === 'remote' ||
      this.transactionOrigin() === 'remote'
    ) {
      return
    }
    const deliverySequence = this.resolveDeliverySequence(batches, {
      includeActiveSequence: origin !== 'rollback-compensation',
      modeOverride:
        origin === 'rollback-compensation' &&
        this.activeDeliverySequence?.mode === 'progressive'
          ? 'progressive'
          : undefined,
      orderedIdsFromRecords:
        origin === 'rollback-compensation' &&
        this.activeDeliverySequence?.mode === 'progressive'
    })
    const publicationBatchesBySliceId = new Map<
      string,
      SharedPublicationBatch[]
    >()
    batches.forEach((batch) => {
      const deliveries: readonly SharedPublicationDelivery[] = Object.freeze(
        batch.deliveries.map((delivery) =>
          Object.freeze({
            deliveryId: delivery.deliveryId,
            eventName: delivery.eventName,
            orderedIds: delivery.record.orderedIds,
            payload: delivery.payload,
            ...(delivery.compensatesDeliveryId
              ? { compensatesDeliveryId: delivery.compensatesDeliveryId }
              : {})
          })
        )
      )
      const publicationBatch: SharedPublicationBatch = Object.freeze({
        batchId: batch.batchId,
        channel: batch.channel,
        deliveries
      })
      const sliceBatches = publicationBatchesBySliceId.get(batch.sliceId) ?? []
      sliceBatches.push(publicationBatch)
      publicationBatchesBySliceId.set(batch.sliceId, sliceBatches)
    })
    const slices: readonly SharedPublicationSlice[] = Object.freeze(
      deliverySequence.slices.map((slice) =>
        Object.freeze({
          sliceId: slice.sliceId,
          orderedIds: slice.orderedIds,
          batches: Object.freeze([
            ...(publicationBatchesBySliceId.get(slice.sliceId) ?? [])
          ])
        })
      )
    )
    const publicationId = identity.publicationId ?? this.nextPublicationId()
    return Object.freeze({
      publicationId,
      artifactId: this.currentArtifactId,
      transactionId: this.currentTransactionId,
      origin,
      mode: deliverySequence.mode,
      slices,
      ...(identity.compensatesPublicationId
        ? { compensatesPublicationId: identity.compensatesPublicationId }
        : {})
    })
  }

  private createHistoryReplaySharedPublication(
    batches: readonly SharedDeliveryBatch[]
  ): SharedPublication | undefined {
    const state = this.historyReplaySharedState
    if (!state) return
    const publishableBatches = batches.filter((batch) => {
      const batchState = state.batchStateById.get(batch.batchId)
      return (
        batchState?.delivered === true && batchState.publicationId === undefined
      )
    })
    const publication = this.createSharedPublicationFromBatches(
      publishableBatches,
      this.transactionOrigin()
    )
    if (!publication) return
    publishableBatches.forEach((batch) => {
      const batchState = state.batchStateById.get(batch.batchId)
      if (!batchState) return
      batchState.publicationId = publication.publicationId
      batchState.compensationPublicationId = `${publication.publicationId}:compensation`
    })
    this.publicationAcknowledgements.set(publication, () => {
      publishableBatches.forEach((batch) => {
        const batchState = state.batchStateById.get(batch.batchId)
        if (batchState) {
          batchState.acknowledgedPublicationId = publication.publicationId
        }
      })
    })
    return publication
  }

  private queueAcknowledgedCompensationPublications(
    items: readonly {
      batch: SharedDeliveryBatch
      publicationId: string
      compensatesPublicationId: string
    }[]
  ): void {
    const groups = new Map<
      string,
      {
        compensatesPublicationId: string
        batches: SharedDeliveryBatch[]
      }
    >()
    items.forEach(({ batch, publicationId, compensatesPublicationId }) => {
      const group = groups.get(publicationId)
      if (group) {
        group.batches.push(batch)
        return
      }
      groups.set(publicationId, {
        compensatesPublicationId,
        batches: [batch]
      })
    })
    groups.forEach(({ batches, compensatesPublicationId }, publicationId) => {
      this.queueSharedPublication(
        this.createSharedPublicationFromBatches(
          batches,
          'rollback-compensation',
          {
            publicationId,
            compensatesPublicationId
          }
        )
      )
    })
  }

  private resolveDeliverySequence(
    batches: readonly SharedDeliveryBatch[] = this.currentSharedDeliveryBatches,
    options: {
      includeActiveSequence?: boolean
      modeOverride?: FactoryMutationDeliverySequence['mode']
      orderedIdsFromRecords?: boolean
    } = {}
  ): FactoryMutationDeliverySequence {
    const activeSequenceBatches = batches.filter(
      (batch) => batch.sharedDelivery === 'transaction-end'
    )
    if (
      this.activeDeliverySequence &&
      this.activeDeliverySequence.slices.length > 0 &&
      options.includeActiveSequence !== false &&
      (batches.length === 0 || activeSequenceBatches.length > 0)
    ) {
      if (batches.length === 0) return this.activeDeliverySequence
      return measureBrowserDragPhase(
        'factory:select-delivery-sequence-boundaries',
        () => {
          const seenSliceIds = new Set<string>()
          const slices: FactoryMutationDeliverySequence['slices'][number][] = []
          activeSequenceBatches.forEach((batch) => {
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
            mode: this.activeDeliverySequence?.mode ?? 'atomic',
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

  private resolveCommittedHistoryDeliverySequence():
    | FactoryMutationDeliverySequence
    | undefined {
    if (this.activeDeliverySequence?.mode === 'progressive') {
      return this.activeDeliverySequence
    }
    if (this.activeDeliverySequence?.batchPublications !== false) return

    const deliveryIdsBySlice = new Map<string, string[]>()
    this.currentSharedDeliveryBatches.forEach((batch) => {
      const deliveryIds = deliveryIdsBySlice.get(batch.sliceId) ?? []
      deliveryIds.push(
        ...batch.deliveries.map((delivery) => delivery.deliveryId)
      )
      deliveryIdsBySlice.set(batch.sliceId, deliveryIds)
    })
    if (deliveryIdsBySlice.size === 0) return

    return deepFreezeValue({
      mode: 'progressive',
      batchPublications: false,
      slices: [...deliveryIdsBySlice].map(([sliceId, orderedIds]) => ({
        sliceId,
        orderedIds
      }))
    })
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
    if (entries.length === 0) return
    const records = this.sharedRecordRefs(entries).filter(
      ({ record }) => record.delivered && record.publicationId === undefined
    )
    const workItemKeys = this.sharedRecordPublicationWorkItemKeys(records)
    if (
      records.length > 0 &&
      this.activeDeliverySequence?.mode !== 'atomic' &&
      this.publicationWindowWouldExceedTarget(
        this.pendingImmediatePublicationWorkItemKeys,
        workItemKeys
      )
    ) {
      this.flushPendingImmediatePublication()
    }
    this.pendingImmediatePublicationRecords.push(...records)
    workItemKeys.forEach((workItemKey) =>
      this.pendingImmediatePublicationWorkItemKeys.add(workItemKey)
    )
    if (
      this.activeDeliverySequence?.batchPublications === false ||
      (this.activeDeliverySequence?.mode !== 'atomic' &&
        this.pendingImmediatePublicationWorkItemKeys.size >=
          DEFAULT_SHARED_PUBLICATION_MAX_WORK_ITEMS)
    ) {
      this.flushPendingImmediatePublication()
    }
  }

  private flushPendingImmediatePublication(): void {
    const records = this.pendingImmediatePublicationRecords.splice(0)
    this.pendingImmediatePublicationWorkItemKeys.clear()
    if (records.length === 0) return
    this.queueSharedPublication(
      this.createSharedPublicationFromRecords(records)
    )
    this.flushSharedPublications()
  }

  private discardPendingImmediatePublication(): void {
    this.scheduledImmediatePublicationToken = null
    this.immediatePublicationToken += 1
    this.pendingImmediatePublicationEntries.length = 0
    this.pendingImmediatePublicationRecords.length = 0
    this.pendingImmediatePublicationWorkItemKeys.clear()
  }

  private queueSharedPublication(
    publication: SharedPublication | undefined
  ): void {
    if (!publication) return
    this.pendingSharedPublications.push(publication)
  }

  private queueUnacknowledgedSharedPublications(): void {
    this.unacknowledgedSharedPublications.forEach((publication) => {
      if (!this.pendingSharedPublications.includes(publication)) {
        this.pendingSharedPublications.push(publication)
      }
    })
  }

  private removeUnacknowledgedSharedPublication(
    publication: SharedPublication
  ): void {
    const index = this.unacknowledgedSharedPublications.indexOf(publication)
    if (index >= 0) {
      this.unacknowledgedSharedPublications.splice(index, 1)
    }
  }

  private flushSharedPublications(): void {
    if (this.emittingSharedPublications) return
    this.emittingSharedPublications = true
    try {
      let publication: SharedPublication | undefined
      while ((publication = this.pendingSharedPublications.shift())) {
        this.sharedEvidenceNotificationDepth += 1
        let acknowledged = false
        try {
          const handoff = this.onSharedPublication?.(publication)
          if (this.onSharedPublication !== undefined && handoff !== false) {
            this.publicationAcknowledgements.get(publication)?.()
            acknowledged = true
            this.removeUnacknowledgedSharedPublication(publication)
          } else if (
            !this.unacknowledgedSharedPublications.includes(publication)
          ) {
            this.unacknowledgedSharedPublications.push(publication)
          }
        } finally {
          if (acknowledged) {
            this.publicationAcknowledgements.delete(publication)
          }
          this.sharedEvidenceNotificationDepth -= 1
        }
      }
    } finally {
      this.emittingSharedPublications = false
    }
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
    const forwardDelivery = record.delivery
    const deliveryId =
      forwardDelivery?.compensationDeliveryIds?.[compensationIndex] ??
      this.compensationDeliveryId(entry, record, compensationIndex)
    return deepFreezeValue({
      deliveryId,
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

  private applyReplayEventBatch(
    events: readonly AllEvent[],
    mode: TransactionReplayMode
  ): boolean {
    const previousApplyingReplayEvent = this.applyingReplayEvent
    this.applyingReplayEvent = true
    try {
      return runInTransactionReplayMode(mode, () => {
        applyEventBatchToSynchronousOwners(events)
        publishEventsToObservers(events)
        return isTransactionReplayApplied()
      })
    } finally {
      this.applyingReplayEvent = previousApplyingReplayEvent
    }
  }

  private replayStepSourceSliceId(
    step: PreparedReplayStep
  ): string | undefined {
    if (!step.shared || 'suppress' in step.shared) return
    const sliceIds = new Set<string>()
    step.shared.records.forEach(({ readinessKey }) => {
      const states =
        this.historyReplaySharedState?.batchStatesByReadinessKey.get(
          readinessKey
        ) ?? []
      states.forEach(({ batch }) => sliceIds.add(batch.sliceId))
    })
    return sliceIds.size === 1 ? [...sliceIds][0] : undefined
  }

  private *replaySteps(
    events: readonly AllEvent[],
    direction: 'forward' | 'inverse',
    mode: TransactionReplayMode,
    maxItemsPerSlice: number,
    restorationBatches?: AllEvent[][],
    sharedReplay?: readonly (HistorySharedReplayOutputs | undefined)[],
    preparedReplayEvents?: readonly (readonly AllEvent[] | undefined)[]
  ): Generator<void, unknown[], undefined> {
    const failures: unknown[] = []
    const pendingSliceWorkItemKeys = new Set<string>()
    let hasPendingSlicePublication = false
    const entries = events.map((event, index) => ({
      event,
      shared: sharedReplay?.[index],
      preparedReplayEvents: preparedReplayEvents?.[index]
    }))
    const orderedEntries = direction === 'inverse' ? entries.reverse() : entries
    const preparedSteps: PreparedReplayStep[] = []

    for (const {
      event,
      shared: sharedOutputs,
      preparedReplayEvents
    } of orderedEntries) {
      let replayEvents: AllEvent[]
      try {
        replayEvents = preparedReplayEvents
          ? preparedReplayEvents.map(cloneEvent)
          : this.createReplayEvents(event, direction)
      } catch (error) {
        failures.push(error)
        continue
      }

      for (
        let replayOutputIndex = 0;
        replayOutputIndex < replayEvents.length;
        replayOutputIndex += 1
      ) {
        const replayEvent = replayEvents[replayOutputIndex]
        if (!replayEvent) continue
        const shared = sharedOutputs?.[replayOutputIndex]
        let restorationEvents: AllEvent[] | undefined
        const mustValidateReplayOutput =
          restorationBatches !== undefined ||
          (direction === 'inverse' && this.inverters.has(event.type))
        const replayPayload = (replayEvent as AllEvent & { payload?: unknown })
          .payload
        if (
          mustValidateReplayOutput &&
          !this.hasInverseContract(replayEvent.type, replayPayload)
        ) {
          failures.push(
            new Error(
              `Replay output ${replayEvent.type} requires an inverse contract`
            )
          )
          continue
        }
        if (restorationBatches || this.inverters.has(replayEvent.type)) {
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
            if (restorationBatches) {
              restorationEvents = inverseOutputEvents
            }
          } catch (error) {
            failures.push(error)
            continue
          }
        }

        preparedSteps.push({
          replayEvent,
          restorationEvents,
          shared
        })
      }
    }

    for (let stepIndex = 0; stepIndex < preparedSteps.length; stepIndex += 1) {
      const firstStep = preparedSteps[stepIndex]
      if (!firstStep) continue
      const firstEventType = firstStep.replayEvent.type
      const firstSourceSliceId = this.replayStepSourceSliceId(firstStep)
      const mayUseOwnerBatch =
        hasSynchronousEventBatchHandler(firstEventType) &&
        (this.canReplayEventBatch?.(firstEventType) ??
          this.onReplayEvent === undefined)
      const ownerBatch = [firstStep]
      if (mayUseOwnerBatch) {
        while (ownerBatch.length < MAX_CANONICAL_REPLAY_OWNER_BATCH_ITEMS) {
          const candidate = preparedSteps[stepIndex + ownerBatch.length]
          if (
            !candidate ||
            candidate.replayEvent.type !== firstEventType ||
            this.replayStepSourceSliceId(candidate) !== firstSourceSliceId
          ) {
            break
          }
          ownerBatch.push(candidate)
        }
      }
      const appliedSteps =
        mayUseOwnerBatch && ownerBatch.length > 1 ? ownerBatch : [firstStep]
      const journalStart = this.journal.length
      const previousRetainingHistoryReplaySharedEvidence =
        this.retainingHistoryReplaySharedEvidence
      const isRetainedHistoryReplay =
        this.historyReplaySharedState?.ownsReplayEvidence === true
      this.retainingHistoryReplaySharedEvidence = isRetainedHistoryReplay
      try {
        const applied =
          appliedSteps.length > 1
            ? this.applyReplayEventBatch(
                appliedSteps.map(({ replayEvent }) => replayEvent),
                mode
              )
            : this.applyReplayEvent(firstStep.replayEvent, mode)
        const recordedEntries = this.journal.slice(journalStart)
        if (isRetainedHistoryReplay) {
          this.suppressHistoryReplayOwnerSharedEntries(recordedEntries)
        }
        if (applied) {
          appliedSteps.forEach(({ restorationEvents }) => {
            if (restorationEvents) {
              restorationBatches?.push(restorationEvents)
            }
          })
          if (isRetainedHistoryReplay) {
            appliedSteps.forEach(({ shared }) => {
              if (shared && !('suppress' in shared)) {
                this.markHistoryReplaySharedReady(shared)
              }
            })
            let settlement =
              this.flushNextReadyHistoryReplaySlice(maxItemsPerSlice)
            while (settlement !== 'none') {
              hasPendingSlicePublication = true
              settlement.workItemKeys.forEach((workItemKey) =>
                pendingSliceWorkItemKeys.add(workItemKey)
              )
              if (
                settlement.explicitBoundary ||
                pendingSliceWorkItemKeys.size >= maxItemsPerSlice
              ) {
                hasPendingSlicePublication = false
                pendingSliceWorkItemKeys.clear()
                yield
              }
              settlement =
                this.flushNextReadyHistoryReplaySlice(maxItemsPerSlice)
            }
          }
        }
      } catch (error) {
        if (isRetainedHistoryReplay) {
          this.suppressHistoryReplayOwnerSharedEntries(
            this.journal.slice(journalStart)
          )
        }
        if (wasTransactionReplayApplied(error)) {
          appliedSteps.forEach(({ restorationEvents }) => {
            if (restorationEvents) {
              restorationBatches?.push(restorationEvents)
            }
          })
        }
        failures.push(error)
      } finally {
        this.retainingHistoryReplaySharedEvidence =
          previousRetainingHistoryReplaySharedEvidence
      }
      stepIndex += appliedSteps.length - 1
    }

    if (hasPendingSlicePublication) {
      yield
    }
    return failures
  }

  private replay(
    events: readonly AllEvent[],
    direction: 'forward' | 'inverse',
    mode: TransactionReplayMode,
    restorationBatches?: AllEvent[][],
    sharedReplay?: readonly (HistorySharedReplayOutputs | undefined)[],
    preparedReplayEvents?: readonly (readonly AllEvent[] | undefined)[]
  ): unknown[] {
    const steps = this.replaySteps(
      events,
      direction,
      mode,
      Number.MAX_SAFE_INTEGER,
      restorationBatches,
      sharedReplay,
      preparedReplayEvents
    )
    let step = steps.next()
    while (!step.done) {
      step = steps.next()
    }
    return step.value
  }

  private async replayProgressively(
    events: readonly AllEvent[],
    direction: 'forward' | 'inverse',
    mode: TransactionReplayMode,
    yieldAfterSlice: () => Promise<void>,
    maxItemsPerSlice: number,
    restorationBatches?: AllEvent[][],
    sharedReplay?: readonly (HistorySharedReplayOutputs | undefined)[],
    preparedReplayEvents?: readonly (readonly AllEvent[] | undefined)[]
  ): Promise<unknown[]> {
    const steps = this.replaySteps(
      events,
      direction,
      mode,
      maxItemsPerSlice,
      restorationBatches,
      sharedReplay,
      preparedReplayEvents
    )
    let step = steps.next()
    try {
      while (!step.done) {
        await yieldAfterSlice()
        step = steps.next()
      }
      return step.value
    } catch (error) {
      steps.return([])
      throw error
    }
  }

  private restoreNestedReplay(): unknown[] {
    const failures: unknown[] = []
    ;[...this.nestedReplayRestorationBatches]
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
    source?: TransactionJournalEntry['source']
  ): unknown[] {
    const failures: unknown[] = []
    const rollbackableEntries = this.journal.filter(
      (entry) =>
        entry.options.rollbackable &&
        (source === undefined || entry.source === source)
    )
    const preparedEntries = rollbackableEntries.filter((entry) => {
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
        preparedEntries.map((entry) => entry.inverseEvents)
      )
    ]
  }

  private compensateDeliveredHistoryReplayBatches(): unknown[] {
    const sharedState = this.historyReplaySharedState
    if (!sharedState) return []
    const failures: unknown[] = []
    const acknowledgedCompensationBatches: {
      batch: SharedDeliveryBatch
      publicationId: string
      compensatesPublicationId: string
    }[] = []

    ;[...sharedState.batchStates]
      .reverse()
      .filter(({ delivered }) => delivered)
      .forEach((state) => {
        const forwardBatch = state.batch
        try {
          const batchId =
            forwardBatch.compensationBatchId ??
            `${forwardBatch.batchId}:compensation`
          const inverseRecords = [...forwardBatch.deliveries]
            .reverse()
            .flatMap((forwardDelivery) =>
              forwardDelivery.record.inverseEvents.map(
                (inverseEvent, inverseIndex) => ({
                  forwardDelivery,
                  inverseEvent,
                  inverseIndex,
                  payload: (
                    inverseEvent as AllEvent & {
                      payload: TransactionPayload
                    }
                  ).payload
                })
              )
            )
          const deliveries = deepFreezeValue(
            inverseRecords.map(
              ({ forwardDelivery, inverseEvent, inverseIndex, payload }) =>
                deepFreezeValue({
                  deliveryId:
                    forwardDelivery.compensationDeliveryIds?.[inverseIndex] ??
                    `${forwardDelivery.deliveryId}:compensation:${inverseIndex}`,
                  artifactId: this.currentArtifactId,
                  batchId,
                  transactionId: this.currentTransactionId,
                  origin: 'rollback-compensation' as const,
                  kind: 'compensation' as const,
                  channel: forwardBatch.channel,
                  eventName: inverseEvent.type,
                  payload,
                  recordId: forwardDelivery.recordId,
                  record: forwardDelivery.record,
                  sharedDelivery: forwardBatch.sharedDelivery,
                  compensatesDeliveryId: forwardDelivery.deliveryId
                })
            )
          )
          const compensationBatch = deepFreezeValue({
            batchId,
            sliceId: `${forwardBatch.sliceId}:compensation`,
            artifactId: this.currentArtifactId,
            transactionId: this.currentTransactionId,
            origin: 'rollback-compensation' as const,
            kind: 'compensation' as const,
            channel: forwardBatch.channel,
            sharedDelivery: forwardBatch.sharedDelivery,
            deliveries,
            records: deepFreezeValue(
              inverseRecords.map(
                ({ forwardDelivery }) => forwardDelivery.record
              )
            ),
            changes: deepFreezeValue(
              deliveries.map((delivery) => delivery.payload)
            ),
            compensatesBatchId: forwardBatch.batchId
          } satisfies SharedDeliveryBatch)
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
            this.onSharedDeliveryBatch?.(compensationBatch)
          } finally {
            this.sharedEvidenceNotificationDepth -= 1
          }
          if (
            state.acknowledgedPublicationId &&
            state.compensationPublicationId
          ) {
            acknowledgedCompensationBatches.push({
              batch: compensationBatch,
              publicationId: state.compensationPublicationId,
              compensatesPublicationId: state.acknowledgedPublicationId
            })
          }
        } catch (error) {
          failures.push(error)
        }
      })

    this.queueAcknowledgedCompensationPublications(
      acknowledgedCompensationBatches
    )
    this.flushSharedPublications()
    return failures
  }

  private compensateImmediateSharedChanges(): unknown[] {
    const failures: unknown[] = [
      ...this.compensateDeliveredHistoryReplayBatches()
    ]
    const acknowledgedCompensationBatches: {
      batch: SharedDeliveryBatch
      publicationId: string
      compensatesPublicationId: string
    }[] = []
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
          const inverseEvents = record.inverseEvents ?? []
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
        const batchId =
          forwardBatch.compensationBatchId ??
          `${forwardBatch.batchId}:compensation`
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
          }
        } finally {
          this.sharedEvidenceNotificationDepth -= 1
        }
        const acknowledgedRecord = records.find(
          ({ record }) =>
            record.acknowledgedPublicationId !== undefined &&
            record.compensationPublicationId !== undefined
        )?.record
        if (
          acknowledgedRecord?.acknowledgedPublicationId &&
          acknowledgedRecord.compensationPublicationId
        ) {
          acknowledgedCompensationBatches.push({
            batch: compensationBatch,
            publicationId: acknowledgedRecord.compensationPublicationId,
            compensatesPublicationId:
              acknowledgedRecord.acknowledgedPublicationId
          })
        }
      } catch (error) {
        failures.push(error)
      }
    })

    this.queueAcknowledgedCompensationPublications(
      acknowledgedCompensationBatches
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

  private commitNestedReplayHistory(history: FactoryHistoryEntry) {
    if (this.inUndo) {
      if (this.undoStack[this.undoStack.length - 1] !== history) {
        throw new Error('Nested undo source history changed before commit')
      }
      this.undoStack.pop()
      this.redoStack.push(history)
      return
    }

    if (this.inRedo) {
      if (this.redoStack[this.redoStack.length - 1] !== history) {
        throw new Error('Nested redo source history changed before commit')
      }
      this.redoStack.pop()
      this.undoStack.push(history)
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
    if (this.nestedReplaySourceEvents) {
      this.restoringNestedReplay = true
      let failures: unknown[]
      try {
        failures = [
          ...this.rollbackJournal('action'),
          ...this.restoreNestedReplay()
        ]
      } finally {
        this.restoringNestedReplay = false
      }
      const rollbackFailures = [
        ...precedingFailures,
        ...failures,
        ...this.compensateImmediateSharedChanges()
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
      ...this.rollbackJournal(),
      ...this.compensateImmediateSharedChanges()
    ]
    if (failures.length > 0) {
      const rollbackError = new TransactionRollbackError(failures)
      this.emitStatus('rollback-failed', failure, rollbackError)
      throw rollbackError
    }

    this.emitStatus('rolled-back', failure)
  }

  private validationContext(): TransactionValidationContext {
    const undoableEntries = this.preparedActionHistoryEntries ?? this.journal
    const undoableChangeCount = undoableEntries.filter(
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
    history?: FactoryHistoryEntry
  ): PreparedHistoryTransition | null {
    if (this.nestedReplaySourceHistory && this.nestedReplaySourceEvents) {
      const sourceHistory = this.nestedReplaySourceHistory
      const events = this.nestedReplaySourceEvents
      this.commitNestedReplayHistory(sourceHistory)

      return {
        complete: () => this.emitReplayCommitted(events),
        rollback: () => {
          if (this.inUndo) {
            if (this.redoStack[this.redoStack.length - 1] !== sourceHistory) {
              throw new Error('Undo target history changed before rollback')
            }
            this.redoStack.pop()
            this.undoStack.push(sourceHistory)
            return
          }

          if (this.inRedo) {
            if (this.undoStack[this.undoStack.length - 1] !== sourceHistory) {
              throw new Error('Redo target history changed before rollback')
            }
            this.undoStack.pop()
            this.redoStack.push(sourceHistory)
          }
        }
      }
    }

    if (this.isInUndo() || this.isInRedo()) {
      return null
    }

    if (!history) {
      throw new Error(
        'Committed transaction journal is required for local history'
      )
    }

    const committedChanges = this.historyChanges(history)
    if (committedChanges.length === 0) {
      return null
    }

    const previousRedoStack = this.redoStack
    this.undoStack.push(history)
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
        if (this.undoStack[this.undoStack.length - 1] !== history) {
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
              this.preparedActionHistoryEntries =
                this.prepareCommittedActionHistoryEntries()
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
          if (
            this.journal.length === 0 &&
            !this.historyReplaySharedState?.batchStates.length
          ) {
            if (this.nestedReplaySourceEvents) {
              this.prepareHistoryTransition()?.complete()
            } else if (!this.isInUndo() && !this.isInRedo()) {
              this.emitStatus('discarded')
            }
          } else {
            let historyTransition: PreparedHistoryTransition | null = null
            const sharedPublications: SharedPublication[] = []
            try {
              this.queueUnacknowledgedSharedPublications()
              this.queuePendingImmediatePublication()
              this.flushPendingImmediatePublication()
              this.flushSharedPublications()
              const transactionEndBatches =
                this.prepareTransactionEndDeliveryIndex()
              const transactionEndEntries = this.journal.filter(
                (entry) => entry.options.sharedDelivery === 'transaction-end'
              )
              const historyDeliverySequence =
                this.resolveCommittedHistoryDeliverySequence()
              const history: FactoryHistoryEntry = {
                entries: this.preparedActionHistoryEntries ?? this.journal,
                ...(historyDeliverySequence
                  ? {
                      progressiveDeliverySequence: historyDeliverySequence
                    }
                  : {})
              }
              historyTransition = this.prepareHistoryTransition(history)
              measureBrowserDragPhase('factory:flush-shared-channels', () => {
                if (this.activeDeliverySequence?.mode === 'progressive') {
                  const { slices } = this.activeDeliverySequence
                  while (this.nextDeliverySliceIndex < slices.length) {
                    const sliceId = slices[this.nextDeliverySliceIndex]?.sliceId
                    if (!sliceId) {
                      throw new Error(
                        'Factory mutation delivery sequence contains an empty progressive slice'
                      )
                    }
                    const sliceBatches =
                      this.transactionEndBatchesBySlice.get(sliceId) ?? []
                    sliceBatches.forEach((batch) => {
                      this.deliverPreparedSharedBatch(batch)
                    })
                    this.queueProgressiveSlicePublication(
                      this.transactionEndRecordsBySlice.get(sliceId) ?? [],
                      slices[this.nextDeliverySliceIndex]?.orderedIds ?? [],
                      this.nextDeliverySliceIndex === slices.length - 1
                    )
                    this.nextDeliverySliceIndex += 1
                  }
                  return
                }
                transactionEndBatches.forEach((batch) => {
                  this.deliverPreparedSharedBatch(batch)
                })
                const publication = this.historyReplaySharedState?.batchStates
                  .length
                  ? this.createHistoryReplaySharedPublication(
                      transactionEndBatches
                    )
                  : this.createSharedPublication(transactionEndEntries)
                if (publication) sharedPublications.push(publication)
              })
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
            this.flushSharedPublications()
            this.flushStatuses()
          }
        }
      } finally {
        this.discardPendingImmediatePublication()
        this.unacknowledgedSharedPublications.length = 0
        this.publicationAcknowledgements.clear()
        this.journal = []
        this.replaceLatestHistoryStages.clear()
        this.preparedActionHistoryEntries = null
        this.rollbackOnly = false
        this.rollbackFailure = undefined
        this.activeOrigin = 'action'
        this.activeDeliverySequence = undefined
        this.activeDeliverySliceByOrderedId.clear()
        this.activeDeliverySliceOrder.clear()
        this.activeDeliveryBoundaryBySliceId.clear()
        this.activeDeliveryOrderedIdOrder.clear()
        this.activeDeliverySequenceValidated = false
        this.nextDeliverySliceIndex = 0
        this.activeStagedDeliveryController = undefined
        this.activeDeliveryHandle = undefined
        this.activeDeliveryHandleToken = undefined
        this.currentSharedDeliveryBatches = []
        this.preparedSharedBatchRecords.clear()
        this.transactionEndDeliveryBatches = null
        this.transactionEndBatchesBySlice.clear()
        this.transactionEndRecordsBySlice.clear()
        this.pendingProgressivePublicationRecords.length = 0
        this.pendingProgressivePublicationWorkItemKeys.clear()
        this.pendingHistoryReplayPublicationBatches.length = 0
        this.pendingHistoryReplayPublicationWorkItemKeys.clear()
        this.historyReplaySharedState = undefined
        this.retainingHistoryReplaySharedEvidence = false
        if (this.nestedReplaySourceEvents) {
          this.nestedReplaySourceEvents = null
          this.nestedReplaySourceHistory = null
          this.nestedReplayRestorationBatches = []
          this.inUndo = false
          this.inRedo = false
        }
        this.transactionSettlementDepth -= 1
        if (this.transactionSettlementDepth === 0) {
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

  private historyChanges(history: FactoryHistoryEntry) {
    return history.entries.filter(({ options }) => options.undoable)
  }

  private deliveredHistoryRecords(
    history: FactoryHistoryEntry
  ): readonly JournalSharedRecordRef[] {
    return this.historyChanges(history).flatMap((entry) =>
      (entry.shared?.records ?? []).flatMap((record) =>
        record.delivered && record.delivery && record.batch
          ? [{ entry, record }]
          : []
      )
    )
  }

  private historySourceBatches(
    records: readonly JournalSharedRecordRef[]
  ): readonly SharedDeliveryBatch[] {
    const batches: SharedDeliveryBatch[] = []
    const seenBatchIds = new Set<string>()
    records.forEach(({ record }) => {
      const batch = record.batch
      if (!batch || seenBatchIds.has(batch.batchId)) return
      seenBatchIds.add(batch.batchId)
      batches.push(batch)
    })
    return batches
  }

  private orderHistorySourceBatchesByDeliverySequence(
    history: FactoryHistoryEntry,
    batches: readonly SharedDeliveryBatch[]
  ): readonly SharedDeliveryBatch[] {
    const sequence = history.progressiveDeliverySequence
    if (!sequence) return batches

    const batchesBySlice = new Map<string, SharedDeliveryBatch[]>()
    batches.forEach((batch) => {
      const sliceBatches = batchesBySlice.get(batch.sliceId) ?? []
      sliceBatches.push(batch)
      batchesBySlice.set(batch.sliceId, sliceBatches)
    })
    const orderedBatches = sequence.slices.flatMap(
      ({ sliceId }) => batchesBySlice.get(sliceId) ?? []
    )
    const orderedBatchIds = new Set(
      orderedBatches.map(({ batchId }) => batchId)
    )
    orderedBatches.push(
      ...batches.filter(({ batchId }) => !orderedBatchIds.has(batchId))
    )
    return deepFreezeValue(orderedBatches)
  }

  private historyReplayReadinessKey(
    sourceRecordId: string,
    outputIndex: number
  ): string {
    return `${sourceRecordId}:output:${outputIndex}`
  }

  private configureHistoryReplayProgressiveSequence(
    history: FactoryHistoryEntry,
    direction: 'forward' | 'inverse',
    deliveredOrderedIds: ReadonlySet<string>
  ): void {
    const deliverySequence = history.progressiveDeliverySequence
    if (
      this.activeDeliverySequence ||
      !deliverySequence ||
      deliveredOrderedIds.size === 0
    ) {
      return
    }
    const slices =
      direction === 'forward'
        ? deliverySequence.slices.flatMap((slice) => {
            const orderedIds = slice.orderedIds.filter((orderedId) =>
              deliveredOrderedIds.has(orderedId)
            )
            return orderedIds.length > 0
              ? [{ sliceId: slice.sliceId, orderedIds }]
              : []
          })
        : [...deliverySequence.slices].reverse().flatMap((slice) => {
            const orderedIds = [...slice.orderedIds]
              .reverse()
              .filter((orderedId) => deliveredOrderedIds.has(orderedId))
            return orderedIds.length > 0
              ? [{ sliceId: `${slice.sliceId}:inverse`, orderedIds }]
              : []
          })
    const deliveryOrderedIds = new Set(
      slices.flatMap(({ orderedIds }) => orderedIds)
    )
    if (
      deliveryOrderedIds.size !== deliveredOrderedIds.size ||
      [...deliveredOrderedIds].some(
        (orderedId) => !deliveryOrderedIds.has(orderedId)
      )
    ) {
      return
    }
    this.configureActiveDeliverySequence(
      deepFreezeValue({
        mode: 'progressive',
        ...(deliverySequence.batchPublications === undefined
          ? {}
          : { batchPublications: deliverySequence.batchPublications }),
        slices
      })
    )
  }

  private prepareHistoryReplaySharedState(
    history: FactoryHistoryEntry,
    direction: 'forward' | 'inverse'
  ): void {
    if (this.historyReplaySharedState) {
      throw new Error('Factory history replay shared state already exists')
    }
    const historyChanges = this.historyChanges(history)
    const deliveredRecords = this.deliveredHistoryRecords(history)
    const deliveredSourceIds = new Set(
      deliveredRecords.flatMap(({ record }) =>
        record.delivery ? [record.delivery.deliveryId] : []
      )
    )
    const committedSourceBatches =
      this.orderHistorySourceBatchesByDeliverySequence(
        history,
        this.historySourceBatches(deliveredRecords)
      )
    const sourceBatches =
      direction === 'forward'
        ? committedSourceBatches
        : [...committedSourceBatches].reverse()
    const batchStates: HistoryReplaySharedBatchState[] = []
    const batchStatesByReadinessKey = new Map<
      string,
      HistoryReplaySharedBatchState[]
    >()
    const deliveredOrderedIds = new Set<string>()
    const historyDeliveryOrderedIds = new Set(
      history.progressiveDeliverySequence?.slices.flatMap(
        ({ orderedIds }) => orderedIds
      ) ?? []
    )

    sourceBatches.forEach((sourceBatch) => {
      const sourceDeliveries = (
        direction === 'forward'
          ? sourceBatch.deliveries
          : [...sourceBatch.deliveries].reverse()
      ).filter((delivery) => deliveredSourceIds.has(delivery.deliveryId))
      if (sourceDeliveries.length === 0) return

      const batchId = this.nextDeliveryBatchId()
      let replayRecordOccurrence = 0
      const replayRecords = sourceDeliveries.flatMap((sourceDelivery) => {
        const sourceRecord = sourceDelivery.record
        const replayEvents =
          direction === 'forward'
            ? [
                {
                  event: {
                    type: sourceDelivery.eventName,
                    payload: sourceDelivery.payload
                  } as AllEvent,
                  outputIndex: 0
                }
              ]
            : sourceRecord.inverseEvents.map((event, outputIndex) => ({
                event,
                outputIndex
              }))
        return replayEvents.map(({ event, outputIndex }) => {
          const readinessKey = this.historyReplayReadinessKey(
            sourceRecord.recordId,
            outputIndex
          )
          const recordIndex = replayRecordOccurrence
          replayRecordOccurrence += 1
          const recordId = `${this.currentTransactionId}:history:${sourceRecord.recordId}:${outputIndex}`
          const deliveryId = `${recordId}:forward`
          const orderedIds =
            direction === 'forward'
              ? sourceRecord.orderedIds
              : [...sourceRecord.orderedIds].reverse()
          orderedIds.forEach((orderedId) => {
            if (historyDeliveryOrderedIds.has(orderedId)) {
              deliveredOrderedIds.add(orderedId)
            }
          })
          if (historyDeliveryOrderedIds.has(sourceDelivery.deliveryId)) {
            deliveredOrderedIds.add(sourceDelivery.deliveryId)
          }
          const replaySharedOptions = {
            undoable: false,
            rollbackable: true,
            sharedDelivery: sourceBatch.sharedDelivery
          }
          const payload = deepFreezeValue(
            toSharedChannelPayload(
              (event as AllEvent & { payload: TransactionPayload }).payload,
              replaySharedOptions
            )
          )
          const inverseEvents = (
            direction === 'forward'
              ? sourceRecord.inverseEvents
              : this.createReplayEvents(
                  event,
                  'inverse',
                  'factory-owned-journal'
                )
          ).map((inverseEvent) =>
            deepFreezeValue({
              ...inverseEvent,
              payload: toSharedChannelPayload(
                (
                  inverseEvent as AllEvent & {
                    payload: TransactionPayload
                  }
                ).payload,
                replaySharedOptions
              )
            } as AllEvent)
          )
          const record = deepFreezeValue({
            recordId,
            deliveryId,
            occurrence: recordIndex,
            orderedIds,
            payload,
            inverseEvents: deepFreezeValue(inverseEvents)
          } satisfies FactoryMutationSharedRecordEvidence)
          return { event, readinessKey, record }
        })
      })
      const deliveries = deepFreezeValue(
        replayRecords.map(({ event, record }) =>
          deepFreezeValue({
            deliveryId: record.deliveryId,
            artifactId: this.currentArtifactId,
            batchId,
            transactionId: this.currentTransactionId,
            origin: this.transactionOrigin(),
            kind: 'forward' as const,
            channel: sourceBatch.channel,
            eventName: event.type,
            payload: record.payload,
            recordId: record.recordId,
            record,
            sharedDelivery: sourceBatch.sharedDelivery,
            compensationDeliveryIds: deepFreezeValue(
              record.inverseEvents.map(
                (_event, inverseIndex) =>
                  `${record.deliveryId}:compensation:${inverseIndex}`
              )
            )
          })
        )
      )
      const batch = deepFreezeValue({
        batchId,
        sliceId:
          direction === 'forward'
            ? sourceBatch.sliceId
            : `${sourceBatch.sliceId}:inverse`,
        artifactId: this.currentArtifactId,
        transactionId: this.currentTransactionId,
        origin: this.transactionOrigin(),
        kind: 'forward' as const,
        channel: sourceBatch.channel,
        sharedDelivery: sourceBatch.sharedDelivery,
        deliveries,
        records: deepFreezeValue(deliveries.map((delivery) => delivery.record)),
        changes: deepFreezeValue(
          deliveries.map((delivery) => delivery.payload)
        ),
        compensationBatchId: `${batchId}:compensation`
      } satisfies SharedDeliveryBatch)
      const requiredReadinessKeys = new Set(
        replayRecords.map(({ readinessKey }) => readinessKey)
      )
      const state: HistoryReplaySharedBatchState = {
        batch,
        requiredReadinessKeys,
        readyReadinessKeys: new Set(),
        delivered: false
      }
      batchStates.push(state)
      requiredReadinessKeys.forEach((readinessKey) => {
        const states = batchStatesByReadinessKey.get(readinessKey) ?? []
        states.push(state)
        batchStatesByReadinessKey.set(readinessKey, states)
      })
    })

    this.configureHistoryReplayProgressiveSequence(
      history,
      direction,
      deliveredOrderedIds
    )
    const sharedState: HistoryReplaySharedState = {
      direction,
      ownsReplayEvidence: historyChanges.some(
        (change) => change.shared !== undefined
      ),
      batchStates: Object.freeze([...batchStates]),
      batchStateById: new Map(
        batchStates.map((state) => [state.batch.batchId, state] as const)
      ),
      batchStatesByReadinessKey: new Map(
        [...batchStatesByReadinessKey].map(([readinessKey, states]) => [
          readinessKey,
          Object.freeze([...states])
        ])
      )
    }
    this.historyReplaySharedState = sharedState
    this.currentSharedDeliveryBatches.push(
      ...sharedState.batchStates.map(({ batch }) => batch)
    )
  }

  private flushNextReadyHistoryReplaySlice(
    maxItemsPerPublication: number
  ): 'none' | HistoryReplaySliceSettlement {
    const sharedState = this.historyReplaySharedState
    if (!sharedState) return 'none'
    const firstUndeliveredIndex = sharedState.batchStates.findIndex(
      (state) => !state.delivered
    )
    if (firstUndeliveredIndex < 0) return 'none'
    const firstUndeliveredState = sharedState.batchStates[firstUndeliveredIndex]
    if (!firstUndeliveredState) return 'none'
    const isProgressive = this.activeDeliverySequence?.mode === 'progressive'
    if (
      !isProgressive &&
      firstUndeliveredState.batch.sharedDelivery !== 'immediate' &&
      !sharedState.batchStates
        .slice(firstUndeliveredIndex + 1)
        .some(
          (state) =>
            !state.delivered &&
            state.batch.sharedDelivery === 'immediate' &&
            state.readyReadinessKeys.size === state.requiredReadinessKeys.size
        )
    ) {
      this.flushPendingHistoryReplayPublication()
      return 'none'
    }
    const sliceId = firstUndeliveredState.batch.sliceId
    let sliceEnd = firstUndeliveredIndex
    while (sharedState.batchStates[sliceEnd + 1]?.batch.sliceId === sliceId) {
      sliceEnd += 1
    }
    const states = sharedState.batchStates.slice(
      firstUndeliveredIndex,
      sliceEnd + 1
    )
    if (
      states.some(
        (state) =>
          state.readyReadinessKeys.size !== state.requiredReadinessKeys.size
      )
    ) {
      return 'none'
    }
    const isFormalProgressiveSlice =
      isProgressive && this.activeDeliveryBoundaryBySliceId.has(sliceId)
    const activeSlice = isFormalProgressiveSlice
      ? this.activeDeliverySequence?.slices[this.nextDeliverySliceIndex]
      : undefined
    if (
      isFormalProgressiveSlice &&
      (!activeSlice || activeSlice.sliceId !== sliceId)
    ) {
      throw new Error(
        `Factory history replay delivery slice must follow sequence order: ${activeSlice?.sliceId ?? 'complete'}`
      )
    }
    const workItemKeys = new Set(
      this.sharedBatchPublicationWorkItemKeys(states.map(({ batch }) => batch))
    )
    const pendingDeliveryMode =
      this.pendingHistoryReplayPublicationBatches[0]?.sharedDelivery
    const currentDeliveryMode = states[0]?.batch.sharedDelivery
    if (
      this.pendingHistoryReplayPublicationBatches.length > 0 &&
      (pendingDeliveryMode !== currentDeliveryMode ||
        this.activeDeliverySequence?.batchPublications === false ||
        this.publicationWindowWouldExceedTarget(
          this.pendingHistoryReplayPublicationWorkItemKeys,
          [...workItemKeys],
          maxItemsPerPublication
        ))
    ) {
      this.flushPendingHistoryReplayPublication()
    }

    states.forEach((state) => {
      if (!this.deliverPreparedSharedBatch(state.batch)) {
        throw new Error(
          `Factory history replay batch could not be delivered: ${state.batch.batchId}`
        )
      }
    })
    this.pendingHistoryReplayPublicationBatches.push(
      ...states.map(({ batch }) => batch)
    )
    workItemKeys.forEach((workItemKey) =>
      this.pendingHistoryReplayPublicationWorkItemKeys.add(workItemKey)
    )
    const finalSlice = sharedState.batchStates.every((state) => state.delivered)
    if (
      this.shouldFlushPublicationWindow(
        this.pendingHistoryReplayPublicationWorkItemKeys,
        finalSlice,
        maxItemsPerPublication
      )
    ) {
      this.flushPendingHistoryReplayPublication()
    }
    if (isFormalProgressiveSlice) {
      this.nextDeliverySliceIndex += 1
    }
    return {
      explicitBoundary: isFormalProgressiveSlice,
      workItemKeys: deepFreezeValue([...workItemKeys])
    }
  }

  private flushPendingHistoryReplayPublication(): void {
    const batches = this.pendingHistoryReplayPublicationBatches.splice(0)
    this.pendingHistoryReplayPublicationWorkItemKeys.clear()
    if (batches.length === 0) return
    const publication = this.createHistoryReplaySharedPublication(batches)
    this.queueSharedPublication(publication)
    this.flushSharedPublications()
  }

  private markHistoryReplaySharedReady(
    sharedReplay: HistorySharedReplay
  ): void {
    const sharedState = this.historyReplaySharedState
    if (!sharedState) return
    sharedReplay.records.forEach(({ readinessKey }) => {
      const states =
        sharedState.batchStatesByReadinessKey.get(readinessKey) ?? []
      states.forEach((state) => state.readyReadinessKeys.add(readinessKey))
    })
  }

  private suppressHistoryReplayOwnerSharedEntries(
    entries: readonly TransactionJournalEntry[]
  ): void {
    entries.forEach((entry) => {
      entry.options.shared = undefined
      entry.shared = undefined
    })
  }

  private historySharedReplay(
    history: FactoryHistoryEntry,
    direction: 'forward' | 'inverse'
  ): readonly (HistorySharedReplayOutputs | undefined)[] {
    const historyChanges = this.historyChanges(history)
    const deliveredRecordsByChange = historyChanges.map((change) => {
      if (!change.shared) return []
      return change.shared.records.filter(
        (record) => record.delivered && record.delivery && record.evidence
      )
    })
    return historyChanges.map((change, changeIndex) => {
      if (!change.shared) return
      const deliveredRecords = deliveredRecordsByChange[changeIndex] ?? []
      const outputCount =
        direction === 'forward' ? 1 : (change.inverseEvents?.length ?? 0)
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
            readinessKey: this.historyReplayReadinessKey(
              record.evidence?.recordId ?? '',
              outputIndex
            ),
            orderedIds:
              direction === 'forward'
                ? record.orderedIds
                : [...record.orderedIds].reverse(),
            payload:
              direction === 'forward'
                ? record.change
                : (
                    record.inverseEvents?.[outputIndex] as AllEvent & {
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
            name: change.shared?.name ?? '',
            sharedDelivery: change.options.sharedDelivery,
            orderedIds: deepFreezeValue(orderedIds),
            records: deepFreezeValue(records)
          }
        })
      )
    })
  }

  private async replayHistoryProgressively(
    direction: 'forward' | 'inverse',
    yieldAfterSlice: () => Promise<void>,
    options: CooperativeRenderBatchOptions = {}
  ): Promise<void> {
    if (this.isTransacting > 0 && this.activeOrigin === 'remote') {
      throw new Error(
        `Remote transaction cannot consume local ${
          direction === 'inverse' ? 'undo' : 'redo'
        } history`
      )
    }
    const sourceStack =
      direction === 'inverse' ? this.undoStack : this.redoStack
    if (!sourceStack.length) {
      return
    }
    if (this.isTransacting <= 0) {
      throw new Error(
        `Progressive ${
          direction === 'inverse' ? 'Undo' : 'Redo'
        } requires an active outer transaction`
      )
    }
    if (this.journal.length > 0 || this.nestedReplaySourceEvents) {
      throw new Error(
        `${
          direction === 'inverse' ? 'Undo' : 'Redo'
        } cannot join a non-empty transaction journal`
      )
    }

    const sourceHistory = sourceStack[sourceStack.length - 1]
    if (!sourceHistory) return
    const maxItemsPerSlice = resolveCooperativeRenderMaxItemsPerSlice(options)
    const sourceChanges = this.historyChanges(sourceHistory)
    const lastChanges = sourceChanges.map(({ event }) => event)
    if (direction === 'inverse') {
      this.inUndo = true
      updateUndoRedoStatus(UNDO.UNDO)
    } else {
      this.inRedo = true
      updateUndoRedoStatus(UNDO.REDO)
    }

    try {
      this.ensureReplayTransactionId()
      this.nestedReplaySourceEvents = lastChanges
      this.nestedReplaySourceHistory = sourceHistory
      this.nestedReplayRestorationBatches = []
      this.prepareHistoryReplaySharedState(sourceHistory, direction)
      const failures = await this.replayProgressively(
        lastChanges,
        direction,
        direction === 'inverse' ? 'undo' : 'redo',
        yieldAfterSlice,
        maxItemsPerSlice,
        this.nestedReplayRestorationBatches,
        this.historySharedReplay(sourceHistory, direction),
        direction === 'inverse'
          ? sourceChanges.map(({ inverseEvents }) => inverseEvents)
          : undefined
      )
      if (failures.length > 0) {
        throw new TransactionRollbackError(failures)
      }
    } catch (error) {
      this.rollbackOnly = true
      this.rollbackFailure ??= toReplayFailure(error)
      throw error
    } finally {
      updateUndoRedoStatus(UNDO.NONE)
    }
  }

  undoProgressively(
    yieldAfterSlice: () => Promise<void>,
    options?: CooperativeRenderBatchOptions
  ): Promise<void> {
    return this.replayHistoryProgressively('inverse', yieldAfterSlice, options)
  }

  redoProgressively(
    yieldAfterSlice: () => Promise<void>,
    options?: CooperativeRenderBatchOptions
  ): Promise<void> {
    return this.replayHistoryProgressively('forward', yieldAfterSlice, options)
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

    const sourceHistory = this.undoStack[this.undoStack.length - 1]
    if (!sourceHistory) return
    const sourceChanges = this.historyChanges(sourceHistory)
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
      this.nestedReplaySourceHistory = sourceHistory
      this.nestedReplayRestorationBatches = []
      this.prepareHistoryReplaySharedState(sourceHistory, 'inverse')
      const failures = this.replay(
        lastChanges,
        'inverse',
        'undo',
        this.nestedReplayRestorationBatches,
        this.historySharedReplay(sourceHistory, 'inverse'),
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

    const sourceHistory = this.redoStack[this.redoStack.length - 1]
    if (!sourceHistory) return
    const sourceChanges = this.historyChanges(sourceHistory)
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
      this.nestedReplaySourceHistory = sourceHistory
      this.nestedReplayRestorationBatches = []
      this.prepareHistoryReplaySharedState(sourceHistory, 'forward')
      const failures = this.replay(
        lastChanges,
        'forward',
        'redo',
        this.nestedReplayRestorationBatches,
        this.historySharedReplay(sourceHistory, 'forward')
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

  getUndoHistoryDepth(): number {
    return this.undoStack.length
  }

  isInRedo() {
    return this.inRedo
  }

  dispose() {
    this.discardPendingImmediatePublication()
    this.pendingSharedPublications.length = 0
    this.unacknowledgedSharedPublications.length = 0
    this.publicationAcknowledgements.clear()
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
    this.nestedReplaySourceHistory = null
    this.nestedReplayRestorationBatches = []
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
    this.pendingProgressivePublicationRecords.length = 0
    this.pendingProgressivePublicationWorkItemKeys.clear()
    this.pendingHistoryReplayPublicationBatches.length = 0
    this.pendingHistoryReplayPublicationWorkItemKeys.clear()
    this.historyReplaySharedState = undefined
    this.retainingHistoryReplaySharedEvidence = false
    this.activeDeliverySequence = undefined
    this.activeDeliverySliceByOrderedId.clear()
    this.activeDeliverySliceOrder.clear()
    this.activeDeliveryBoundaryBySliceId.clear()
    this.activeDeliveryOrderedIdOrder.clear()
    this.activeDeliverySequenceValidated = false
    this.nextDeliverySliceIndex = 0
    this.activeStagedDeliveryController = undefined
    this.activeDeliveryHandle = undefined
    this.activeDeliveryHandleToken = undefined
    this.sharedEvidenceNotificationDepth = 0
    this.rollbackOnly = false
    this.rollbackFailure = undefined
  }

  reset() {
    this.dispose()
  }
}

export default DataTransact
