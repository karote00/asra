import * as Y from 'yjs'
import type { Provider, ProviderFailure } from './provider'
import type { UpdatePersistence } from './persistence'
import { applyInboundYjsUpdate, type YjsBinaryUpdate } from './yjs-document'

export type DurabilityPhase =
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

export interface DurabilityEvent {
  readonly operationId: string
  readonly phase: DurabilityPhase
  readonly error?: unknown
}

export interface DurabilityOutcome {
  readonly operationId: string
  readonly phases: readonly DurabilityPhase[]
  readonly events: readonly DurabilityEvent[]
}

export interface DurabilityOptions {
  readonly document: Y.Doc
  readonly documentId: string
  readonly persistence?: UpdatePersistence
  readonly provider?: Provider
}

export class Durability {
  private readonly document: Y.Doc
  private readonly documentId: string
  private readonly persistence?: UpdatePersistence
  private readonly provider?: Provider
  private readonly subscribers = new Set<(event: DurabilityEvent) => void>()
  private readonly pendingAcknowledgements = new Set<string>()
  private readonly sentOperations = new Set<string>()
  private detachAcknowledgement?: () => void
  private started = false

  constructor(options: DurabilityOptions) {
    this.document = options.document
    this.documentId = options.documentId
    this.persistence = options.persistence
    this.provider = options.provider
  }

  start(): void {
    if (this.started) return
    this.started = true
    this.detachAcknowledgement = this.provider?.onAcknowledgement(
      (acknowledgement) => {
        if (this.sentOperations.has(acknowledgement.operationId)) {
          this.emit(acknowledgement.operationId, 'durable-acknowledged')
        } else {
          this.pendingAcknowledgements.add(acknowledgement.operationId)
        }
      }
    )
  }

  observe(subscriber: (event: DurabilityEvent) => void): () => void {
    this.subscribers.add(subscriber)
    return () => this.subscribers.delete(subscriber)
  }

  async settleLocalUpdate(update: YjsBinaryUpdate): Promise<DurabilityOutcome> {
    this.start()
    const events: DurabilityEvent[] = []
    const record = (phase: DurabilityPhase, error?: unknown): void => {
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
    this.start()
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
      receivedOperations: readonly unknown[]
      sentUpdateByteLength: number
    }>
  > {
    this.start()
    if (!this.provider) {
      return Object.freeze({
        receivedOperationCount: 0,
        receivedOperations: Object.freeze([]),
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
      receivedOperations: decoded.operations,
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
    phase: DurabilityPhase,
    error?: unknown
  ): DurabilityEvent {
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
