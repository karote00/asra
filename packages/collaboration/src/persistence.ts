import * as Y from 'yjs'
import type { CollaborationProvider, ProviderFailure } from './provider'
import {
  applyInboundYjsUpdate,
  type YjsBinaryUpdate
} from './yjs-document'

export interface PersistedCollaborationUpdate extends YjsBinaryUpdate {
  readonly documentId: string
}

export interface CollaborationUpdatePersistence {
  append(update: PersistedCollaborationUpdate): Promise<void>
  load(documentId: string): Promise<readonly PersistedCollaborationUpdate[]>
  dispose?(): void | Promise<void>
}

export interface MemoryCollaborationUpdatePersistenceOptions {
  readonly appendFailure?: unknown
  readonly loadFailure?: unknown
}

const clonePersistedUpdate = (
  update: PersistedCollaborationUpdate
): PersistedCollaborationUpdate =>
  Object.freeze({
    documentId: update.documentId,
    operationId: update.operationId,
    update: update.update.slice()
  })

export class MemoryCollaborationUpdatePersistence
  implements CollaborationUpdatePersistence
{
  private readonly updates = new Map<
    string,
    PersistedCollaborationUpdate[]
  >()
  private disposed = false

  constructor(
    private readonly options: MemoryCollaborationUpdatePersistenceOptions = {}
  ) {}

  async append(update: PersistedCollaborationUpdate): Promise<void> {
    this.requireUsable()
    if (this.options.appendFailure !== undefined) {
      throw this.options.appendFailure
    }
    const records = this.updates.get(update.documentId) ?? []
    records.push(clonePersistedUpdate(update))
    this.updates.set(update.documentId, records)
  }

  async load(
    documentId: string
  ): Promise<readonly PersistedCollaborationUpdate[]> {
    this.requireUsable()
    if (this.options.loadFailure !== undefined) throw this.options.loadFailure
    return Object.freeze(
      (this.updates.get(documentId) ?? []).map(clonePersistedUpdate)
    )
  }

  dispose(): void {
    this.disposed = true
    this.updates.clear()
  }

  private requireUsable(): void {
    if (this.disposed) {
      throw new Error('[collaboration] update persistence is disposed')
    }
  }
}

export type CollaborationDurabilityPhase =
  | 'runtime-committed'
  | 'locally-persisted'
  | 'persistence-skipped'
  | 'persistence-failed'
  | 'network-sent'
  | 'network-skipped'
  | 'network-failed'
  | 'network-converged'
  | 'durable-acknowledged'
  | 'acknowledgement-failed'

export interface CollaborationDurabilityEvent {
  readonly operationId: string
  readonly phase: CollaborationDurabilityPhase
  readonly error?: unknown
}

export interface CollaborationDurabilityOutcome {
  readonly operationId: string
  readonly phases: readonly CollaborationDurabilityPhase[]
  readonly events: readonly CollaborationDurabilityEvent[]
}

export interface CollaborationDurabilityRuntimeOptions {
  readonly document: Y.Doc
  readonly documentId: string
  readonly persistence?: CollaborationUpdatePersistence
  readonly provider?: CollaborationProvider
}

export class CollaborationDurabilityRuntime {
  private readonly document: Y.Doc
  private readonly documentId: string
  private readonly persistence?: CollaborationUpdatePersistence
  private readonly provider?: CollaborationProvider
  private readonly subscribers = new Set<
    (event: CollaborationDurabilityEvent) => void
  >()
  private readonly pendingAcknowledgements = new Set<string>()
  private readonly sentOperations = new Set<string>()
  private readonly detachAcknowledgement?: () => void

  constructor(options: CollaborationDurabilityRuntimeOptions) {
    this.document = options.document
    this.documentId = options.documentId
    this.persistence = options.persistence
    this.provider = options.provider
    this.detachAcknowledgement = options.provider?.onAcknowledgement(
      (acknowledgement) => {
        if (this.sentOperations.has(acknowledgement.operationId)) {
          this.emit(acknowledgement.operationId, 'durable-acknowledged')
        } else {
          this.pendingAcknowledgements.add(acknowledgement.operationId)
        }
      }
    )
  }

  observe(
    subscriber: (event: CollaborationDurabilityEvent) => void
  ): () => void {
    this.subscribers.add(subscriber)
    return () => this.subscribers.delete(subscriber)
  }

  async settleLocalUpdate(
    update: YjsBinaryUpdate
  ): Promise<CollaborationDurabilityOutcome> {
    const events: CollaborationDurabilityEvent[] = []
    const record = (
      phase: CollaborationDurabilityPhase,
      error?: unknown
    ): void => {
      events.push(this.emit(update.operationId, phase, error))
    }

    record('runtime-committed')
    if (!this.persistence) {
      record('persistence-skipped')
    } else {
      try {
        await this.persistence.append({
          documentId: this.documentId,
          operationId: update.operationId,
          update: update.update.slice()
        })
        record('locally-persisted')
      } catch (error) {
        record('persistence-failed', error)
      }
    }

    if (!this.provider) {
      record('network-skipped')
    } else {
      try {
        await this.provider.sendUpdate(update)
        this.sentOperations.add(update.operationId)
        record('network-sent')
        if (this.pendingAcknowledgements.delete(update.operationId)) {
          record('durable-acknowledged')
        }
      } catch (error) {
        const failure = error as ProviderFailure
        if (failure?.code === 'acknowledgement-failed') {
          this.sentOperations.add(update.operationId)
          record('network-sent')
          record('acknowledgement-failed', failure.cause ?? failure)
        } else {
          record('network-failed', error)
        }
      }
    }

    return Object.freeze({
      operationId: update.operationId,
      phases: Object.freeze(events.map((event) => event.phase)),
      events: Object.freeze(events)
    })
  }

  async recoverFromPersistence(): Promise<readonly unknown[]> {
    if (!this.persistence) return Object.freeze([])
    const recovered: unknown[] = []
    for (const record of await this.persistence.load(this.documentId)) {
      const decoded = applyInboundYjsUpdate(
        this.document,
        record.update,
        'persistence'
      )
      recovered.push(...decoded.operations)
    }
    return Object.freeze(recovered)
  }

  async synchronizeWithProvider(): Promise<
    Readonly<{
      receivedOperationCount: number
      sentUpdateByteLength: number
    }>
  > {
    if (!this.provider) {
      return Object.freeze({
        receivedOperationCount: 0,
        sentUpdateByteLength: 0
      })
    }
    const exchange = await this.provider.exchangeStateVector(
      Y.encodeStateVector(this.document)
    )
    const decoded = applyInboundYjsUpdate(
      this.document,
      exchange.missingRemoteUpdate,
      'provider'
    )
    const missingLocalUpdate = Y.encodeStateAsUpdate(
      this.document,
      exchange.remoteStateVector
    )
    await this.provider.sendSyncUpdate(missingLocalUpdate)
    this.emit(this.documentId, 'network-converged')
    return Object.freeze({
      receivedOperationCount: decoded.operations.length,
      sentUpdateByteLength: missingLocalUpdate.byteLength
    })
  }

  dispose(): void {
    this.detachAcknowledgement?.()
    this.subscribers.clear()
    this.pendingAcknowledgements.clear()
    this.sentOperations.clear()
  }

  private emit(
    operationId: string,
    phase: CollaborationDurabilityPhase,
    error?: unknown
  ): CollaborationDurabilityEvent {
    const event = Object.freeze({
      operationId,
      phase,
      ...(error !== undefined ? { error } : {})
    })
    ;[...this.subscribers].forEach((subscriber) => {
      try {
        subscriber(Object.freeze({ ...event }))
      } catch {
        // Durability observers cannot change collaboration settlement.
      }
    })
    return event
  }
}
