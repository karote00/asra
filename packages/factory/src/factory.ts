import {
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
import DataTransact from './data-transact'
import {
  LocalSharedDataChannel,
  SharedDataChannelRegistry,
  type SharedDataChannel,
  type SharedDataChannelChangeHandler,
  type SharedDataChannelName
} from './shared-data-channel'
import {
  cloneSharedDelivery,
  type SharedDelivery,
  type SharedDeliverySubscriber
} from './shared-delivery'
import type {
  TransactionInverter,
  TransactionReplayHandler,
  TransactionValidator
} from './transaction'

export interface FactoryOptions {
  bridgeToReactiveEvents?: boolean
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
  private readonly transactionOwner: TransactionOwner
  private readonly transactionStatusSubscribers = new Set<
    (payload: TransactionStatusPayload) => void
  >()
  private readonly sharedDeliverySubscribers =
    new Set<SharedDeliverySubscriber>()
  private readonly transactionReplayHandlers = new Map<
    string,
    TransactionReplayHandler
  >()
  transact: DataTransact

  constructor(options: FactoryOptions = {}) {
    this.bridgeToReactiveEvents = options.bridgeToReactiveEvents === true
    this.transact = new DataTransact(this.sharedDataChannels, {
      onStatus: (payload) => this.emitTransactionStatus(payload),
      onUserActionCompleted: this.bridgeToReactiveEvents
        ? userActionCompleted
        : undefined,
      onReplayEvent: (event, mode) => this.handleReplayEvent(event, mode),
      onSharedDelivery: (delivery) => this.emitSharedDelivery(delivery)
    })
    this.transactionOwner = {
      startTransaction: () => this.startTransaction(),
      updateTransaction: (event) => this.updateTransaction(event),
      endTransaction: (endOptions) => this.endTransaction(endOptions),
      undo: () => this.undo(),
      redo: () => this.redo()
    }
  }

  private emitSharedDelivery(delivery: SharedDelivery): void {
    ;[...this.sharedDeliverySubscribers].forEach((subscriber) => {
      try {
        subscriber(cloneSharedDelivery(delivery))
      } catch {
        // Collaboration observers cannot alter local canonical settlement.
      }
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
    this.transact.update(event)
  }

  endTransaction(options?: EndTransactionOptions) {
    this.transact.end(options)
  }

  runRemoteTransaction<T>(mutate: () => T): T {
    this.transact.start('remote')
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
      try {
        this.transact.end({
          outcome: 'rollback',
          failure: {
            kind: 'handler-error',
            message: error instanceof Error ? error.message : undefined,
            cause: error
          }
        })
      } catch (rollbackError) {
        throw rollbackError
      }
      throw error
    }
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

  getTransactionOwner(): TransactionOwner {
    return this.transactionOwner
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

  subscribeToSharedDelivery(subscriber: SharedDeliverySubscriber): () => void {
    this.sharedDeliverySubscribers.add(subscriber)
    return () => {
      this.sharedDeliverySubscribers.delete(subscriber)
    }
  }
}

const factory = new Factory({ bridgeToReactiveEvents: true })
export default factory

export { Factory }
