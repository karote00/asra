import {
  runTransaction,
  runWithTransactionOwner,
  transactionStatusChanged,
  type AllEvent,
  type TransactionReplayMode,
  type TransactionOwner,
  userActionCompleted,
  type UpdateTransactionEvent
} from '@asyra/reactive-events'
import type {
  EndTransactionOptions,
  TransactionStatus,
  TransactionStatusPayload
} from '@asyra/utils'
import { measureBrowserDragPhase } from '@asyra/utils'
import DataTransact from './data-transact'
import {
  LocalSharedDataChannel,
  SharedDataChannelRegistry,
  type SharedDataChannel,
  type SharedDataChannelBatchChangeHandler,
  type SharedDataChannelChangeHandler,
  type SharedDataChannelName
} from './shared-data-channel'
import {
  type SharedDeliveryBatch,
  type SharedDeliveryBatchSubscriber,
  type SharedPublication,
  type SharedPublicationSubscriber
} from './shared-delivery'
import type { FactoryMutationBatchDeliveryHandle } from './mutation-batch'
import type {
  CanonicalEventApply,
  TransactionInverter,
  TransactionReplayHandler,
  TransactionValidator
} from './transaction'

export interface FactoryOptions {
  bridgeToReactiveEvents?: boolean
}

export interface FactoryTransactionOwner extends TransactionOwner {
  updateTransactionBatch(
    events: readonly UpdateTransactionEvent[]
  ): FactoryMutationBatchDeliveryHandle | null
}

class RemoteAsyncHandlerError extends Error {
  constructor() {
    super('[collaboration] remote canonical apply handler must be synchronous')
    this.name = 'RemoteAsyncHandlerError'
  }
}

class Factory {
  private readonly sharedDataChannels = new SharedDataChannelRegistry()
  private readonly bridgeToReactiveEvents: boolean
  private readonly transactionOwner: FactoryTransactionOwner
  private readonly transactionStatusSubscribers = new Set<
    (payload: TransactionStatusPayload) => void
  >()
  private readonly commitCaptureSubscribers = new Set<
    (payload: TransactionStatusPayload) => void
  >()
  private readonly sharedDeliveryBatchSubscribers =
    new Set<SharedDeliveryBatchSubscriber>()
  private readonly sharedPublicationSubscribers =
    new Set<SharedPublicationSubscriber>()
  private readonly transactionReplayHandlers = new Map<
    string,
    TransactionReplayHandler
  >()
  transact: DataTransact

  constructor(options: FactoryOptions = {}) {
    this.bridgeToReactiveEvents = options.bridgeToReactiveEvents === true
    this.transact = new DataTransact(this.sharedDataChannels, {
      onCommitCapture: (payload) => this.emitCommitCapture(payload),
      onStatus: (payload) => this.emitTransactionStatus(payload),
      onUserActionCompleted: this.bridgeToReactiveEvents
        ? userActionCompleted
        : undefined,
      onReplayEvent: (event, mode) => this.handleReplayEvent(event, mode),
      onSharedDeliveryBatch: (batch) => this.emitSharedDeliveryBatch(batch),
      onSharedPublication: (publication) =>
        this.emitSharedPublication(publication)
    })
    this.transactionOwner = {
      startTransaction: () => this.startTransaction(),
      updateTransactionBatch: (events) => this.updateTransactionBatch(events),
      endTransaction: (endOptions) => this.endTransaction(endOptions),
      undo: () => this.undo(),
      redo: () => this.redo()
    }
  }

  private emitCommitCapture(payload: TransactionStatusPayload): void {
    ;[...this.commitCaptureSubscribers].forEach((subscriber) => {
      try {
        subscriber(Object.freeze({ ...payload }))
      } catch {
        // Persistence capture observers cannot alter canonical settlement.
      }
    })
  }

  private emitSharedDeliveryBatch(batch: SharedDeliveryBatch): void {
    ;[...this.sharedDeliveryBatchSubscribers].forEach((subscriber) => {
      try {
        subscriber(batch)
      } catch {
        // Collaboration observers cannot alter local canonical settlement.
      }
    })
  }

  private emitSharedPublication(publication: SharedPublication): boolean {
    return measureBrowserDragPhase('factory:notify-shared-publication', () => {
      const subscribers = [...this.sharedPublicationSubscribers]
      let handedOff = false
      subscribers.forEach((subscriber) => {
        try {
          subscriber(publication)
          handedOff = true
        } catch {
          // Collaboration observers cannot alter local canonical settlement.
        }
      })
      return handedOff
    })
  }

  private emitTransactionStatus(payload: TransactionStatusPayload) {
    ;[...this.transactionStatusSubscribers].forEach((subscriber) => {
      try {
        subscriber(payload)
      } catch {
        // Status observers cannot change or interrupt the canonical outcome.
      }
    })
    if (this.bridgeToReactiveEvents) {
      try {
        transactionStatusChanged(payload)
      } catch {
        // The default diagnostic bridge follows the same observer isolation.
      }
    }
  }

  startTransaction() {
    this.transact.start()
  }

  updateTransaction(event: UpdateTransactionEvent) {
    return this.updateTransactionBatch([event])
  }

  updateTransactionBatch(events: readonly UpdateTransactionEvent[]) {
    return this.transact.updateBatch(events)
  }

  endTransaction(options?: EndTransactionOptions) {
    this.transact.end(options)
  }

  runRemoteTransaction<T>(mutate: () => T): T {
    this.transact.start('remote')
    const reactiveBoundaryOwner: FactoryTransactionOwner = {
      startTransaction: () => undefined,
      updateTransactionBatch: (events) => this.updateTransactionBatch(events),
      endTransaction: () => undefined,
      undo: () => this.undo(),
      redo: () => this.redo()
    }

    return runWithTransactionOwner(reactiveBoundaryOwner, () =>
      runTransaction(
        () => {
          try {
            const result = mutate()
            if (
              result !== null &&
              (typeof result === 'object' || typeof result === 'function') &&
              typeof (result as { then?: unknown }).then === 'function'
            ) {
              void Promise.resolve(result).catch(() => undefined)
              throw new RemoteAsyncHandlerError()
            }
            this.transact.end()
            return result
          } catch (error) {
            this.transact.end({
              outcome: 'rollback',
              failure: {
                kind: 'handler-error',
                message: error instanceof Error ? error.message : undefined,
                cause: error
              }
            })
            throw error
          }
        },
        { failureKind: 'handler-error' }
      )
    )
  }

  applyRemoteEvent(event: AllEvent, apply: CanonicalEventApply): boolean {
    return this.transact.applyForwardEvent(event, apply)
  }

  isRemoteAsyncHandlerError(error: unknown): boolean {
    return error instanceof RemoteAsyncHandlerError
  }

  undo() {
    return runWithTransactionOwner(this.transactionOwner, () =>
      this.transact.undo()
    )
  }

  redo() {
    return runWithTransactionOwner(this.transactionOwner, () =>
      this.transact.redo()
    )
  }

  getTransactionOwner(): FactoryTransactionOwner {
    return this.transactionOwner
  }

  getActiveStagedDeliveryController() {
    return this.transact.getActiveStagedDeliveryController()
  }

  getUndoHistoryDepth(): number {
    return this.transact.getUndoHistoryDepth()
  }

  isInUndoRedo() {
    return this.transact.isInUndo() || this.transact.isInRedo()
  }

  registerTransactionInverter(
    eventName: string,
    inverter: TransactionInverter
  ) {
    this.transact.registerInverter(eventName, inverter)
  }

  registerTransactionReplayHandler(
    eventName: string,
    handler: TransactionReplayHandler
  ): () => void {
    if (this.transactionReplayHandlers.has(eventName)) {
      throw new Error(
        `Transaction replay handler is already registered for ${eventName}`
      )
    }
    this.transactionReplayHandlers.set(eventName, handler)
    return () => {
      if (this.transactionReplayHandlers.get(eventName) === handler) {
        this.transactionReplayHandlers.delete(eventName)
      }
    }
  }

  private handleReplayEvent(
    event: AllEvent,
    mode: TransactionReplayMode
  ): { handled: boolean; applied: boolean } {
    const handler = this.transactionReplayHandlers.get(event.type)
    if (!handler) {
      return { handled: false, applied: false }
    }
    const result = handler(event, mode)
    return { handled: true, applied: result !== false }
  }

  registerTransactionValidator(name: string, validator: TransactionValidator) {
    this.transact.registerValidator(name, validator)
  }

  subscribeToTransactionStatus(
    subscriber: (payload: TransactionStatusPayload) => void
  ): () => void {
    this.transactionStatusSubscribers.add(subscriber)
    return () => {
      this.transactionStatusSubscribers.delete(subscriber)
    }
  }

  subscribeToCommitCapture(
    subscriber: (payload: TransactionStatusPayload) => void
  ): () => void {
    this.commitCaptureSubscribers.add(subscriber)
    return () => {
      this.commitCaptureSubscribers.delete(subscriber)
    }
  }

  reportPersistenceStatus(
    source: TransactionStatusPayload,
    status: Extract<
      TransactionStatus,
      'persistence-skipped' | 'persisted' | 'persistence-failed'
    >,
    providerName?: string,
    error?: unknown
  ) {
    const {
      providerName: _sourceProviderName,
      error: _sourceError,
      ...base
    } = source
    this.emitTransactionStatus({
      ...base,
      status,
      ...(providerName ? { providerName } : {}),
      ...(error !== undefined ? { error } : {}),
      timestamp: Date.now()
    })
  }

  registerSharedDataChannel(
    name: SharedDataChannelName,
    channel: SharedDataChannel
  ): void {
    this.sharedDataChannels.register(name, channel)
  }

  unregisterSharedDataChannel(name: SharedDataChannelName): boolean {
    return this.sharedDataChannels.unregister(name)
  }

  hasSharedDataChannel(name: SharedDataChannelName): boolean {
    return this.sharedDataChannels.has(name)
  }

  createLocalSharedDataChannel(): LocalSharedDataChannel {
    return new LocalSharedDataChannel()
  }

  getSharedDataChannel(
    name: SharedDataChannelName
  ): SharedDataChannel | undefined {
    return this.sharedDataChannels.get(name)
  }

  getSharedDataChannelStrict(name: SharedDataChannelName): SharedDataChannel {
    return this.sharedDataChannels.import(name)
  }

  observeSharedDataChannel<TChange = unknown>(
    name: SharedDataChannelName,
    handler: SharedDataChannelChangeHandler<TChange>
  ): () => void {
    return this.sharedDataChannels.observe(name, handler)
  }

  observeSharedDataChannelBatch<TChange = unknown>(
    name: SharedDataChannelName,
    handler: SharedDataChannelBatchChangeHandler<TChange>
  ): () => void {
    return this.sharedDataChannels.observeBatch(name, handler)
  }

  subscribeToSharedDeliveryBatch(
    subscriber: SharedDeliveryBatchSubscriber
  ): () => void {
    this.sharedDeliveryBatchSubscribers.add(subscriber)
    return () => {
      this.sharedDeliveryBatchSubscribers.delete(subscriber)
    }
  }

  subscribeToSharedPublication(
    subscriber: SharedPublicationSubscriber
  ): () => void {
    this.sharedPublicationSubscribers.add(subscriber)
    return () => {
      this.sharedPublicationSubscribers.delete(subscriber)
    }
  }
}

const factory = new Factory({ bridgeToReactiveEvents: true })
export default factory

export { Factory }
