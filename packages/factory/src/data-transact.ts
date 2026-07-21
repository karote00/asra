import type {
  ComputedDataPatchChange,
  EndTransactionOptions,
  PropsChange,
  SceneTreeChange,
  SharedDeliveryMode,
  ElementSelectionChange,
  TransactionFailure,
  TransactionOrigin,
  TransactionStatus,
  TransactionStatusPayload,
  UpdateElementPatchChange
} from '@asyra/utils'
import { UNDO, setOwnEnumerableValue } from '@asyra/utils'

type TransactionPayload = PropsChange | SceneTreeChange | ElementSelectionChange
interface EffectiveMutationOptions {
  undoable: boolean
  rollbackable: boolean
  shared?: string
  sharedDelivery: SharedDeliveryMode
}

interface JournalSharedChange {
  name: string
  change: TransactionPayload
  delivered: boolean
  published: boolean
}

interface TransactionJournalEntry {
  index: number
  event: AllEvent
  options: EffectiveMutationOptions
  source: 'action' | 'replay'
  shared?: JournalSharedChange
}
interface PreparedHistoryTransition {
  complete: () => void
  rollback: () => void
}
interface DataTransactCallbacks {
  onStatus?: (payload: TransactionStatusPayload) => void
  onUserActionCompleted?: (payload: UserActionCompletedPayload) => void
  onReplayEvent?: (
    event: AllEvent,
    mode: TransactionReplayMode
  ) => boolean | { handled: boolean; applied: boolean }
  onSharedDelivery?: (delivery: SharedDelivery) => void
  onSharedPublication?: (publication: SharedPublication) => void
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
import type { SharedDataChannelRegistry } from './shared-data-channel'
import {
  TransactionRollbackError,
  TransactionValidationError,
  type TransactionInverter,
  type CanonicalEventApply,
  type TransactionValidationContext,
  type TransactionValidator
} from './transaction'
import type { SharedDelivery, SharedPublication } from './shared-delivery'

const BUILT_IN_INVERTIBLE_EVENT_TYPES = new Set<string>([
  EventTypes.ADD_ELEMENT,
  EventTypes.REMOVE_ELEMENT,
  EventTypes.UPDATE_COMPUTED_DATA,
  EventTypes.UPDATE_COMPUTED_DATA_PATCH,
  EventTypes.ADD_PROPERTY,
  EventTypes.REMOVE_PROPERTY,
  EventTypes.UPDATE_PROPERTY,
  EventTypes.SELECT_ELEMENTS,
  EventTypes.SELECT_VECTOR_POINTS,
  EventTypes.SELECT_VECTOR_SEGMENTS
])

const toSharedChannelPayload = (
  payload: TransactionPayload,
  options: UpdateTransactionEvent['options']
): TransactionPayload => {
  if (!options) {
    return payload
  }

  const { shared: _shared, ...payloadOptions } = options
  const hasPayloadOptions = Object.keys(payloadOptions).length > 0
  if (!hasPayloadOptions) {
    return payload
  }

  return {
    ...payload,
    options: {
      ...(payload.options ?? {}),
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

const cloneTransactionValue = <T>(
  value: T,
  seen = new WeakMap<object, unknown>()
): T => {
  if (value === null || typeof value !== 'object') {
    return value
  }

  const source = value as object
  const existing = seen.get(source)
  if (existing) {
    return existing as T
  }

  const clone: object = Array.isArray(value)
    ? []
    : Object.create(Object.getPrototypeOf(value))
  seen.set(source, clone)
  Reflect.ownKeys(source).forEach((key) => {
    if (Array.isArray(source) && key === 'length') {
      return
    }
    const descriptor = Object.getOwnPropertyDescriptor(source, key)
    if (!descriptor) {
      return
    }
    const snapshotValue =
      'value' in descriptor ? descriptor.value : Reflect.get(source, key)
    Object.defineProperty(clone, key, {
      value: cloneTransactionValue(snapshotValue, seen),
      enumerable: descriptor.enumerable,
      configurable: true,
      writable: true
    })
  })
  if (Array.isArray(source) && Array.isArray(clone)) {
    clone.length = source.length
  }

  return clone as T
}

const cloneEvent = (event: AllEvent): AllEvent => cloneTransactionValue(event)

const isReplayEvent = (value: unknown): value is AllEvent =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { type?: unknown }).type === 'string'

const toReplayFailure = (cause: unknown): TransactionFailure => ({
  kind: 'explicit',
  message: cause instanceof Error ? cause.message : undefined,
  cause
})

class DataTransact {
  private journal: TransactionJournalEntry[] = []
  private undoStack: AllEvent[][] = []
  private redoStack: AllEvent[][] = []
  private historySharedChannels = new WeakMap<
    AllEvent[],
    readonly (string | undefined)[]
  >()
  private isTransacting = 0
  private inUndo = false
  private inRedo = false
  private applyingReplayEvent = false
  private restoringNestedReplay = false
  private nestedReplaySourceEvents: AllEvent[] | null = null
  private nestedReplayRestorationPlans: AllEvent[][] = []
  private actionId = 0
  private transactionId = 0
  private currentTransactionId = 0
  private activeOrigin: TransactionOrigin = 'action'
  private rollbackOnly = false
  private rollbackFailure: TransactionFailure | undefined
  private readonly pendingSharedPublications: SharedPublication[] = []
  private emittingSharedPublications = false
  private readonly pendingImmediatePublicationEntries: TransactionJournalEntry[] =
    []
  private immediatePublicationToken = 0
  private publicationSequence = 0
  private readonly pendingTransactionStatuses: TransactionStatusPayload[] = []
  private emittingTransactionStatuses = false
  private readonly inverters = new Map<string, TransactionInverter>()
  private readonly validators = new Map<string, TransactionValidator>()
  private readonly onStatus?: (payload: TransactionStatusPayload) => void
  private readonly onUserActionCompleted?: (
    payload: UserActionCompletedPayload
  ) => void
  private readonly onReplayEvent?: (
    event: AllEvent,
    mode: TransactionReplayMode
  ) => boolean | { handled: boolean; applied: boolean }
  private readonly onSharedDelivery?: (delivery: SharedDelivery) => void
  private readonly onSharedPublication?: (
    publication: SharedPublication
  ) => void
  private readonly sharedDataChannelRegistry: Pick<
    SharedDataChannelRegistry,
    'pushToSharedChannel'
  >

  constructor(
    sharedDataChannelRegistry?: Pick<
      SharedDataChannelRegistry,
      'pushToSharedChannel'
    >,
    callbacks?: DataTransactCallbacks
  ) {
    this.sharedDataChannelRegistry = sharedDataChannelRegistry ?? {
      pushToSharedChannel: () => false
    }
    this.onStatus = callbacks?.onStatus
    this.onUserActionCompleted = callbacks
      ? callbacks.onUserActionCompleted
      : userActionCompleted
    this.onReplayEvent = callbacks?.onReplayEvent
    this.onSharedDelivery = callbacks?.onSharedDelivery
    this.onSharedPublication = callbacks?.onSharedPublication
  }

  start(origin?: TransactionOrigin) {
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
    this.publicationSequence = 0
    this.nestedReplayRestorationPlans = []
    this.rollbackOnly = false
    this.rollbackFailure = undefined
    this.transactionId += 1
    this.currentTransactionId = this.transactionId
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
      ('changes' in payload && Array.isArray(payload.changes))
    )
  }

  update(event: UpdateTransactionEvent) {
    if (this.isTransacting <= 0 || this.restoringNestedReplay) {
      return
    }

    const payload = event.payload as TransactionPayload
    const newType = event.eventName as AllEvent['type']
    const newPayload = cloneTransactionValue(payload)
    const newEvent: AllEvent = {
      type: newType,
      payload: newPayload
    }

    const origin = this.transactionOrigin()
    const options: EffectiveMutationOptions = {
      undoable: origin === 'remote' ? false : event.options?.undoable !== false,
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
      const sharedChange = cloneTransactionValue(
        toSharedChannelPayload(newPayload, sharedOptions)
      )
      journalEntry.shared = {
        name: sharedChannelName,
        change: sharedChange,
        delivered: false,
        published: false
      }
    }

    this.journal.push(journalEntry)

    if (this.nestedReplaySourceEvents && journalEntry.source === 'action') {
      const error = new Error(
        'Nested undo or redo cannot accept a new action mutation'
      )
      this.rollbackOnly = true
      this.rollbackFailure ??= toReplayFailure(error)
      throw error
    }

    if (journalEntry.shared && event.options?.sharedDelivery === 'immediate') {
      journalEntry.shared.delivered =
        this.sharedDataChannelRegistry.pushToSharedChannel(
          journalEntry.shared.name,
          journalEntry.shared.change
        )
      if (journalEntry.shared.delivered) {
        this.emitForwardSharedDelivery(journalEntry)
        this.queueImmediatePublicationEntry(journalEntry)
      }
    }
  }

  private forwardDeliveryId(entry: TransactionJournalEntry): string {
    return `${this.currentTransactionId}:${entry.index}:forward`
  }

  private emitForwardSharedDelivery(entry: TransactionJournalEntry): void {
    if (this.transactionOrigin() === 'remote') return
    const delivery = this.createForwardSharedDelivery(entry)
    if (!delivery) return
    this.onSharedDelivery?.(delivery)
  }

  private createForwardSharedDelivery(
    entry: TransactionJournalEntry
  ): SharedDelivery | undefined {
    if (this.transactionOrigin() === 'remote') return undefined
    const shared = entry.shared
    if (!shared) return undefined
    return {
      deliveryId: this.forwardDeliveryId(entry),
      transactionId: this.currentTransactionId,
      origin: this.transactionOrigin(),
      kind: 'forward',
      channel: shared.name,
      eventName: entry.event.type,
      payload: cloneTransactionValue(shared.change),
      sharedDelivery: entry.options.sharedDelivery
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
    if (this.transactionOrigin() === 'remote') return
    const publishableEntries = entries.filter((entry) => {
      if (!entry.shared?.delivered || entry.shared.published) {
        return false
      }
      return true
    })
    const deliveries = publishableEntries.flatMap((entry) => {
      if (!entry.shared) {
        return []
      }
      const delivery = this.createForwardSharedDelivery(entry)
      return delivery ? [delivery] : []
    })
    if (deliveries.length === 0) return
    publishableEntries.forEach((entry) => {
      if (entry.shared) entry.shared.published = true
    })
    return this.createSharedPublicationFromDeliveries(deliveries, origin)
  }

  private createSharedPublicationFromDeliveries(
    deliveries: readonly SharedDelivery[],
    origin: SharedPublication['origin']
  ): SharedPublication | undefined {
    if (deliveries.length === 0) return undefined
    return {
      publicationId: this.nextPublicationId(),
      transactionId: this.currentTransactionId,
      origin,
      deliveries
    }
  }

  private queueImmediatePublicationEntry(entry: TransactionJournalEntry): void {
    this.pendingImmediatePublicationEntries.push(entry)
    const token = ++this.immediatePublicationToken
    queueMicrotask(() => {
      if (token !== this.immediatePublicationToken) return
      this.queuePendingImmediatePublication()
      this.flushSharedPublications()
    })
  }

  private queuePendingImmediatePublication(): void {
    this.immediatePublicationToken += 1
    const entries = this.pendingImmediatePublicationEntries.splice(0)
    this.queueSharedPublication(this.createSharedPublication(entries))
  }

  private discardPendingImmediatePublication(): void {
    this.immediatePublicationToken += 1
    this.pendingImmediatePublicationEntries.length = 0
  }

  private queueSharedPublication(
    publication: SharedPublication | undefined
  ): void {
    if (!publication) return
    this.pendingSharedPublications.push(publication)
  }

  private flushSharedPublications(): void {
    if (this.emittingSharedPublications) return
    this.emittingSharedPublications = true
    try {
      let publication: SharedPublication | undefined
      while ((publication = this.pendingSharedPublications.shift())) {
        this.onSharedPublication?.(publication)
      }
    } finally {
      this.emittingSharedPublications = false
    }
  }

  private emitCompensationSharedDelivery(
    entry: TransactionJournalEntry,
    eventName: string,
    payload: TransactionPayload,
    compensationIndex: number
  ): SharedDelivery | undefined {
    if (this.transactionOrigin() === 'remote') return undefined
    const shared = entry.shared
    if (!shared) return undefined
    const delivery: SharedDelivery = {
      deliveryId: `${this.currentTransactionId}:${entry.index}:compensation:${compensationIndex}`,
      transactionId: this.currentTransactionId,
      origin: 'rollback-compensation',
      kind: 'compensation',
      channel: shared.name,
      eventName,
      payload: cloneTransactionValue(payload),
      sharedDelivery: entry.options.sharedDelivery,
      compensatesDeliveryId: this.forwardDeliveryId(entry)
    }
    this.onSharedDelivery?.(delivery)
    return delivery
  }

  private createReplayEvents(
    event: AllEvent,
    direction: 'forward' | 'inverse'
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

    const replayEvent = cloneEvent(event)
    const payload = (replayEvent as AllEvent & { payload: unknown }).payload
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
    sharedChannels?: readonly (string | undefined)[]
  ): unknown[] {
    const failures: unknown[] = []
    const entries = events.map((event, index) => ({
      event,
      sharedChannel: sharedChannels?.[index]
    }))
    const orderedEntries = direction === 'inverse' ? entries.reverse() : entries

    orderedEntries.forEach(({ event, sharedChannel }) => {
      let replayEvents: AllEvent[]
      try {
        replayEvents = this.createReplayEvents(event, direction)
      } catch (error) {
        failures.push(error)
        return
      }

      replayEvents.forEach((replayEvent) => {
        let restorationEvents: AllEvent[] | undefined
        const mustValidateReplayOutput =
          restorationPlans !== undefined ||
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
            sharedChannel &&
            (mode === 'undo' || mode === 'redo') &&
            !this.journal
              .slice(journalStart)
              .some((entry) => entry.shared?.name === sharedChannel)
          ) {
            this.recordReplaySharedChange(replayEvent, sharedChannel)
          }
        } catch (error) {
          if (restorationEvents && wasTransactionReplayApplied(error)) {
            restorationPlans?.push(restorationEvents)
          }
          failures.push(error)
        }
      })
    })

    return failures
  }

  private recordReplaySharedChange(event: AllEvent, name: string): void {
    const payload = cloneTransactionValue(
      (event as AllEvent & { payload: TransactionPayload }).payload
    )
    const options: EffectiveMutationOptions = {
      undoable: false,
      rollbackable: true,
      shared: name,
      sharedDelivery: 'transaction-end'
    }
    this.journal.push({
      index: this.journal.length,
      event: cloneEvent(event),
      options,
      source: 'replay',
      shared: {
        name,
        change: cloneTransactionValue(
          toSharedChannelPayload(payload, {
            undoable: false,
            rollbackable: true,
            shared: name,
            sharedDelivery: 'transaction-end'
          })
        ),
        delivered: false,
        published: false
      }
    })
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
    source?: TransactionJournalEntry['source']
  ): unknown[] {
    const rollbackableEvents = this.journal
      .filter(
        (entry) =>
          entry.options.rollbackable &&
          (source === undefined || entry.source === source)
      )
      .map(({ event }) => event)
    return this.replay(rollbackableEvents, 'inverse', 'rollback')
  }

  private compensateImmediateSharedChanges(): unknown[] {
    const failures: unknown[] = []
    const publishedCompensations: SharedDelivery[] = []

    ;[...this.journal].reverse().forEach((entry) => {
      const shared = entry.shared
      if (!entry.options.rollbackable || !shared?.delivered) {
        return
      }

      try {
        const sharedEvent = {
          type: entry.event.type,
          payload: shared.change
        } as AllEvent
        this.createReplayEvents(sharedEvent, 'inverse').forEach(
          (inverseEvent, compensationIndex) => {
            const inversePayload = (
              inverseEvent as AllEvent & { payload: TransactionPayload }
            ).payload
            const delivered =
              this.sharedDataChannelRegistry.pushToSharedChannel(
                shared.name,
                inversePayload
              )
            if (!delivered) {
              throw new Error(
                `Failed to compensate shared channel ${shared.name}`
              )
            }
            const compensation = this.emitCompensationSharedDelivery(
              entry,
              inverseEvent.type,
              inversePayload,
              compensationIndex
            )
            if (shared.published && compensation) {
              publishedCompensations.push(compensation)
            }
          }
        )
      } catch (error) {
        failures.push(error)
      }
    })

    this.queueSharedPublication(
      this.createSharedPublicationFromDeliveries(
        publishedCompensations,
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

  private emitReplayCommitted(events: readonly AllEvent[]) {
    this.onStatus?.({
      transactionId: this.currentTransactionId,
      origin: this.transactionOrigin(),
      status: 'committed',
      changeCount: events.length,
      undoableChangeCount: events.length,
      rollbackableChangeCount: events.length,
      nonRollbackableChangeCount: 0,
      timestamp: Date.now()
    })
  }

  private commitNestedReplayHistory(events: AllEvent[]) {
    if (this.inUndo) {
      if (this.undoStack[this.undoStack.length - 1] !== events) {
        throw new Error('Nested undo source history changed before commit')
      }
      this.undoStack.pop()
      this.redoStack.push(events)
      return
    }

    if (this.inRedo) {
      if (this.redoStack[this.redoStack.length - 1] !== events) {
        throw new Error('Nested redo source history changed before commit')
      }
      this.redoStack.pop()
      this.undoStack.push(events)
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

  private prepareHistoryTransition(): PreparedHistoryTransition | null {
    if (this.nestedReplaySourceEvents) {
      const events = this.nestedReplaySourceEvents
      this.commitNestedReplayHistory(events)

      return {
        complete: () => this.emitReplayCommitted(events),
        rollback: () => {
          if (this.inUndo) {
            if (this.redoStack[this.redoStack.length - 1] !== events) {
              throw new Error('Undo target history changed before rollback')
            }
            this.redoStack.pop()
            this.undoStack.push(events)
            return
          }

          if (this.inRedo) {
            if (this.undoStack[this.undoStack.length - 1] !== events) {
              throw new Error('Redo target history changed before rollback')
            }
            this.undoStack.pop()
            this.redoStack.push(events)
          }
        }
      }
    }

    if (this.isInUndo() || this.isInRedo()) {
      return null
    }

    const committedEntries = this.journal.filter(
      ({ options }) => options.undoable
    )
    const committedChanges = committedEntries.map(({ event }) => event)
    if (committedChanges.length === 0) {
      return null
    }

    const previousRedoStack = this.redoStack
    this.undoStack.push(committedChanges)
    this.redoStack = []

    return {
      complete: () => {
        this.historySharedChannels.set(
          committedChanges,
          Object.freeze(
            committedEntries.map((entry) =>
              entry.shared?.delivered ? entry.shared.name : undefined
            )
          )
        )
        this.actionId += 1
        this.onUserActionCompleted?.({
          actionId: this.actionId,
          changeCount: committedChanges.length,
          timestamp: Date.now()
        })
      },
      rollback: () => {
        if (this.undoStack[this.undoStack.length - 1] !== committedChanges) {
          throw new Error('Action undo history changed before rollback')
        }
        this.undoStack.pop()
        this.redoStack = previousRedoStack
      }
    }
  }

  end(options: EndTransactionOptions = {}) {
    if (this.isTransacting <= 0) {
      return
    }

    if (options.outcome === 'rollback') {
      this.rollbackOnly = true
      this.rollbackFailure ??= options.failure
    }

    this.isTransacting--

    if (this.isTransacting === 0) {
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
            const historyTransition = this.prepareHistoryTransition()
            try {
              this.flushPendingSharedChannelChanges()
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
            this.queuePendingImmediatePublication()
            const sharedPublication = this.createSharedPublication(
              this.journal.filter(
                (entry) => entry.options.sharedDelivery === 'transaction-end'
              )
            )
            this.queueSharedPublication(sharedPublication)
            const committedStatus =
              !this.nestedReplaySourceEvents &&
              !this.isInUndo() &&
              !this.isInRedo()
                ? this.createStatusPayload('committed')
                : undefined
            if (committedStatus) this.queueStatus(committedStatus)
            historyTransition?.complete()
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
        if (this.nestedReplaySourceEvents) {
          this.nestedReplaySourceEvents = null
          this.nestedReplayRestorationPlans = []
          this.inUndo = false
          this.inRedo = false
        }
      }
    }
  }

  flushPendingSharedChannelChanges() {
    this.journal.forEach((entry) => {
      const { shared } = entry
      if (shared && !shared.delivered) {
        shared.delivered = this.sharedDataChannelRegistry.pushToSharedChannel(
          shared.name,
          shared.change
        )
        if (shared.delivered) {
          this.emitForwardSharedDelivery(entry)
        }
      }
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

    const lastChanges = this.undoStack[this.undoStack.length - 1] as AllEvent[]
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
      this.nestedReplayRestorationPlans = []
      const failures = this.replay(
        lastChanges,
        'inverse',
        'undo',
        this.nestedReplayRestorationPlans,
        this.historySharedChannels.get(lastChanges)
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

    const lastChanges = this.redoStack[this.redoStack.length - 1] as AllEvent[]
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
      this.nestedReplayRestorationPlans = []
      const failures = this.replay(
        lastChanges,
        'forward',
        'redo',
        this.nestedReplayRestorationPlans,
        this.historySharedChannels.get(lastChanges)
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
    this.pendingSharedPublications.length = 0
    this.publicationSequence = 0
    this.journal = []
    this.undoStack = []
    this.redoStack = []
    this.historySharedChannels = new WeakMap()
    this.isTransacting = 0
    this.inUndo = false
    this.inRedo = false
    this.applyingReplayEvent = false
    this.restoringNestedReplay = false
    this.nestedReplaySourceEvents = null
    this.nestedReplayRestorationPlans = []
    this.actionId = 0
    this.transactionId = 0
    this.currentTransactionId = 0
    this.activeOrigin = 'action'
    this.rollbackOnly = false
    this.rollbackFailure = undefined
  }

  reset() {
    this.dispose()
  }
}

export default DataTransact
