import * as Y from 'yjs'
import {
  runWithTransactionOwner,
  transactionStatusChanged,
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
import doc from './data'
import {
  SharedDataChannelRegistry,
  type SharedDataChannelChangeHandler,
  type SharedDataChannelName
} from './shared-data-channel'
import type { TransactionInverter, TransactionValidator } from './transaction'

export interface FactoryOptions {
  bridgeToReactiveEvents?: boolean
}

class Factory {
  private readonly sharedDataChannels = new SharedDataChannelRegistry()
  private readonly bridgeToReactiveEvents: boolean
  private readonly transactionOwner: TransactionOwner
  private readonly transactionStatusSubscribers = new Set<
    (payload: TransactionStatusPayload) => void
  >()
  transact: DataTransact

  constructor(options: FactoryOptions = {}) {
    this.bridgeToReactiveEvents = options.bridgeToReactiveEvents === true
    this.transact = new DataTransact(this.sharedDataChannels, {
      onStatus: (payload) => this.emitTransactionStatus(payload),
      onUserActionCompleted: this.bridgeToReactiveEvents
        ? userActionCompleted
        : undefined
    })
    this.transactionOwner = {
      startTransaction: () => this.startTransaction(),
      updateTransaction: (event) => this.updateTransaction(event),
      endTransaction: (endOptions) => this.endTransaction(endOptions),
      undo: () => this.undo(),
      redo: () => this.redo()
    }
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
    channel: Y.Array<unknown>
  ): void {
    this.sharedDataChannels.register(name, channel)
  }

  unregisterSharedDataChannel(name: SharedDataChannelName): boolean {
    return this.sharedDataChannels.unregister(name)
  }

  hasSharedDataChannel(name: SharedDataChannelName): boolean {
    return this.sharedDataChannels.has(name)
  }

  getYjsDataChannel(name: SharedDataChannelName): Y.Array<unknown> {
    return doc.getArray(name)
  }

  getSharedDataChannel(
    name: SharedDataChannelName
  ): Y.Array<unknown> | undefined {
    return this.sharedDataChannels.get(name)
  }

  getSharedDataChannelStrict(name: SharedDataChannelName): Y.Array<unknown> {
    return this.sharedDataChannels.import(name)
  }

  observeSharedDataChannel<TChange = unknown>(
    name: SharedDataChannelName,
    handler: SharedDataChannelChangeHandler<TChange>
  ): () => void {
    return this.sharedDataChannels.observe(name, handler)
  }
}

const factory = new Factory({ bridgeToReactiveEvents: true })
export default factory

export { Factory }
