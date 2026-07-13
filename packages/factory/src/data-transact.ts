import type {
  ComputedDataPatchChange,
  EndTransactionOptions,
  PropsChange,
  SceneTreeChange,
  ElementSelectionChange,
  TransactionFailure,
  TransactionOrigin,
  TransactionStatus,
  TransactionStatusPayload,
  UpdateElementPatchChange
} from '@asyra/utils'
import { SCENE_TREE_ACTIONS, UNDO } from '@asyra/utils'

type TransactionPayload = PropsChange | SceneTreeChange | ElementSelectionChange
interface EffectiveMutationOptions {
  undoable: boolean
  rollbackable: boolean
  shared?: string
  sharedDelivery: 'transaction-end' | 'immediate'
}

interface JournalSharedChange {
  name: string
  change: TransactionPayload
  delivered: boolean
}

interface TransactionJournalEntry {
  event: AllEvent
  options: EffectiveMutationOptions
  shared?: JournalSharedChange
}
interface DataTransactCallbacks {
  onStatus?: (payload: TransactionStatusPayload) => void
  onUserActionCompleted?: (payload: UserActionCompletedPayload) => void
}
import type {
  AllEvent,
  TransactionReplayMode,
  UpdateTransactionEvent,
  UserActionCompletedPayload
} from '@asyra/reactive-events'
import {
  EventTypes,
  endTransaction,
  publishEvent,
  runInTransactionReplayMode,
  startTransaction,
  userActionCompleted,
  updateUndoRedoStatus
} from '@asyra/reactive-events'
import type { SharedDataChannelRegistry } from './shared-data-channel'
import {
  TransactionRollbackError,
  TransactionValidationError,
  type TransactionInverter,
  type TransactionValidationContext,
  type TransactionValidator
} from './transaction'

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
    inverted.values[key] = {
      before: change.after,
      after: change.before
    }
  })

  Object.entries(patch.records ?? {}).forEach(([key, recordPatch]) => {
    const nextRecordPatch: NonNullable<
      ComputedDataPatchChange['records']
    >[string] = {}

    Object.entries(recordPatch.set ?? {}).forEach(([recordId, change]) => {
      if (change.before === undefined) {
        nextRecordPatch.remove ??= {}
        nextRecordPatch.remove[recordId] = {
          before: change.after
        }
        return
      }

      nextRecordPatch.set ??= {}
      nextRecordPatch.set[recordId] = {
        before: change.after,
        after: change.before
      }
    })

    Object.entries(recordPatch.remove ?? {}).forEach(([recordId, change]) => {
      nextRecordPatch.set ??= {}
      nextRecordPatch.set[recordId] = {
        after: change.before
      }
    })

    if (
      Object.keys(nextRecordPatch.set ?? {}).length > 0 ||
      Object.keys(nextRecordPatch.remove ?? {}).length > 0
    ) {
      inverted.records ??= {}
      inverted.records[key] = nextRecordPatch
    }
  })

  return inverted
}

const cloneEvent = (event: AllEvent): AllEvent =>
  JSON.parse(JSON.stringify(event)) as AllEvent

const toReplayFailure = (cause: unknown): TransactionFailure => ({
  kind: 'explicit',
  message: cause instanceof Error ? cause.message : undefined,
  cause
})

class DataTransact {
  private journal: TransactionJournalEntry[] = []
  private undoStack: AllEvent[][] = []
  private redoStack: AllEvent[][] = []
  private isTransacting = 0
  private inUndo = false
  private inRedo = false
  private nestedReplaySourceEvents: AllEvent[] | null = null
  private actionId = 0
  private transactionId = 0
  private currentTransactionId = 0
  private rollbackOnly = false
  private rollbackFailure: TransactionFailure | undefined
  private readonly inverters = new Map<string, TransactionInverter>()
  private readonly validators = new Map<string, TransactionValidator>()
  private readonly onStatus?: (payload: TransactionStatusPayload) => void
  private readonly onUserActionCompleted?: (
    payload: UserActionCompletedPayload
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
  }

  start() {
    this.isTransacting++
    if (this.isTransacting > 1) {
      return
    }

    this.journal = []
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
    if (this.isTransacting <= 0) {
      return
    }

    const payload = event.payload as TransactionPayload
    const newType = event.eventName as AllEvent['type']
    const newPayload = JSON.parse(JSON.stringify(payload))
    const newEvent: AllEvent = {
      type: newType,
      payload: newPayload
    }

    const options: EffectiveMutationOptions = {
      undoable: event.options?.undoable !== false,
      rollbackable: event.options?.rollbackable !== false,
      shared: event.options?.shared,
      sharedDelivery: event.options?.sharedDelivery ?? 'transaction-end'
    }
    if (
      options.rollbackable &&
      !this.hasInverseContract(event.eventName, payload)
    ) {
      throw new Error(
        `Rollbackable transaction event ${event.eventName} requires an inverter`
      )
    }
    const journalEntry: TransactionJournalEntry = {
      event: newEvent,
      options
    }

    const sharedChannelName = event.options?.shared
    if (sharedChannelName) {
      const sharedChange = toSharedChannelPayload(payload, event.options)
      const shouldDeliverImmediately =
        event.options?.undoable === false ||
        event.options?.sharedDelivery === 'immediate'
      journalEntry.shared = {
        name: sharedChannelName,
        change: sharedChange,
        delivered: false
      }
      if (shouldDeliverImmediately) {
        journalEntry.shared.delivered =
          this.sharedDataChannelRegistry.pushToSharedChannel(
            sharedChannelName,
            sharedChange
          )
      }
    }

    this.journal.push(journalEntry)
  }

  private createReplayEvents(
    event: AllEvent,
    direction: 'forward' | 'inverse'
  ): AllEvent[] {
    if (direction === 'inverse') {
      const customInverter = this.inverters.get(event.type)
      if (customInverter) {
        const result = customInverter(cloneEvent(event))
        return (Array.isArray(result) ? result : [result]).map((item) =>
          cloneEvent(item)
        )
      }
    }

    const replayEvent = cloneEvent(event)
    const payload = (replayEvent as AllEvent & { payload: unknown }).payload
    if (payload && typeof payload === 'object' && 'changes' in payload) {
      const changes = payload.changes
      if (Array.isArray(changes)) {
        const { changes: _changes, ...basePayload } = payload
        const scalarBasePayload =
          (basePayload as { action?: unknown }).action ===
          SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_BATCH
            ? {
                ...basePayload,
                action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA
              }
            : basePayload
        const orderedChanges =
          direction === 'inverse' ? [...changes].reverse() : changes
        return orderedChanges.map((change) => {
          const typedChange = change as {
            key: string
            before: unknown
            after: unknown
          }
          return {
            type: replayEvent.type,
            payload: {
              ...scalarBasePayload,
              key: typedChange.key,
              before:
                direction === 'inverse'
                  ? typedChange.after
                  : typedChange.before,
              after:
                direction === 'inverse' ? typedChange.before : typedChange.after
            }
          } as AllEvent
        })
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
      replayEvent.type = payload.undoType as AllEvent['type']
    }
    if ('undoAction' in payload && payload.undoAction !== undefined) {
      ;(payload as { action?: unknown }).action = payload.undoAction
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

  private replay(
    events: readonly AllEvent[],
    direction: 'forward' | 'inverse',
    mode: TransactionReplayMode
  ): unknown[] {
    const failures: unknown[] = []
    const orderedEvents =
      direction === 'inverse' ? [...events].reverse() : events

    orderedEvents.forEach((event) => {
      try {
        this.createReplayEvents(event, direction).forEach((replayEvent) => {
          runInTransactionReplayMode(mode, () => publishEvent(replayEvent))
        })
      } catch (error) {
        failures.push(error)
      }
    })

    return failures
  }

  private rollbackJournal(): unknown[] {
    const rollbackableEvents = this.journal
      .filter(({ options }) => options.rollbackable)
      .map(({ event }) => event)
    return this.replay(rollbackableEvents, 'inverse', 'rollback')
  }

  private compensateImmediateSharedChanges(): unknown[] {
    const failures: unknown[] = []

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
          (inverseEvent) => {
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
          }
        )
      } catch (error) {
        failures.push(error)
      }
    })

    return failures
  }

  private transactionOrigin(): TransactionOrigin {
    if (this.isInUndo()) {
      return 'undo'
    }
    if (this.isInRedo()) {
      return 'redo'
    }
    return 'action'
  }

  private emitStatus(
    status: TransactionStatus,
    failure?: TransactionFailure,
    error?: unknown
  ) {
    this.onStatus?.({
      transactionId: this.currentTransactionId,
      origin: this.transactionOrigin(),
      status,
      ...this.validationContext(),
      ...(failure ? { failure } : {}),
      ...(error !== undefined ? { error } : {}),
      timestamp: Date.now()
    })
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

  private ensureReplayTransactionId() {
    if (this.isTransacting > 0) {
      return
    }
    this.transactionId += 1
    this.currentTransactionId = this.transactionId
  }

  private settleRollback(failure?: TransactionFailure) {
    if (this.journal.length === 0) {
      this.emitStatus('discarded', failure)
      return
    }

    const failures = [
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
              this.emitReplayCommitted(this.nestedReplaySourceEvents)
            } else if (!this.isInUndo() && !this.isInRedo()) {
              this.emitStatus('discarded')
            }
          } else {
            this.commitUndo()
            this.flushPendingSharedChannelChanges()
            if (this.nestedReplaySourceEvents) {
              this.emitReplayCommitted(this.nestedReplaySourceEvents)
            } else if (!this.isInUndo() && !this.isInRedo()) {
              this.emitStatus('committed')
            }
          }
        }
      } finally {
        this.journal = []
        this.rollbackOnly = false
        this.rollbackFailure = undefined
        if (this.nestedReplaySourceEvents) {
          this.nestedReplaySourceEvents = null
          this.inUndo = false
          this.inRedo = false
        }
      }
    }
  }

  flushPendingSharedChannelChanges() {
    this.journal.forEach(({ shared }) => {
      if (shared && !shared.delivered) {
        shared.delivered = this.sharedDataChannelRegistry.pushToSharedChannel(
          shared.name,
          shared.change
        )
      }
    })
  }

  commitUndo() {
    // If changes are coming from Undo or Redo events, they should not push back to list again
    const committedChanges = this.journal
      .filter(({ options }) => options.undoable)
      .map(({ event }) => event)
    if (!this.isInUndo() && !this.isInRedo() && committedChanges.length > 0) {
      this.undoStack.push(committedChanges)
      this.redoStack = []

      this.actionId += 1
      this.onUserActionCompleted?.({
        actionId: this.actionId,
        changeCount: committedChanges.length,
        timestamp: Date.now()
      })
    }
  }

  undo() {
    if (!this.undoStack.length) {
      return
    }

    const hasOuterBoundary = this.isTransacting > 0
    if (hasOuterBoundary && this.journal.length > 0) {
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

      if (hasOuterBoundary) {
        this.nestedReplaySourceEvents = lastChanges
      }
      const failures = this.replay(lastChanges, 'inverse', 'undo')
      if (failures.length > 0) {
        throw new TransactionRollbackError(failures)
      }

      this.undoStack.pop()
      this.redoStack.push(lastChanges)

      if (!hasOuterBoundary) {
        endTransaction()
        openedBoundary = false
        this.emitReplayCommitted(lastChanges)
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
    if (!this.redoStack.length) {
      return
    }

    const hasOuterBoundary = this.isTransacting > 0
    if (hasOuterBoundary && this.journal.length > 0) {
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

      if (hasOuterBoundary) {
        this.nestedReplaySourceEvents = lastChanges
      }
      const failures = this.replay(lastChanges, 'forward', 'redo')
      if (failures.length > 0) {
        throw new TransactionRollbackError(failures)
      }

      this.redoStack.pop()
      this.undoStack.push(lastChanges)
      if (!hasOuterBoundary) {
        endTransaction()
        openedBoundary = false
        this.emitReplayCommitted(lastChanges)
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
    this.journal = []
    this.undoStack = []
    this.redoStack = []
    this.isTransacting = 0
    this.inUndo = false
    this.inRedo = false
    this.nestedReplaySourceEvents = null
    this.actionId = 0
    this.transactionId = 0
    this.currentTransactionId = 0
    this.rollbackOnly = false
    this.rollbackFailure = undefined
  }

  reset() {
    this.dispose()
  }
}

export default DataTransact
