import {
  ProviderFailure,
  createProviderIdentitySnapshot,
  isProviderFailureCode,
  type Provider,
  type ProviderAwarenessDisconnect,
  type ProviderAwarenessMessage,
  type ProviderIdentity,
  type ProviderStatus
} from '@asyra/collaboration'
import type { SharedPublication } from '@asyra/core'
import {
  emitDiagnosticCounter,
  emitBrowserDragPhase,
  measureBrowserDragAsyncPhase
} from '@asyra/utils'
import {
  CollaborationMessageTypes,
  type CollaborationRequestInput,
  type CollaborationRequestMessage,
  type DocumentSessionBootstrap
} from './protocol'
import type {
  CollaborationTransportWorkerLike,
  CollaborationTransportWorkerRequest,
  CollaborationTransportWorkerResponse
} from './collaboration-transport-worker'

type Subscriber<T> = (value: T) => void
type PublicationConsumer = (publication: SharedPublication) => Promise<void>

export interface DocumentSourcePublicationAcceptance {
  readonly publicationId: string
  readonly sequence: number
}

interface PendingControlRequest {
  readonly kind: 'control'
  resolve(value: unknown): void
  reject(error: unknown): void
}

interface PendingPublicationRequest {
  readonly kind: 'publication'
  readonly publication: SharedPublication
  readonly consumeAcceptedSource: PublicationConsumer
  resolve(value: DocumentSourcePublicationAcceptance): void
  reject(error: unknown): void
}

type PendingRequest = PendingControlRequest | PendingPublicationRequest

interface PendingConnection {
  readonly generation: number
  resolve(): void
  reject(failure: ProviderFailure): void
}

interface PendingDisconnect {
  readonly generation: number
  resolve(): void
}

interface PublicationCapacityWaiter {
  readonly generation: number
  resolve(): void
  reject(failure: ProviderFailure): void
}

interface ActivePublicationDelivery {
  readonly deliveryId: string
  readonly generation: number
  readonly publication: SharedPublication
  readonly sequence: number
  state: 'awaiting-consumer' | 'applying'
}

interface SequencedSourceAcceptance {
  readonly acceptance: DocumentSourcePublicationAcceptance
  readonly generation: number
  readonly pending: PendingPublicationRequest
  state: 'awaiting-consumer' | 'applying'
}

interface TransportWorkerEvent {
  readonly data?: CollaborationTransportWorkerResponse
  readonly error?: unknown
}

type TransportWorkerListener = (event: TransportWorkerEvent) => void

interface TransportWorkerListeners {
  readonly onMessage: TransportWorkerListener
  readonly onFailure: TransportWorkerListener
}

export interface CollaborationWebSocketProviderOptions {
  readonly endpoint: string
  readonly identity: ProviderIdentity
  readonly connectionTimeoutMs?: number
  readonly transportWorkerFactory?: () => CollaborationTransportWorkerLike
}

const DEFAULT_DOCUMENT_SESSION_HANDSHAKE_TIMEOUT_MS = 5_000

const toFailure = (
  code: unknown,
  message: unknown,
  publicationId?: string,
  cause?: unknown
): ProviderFailure =>
  new ProviderFailure(
    isProviderFailureCode(code) ? code : 'transport-failed',
    typeof message === 'string' && message.trim()
      ? message
      : '[collaboration] WebSocket transport failed',
    cause,
    publicationId
  )

const recordWorkerTiming = (phase: string, durationMs: number): void => {
  if (!Number.isFinite(durationMs) || durationMs < 0) return
  emitBrowserDragPhase(phase, durationMs)
}

export class CollaborationWebSocketProvider implements Provider {
  readonly identity: ProviderIdentity

  private readonly endpoint: string
  private readonly connectionTimeoutMs: number
  private readonly transportWorkerFactory: () => CollaborationTransportWorkerLike
  private status: ProviderStatus = 'idle'
  private connectionGeneration = 0
  private requestSequence = 0
  private transportWorker: CollaborationTransportWorkerLike | null = null
  private transportWorkerGeneration = 0
  private transportWorkerListeners: TransportWorkerListeners | null = null
  private connectionTimeout: ReturnType<typeof setTimeout> | null = null
  private connectPromise: Promise<void> | null = null
  private pendingConnection: PendingConnection | null = null
  private documentSessionBootstrap: DocumentSessionBootstrap | null = null
  private documentBootstrapCompleted = false
  private appliedDocumentSequence: number | null = null
  private bootstrapCompletionPromise: Promise<void> | null = null
  private disconnectPromise: Promise<void> | null = null
  private pendingDisconnect: PendingDisconnect | null = null
  private readonly pendingRequests = new Map<string, PendingRequest>()
  private publicationCapacityReserved = false
  private readonly publicationCapacityWaiters: PublicationCapacityWaiter[] = []
  private publicationConsumer: PublicationConsumer | null = null
  private activePublicationDelivery: ActivePublicationDelivery | null = null
  private deferredPublicationDelivery: Extract<
    CollaborationTransportWorkerResponse,
    { type: 'publication-delivery' }
  > | null = null
  private sourcePublicationAcceptance: SequencedSourceAcceptance | null = null
  private suppressedAppFailureGeneration: number | null = null
  private readonly statusSubscribers = new Set<Subscriber<ProviderStatus>>()
  private readonly awarenessSubscribers = new Set<
    Subscriber<ProviderAwarenessMessage>
  >()
  private readonly awarenessDisconnectSubscribers = new Set<
    Subscriber<ProviderAwarenessDisconnect>
  >()
  private readonly failureSubscribers = new Set<Subscriber<ProviderFailure>>()

  constructor(options: CollaborationWebSocketProviderOptions) {
    this.endpoint = options.endpoint
    this.identity = createProviderIdentitySnapshot(options.identity)
    this.connectionTimeoutMs =
      options.connectionTimeoutMs ??
      DEFAULT_DOCUMENT_SESSION_HANDSHAKE_TIMEOUT_MS
    if (
      !Number.isFinite(this.connectionTimeoutMs) ||
      this.connectionTimeoutMs <= 0
    ) {
      throw new Error(
        '[collaboration] document-session handshake timeout must be positive'
      )
    }
    this.transportWorkerFactory =
      options.transportWorkerFactory ??
      (() =>
        new Worker(
          new URL('./collaboration-transport-worker.ts', import.meta.url),
          { type: 'module' }
        ) as unknown as CollaborationTransportWorkerLike)
  }

  async connect(): Promise<void> {
    await this.openDocumentSession()
    await this.completeDocumentBootstrap()
  }

  async openDocumentSession(): Promise<DocumentSessionBootstrap> {
    await this.connectTransport()
    if (!this.documentSessionBootstrap) {
      throw new ProviderFailure(
        'connection-failed',
        '[collaboration] document-session bootstrap is unavailable'
      )
    }
    return this.documentSessionBootstrap
  }

  completeDocumentBootstrap(): Promise<void> {
    this.requireConnected()
    if (this.documentBootstrapCompleted) return Promise.resolve()
    if (this.bootstrapCompletionPromise) return this.bootstrapCompletionPromise
    const bootstrap = this.documentSessionBootstrap
    if (!bootstrap) {
      return Promise.reject(
        new ProviderFailure(
          'connection-failed',
          '[collaboration] document-session bootstrap is unavailable'
        )
      )
    }
    this.appliedDocumentSequence = bootstrap.headSequence
    const completion = this.request(
      {
        type: CollaborationMessageTypes.BOOTSTRAP_CONSUMED,
        headSequence: bootstrap.headSequence
      },
      this.connectionGeneration
    )
      .then(() => {
        this.documentBootstrapCompleted = true
      })
      .catch((error) => {
        this.appliedDocumentSequence = null
        throw error
      })
      .finally(() => {
        if (this.bootstrapCompletionPromise === completion) {
          this.bootstrapCompletionPromise = null
        }
      })
    this.bootstrapCompletionPromise = completion
    return completion
  }

  private connectTransport(): Promise<void> {
    this.requireUsable()
    if (this.status === 'connected') return Promise.resolve()
    if (this.connectPromise) return this.connectPromise

    const generation = ++this.connectionGeneration
    this.suppressedAppFailureGeneration = null
    this.documentSessionBootstrap = null
    this.documentBootstrapCompleted = false
    this.appliedDocumentSequence = null
    this.bootstrapCompletionPromise = null
    this.setStatus('connecting')

    try {
      this.startTransportWorker(generation)
    } catch (error) {
      const failure = new ProviderFailure(
        'connection-failed',
        '[collaboration] collaboration transport worker construction failed',
        error
      )
      this.setStatus('failed')
      this.emit(this.failureSubscribers, failure)
      return Promise.reject(failure)
    }

    this.connectPromise = new Promise<void>((resolve, reject) => {
      this.pendingConnection = {
        generation,
        resolve,
        reject
      }
    })
    const connection = this.connectPromise

    try {
      this.postToTransportWorker({
        type: 'connect',
        generation,
        endpoint: this.endpoint,
        identity: this.identity
      })
    } catch (error) {
      this.failTransportWorker(
        new ProviderFailure(
          'connection-failed',
          '[collaboration] collaboration transport worker connect failed',
          error
        ),
        generation
      )
    }
    this.startConnectionTimeout(generation)

    return connection
  }

  async disconnect(): Promise<void> {
    this.requireUsable()
    if (this.disconnectPromise) return this.disconnectPromise

    const generation = this.connectionGeneration
    const worker = this.transportWorker
    const failure = new ProviderFailure(
      'not-connected',
      '[collaboration] provider disconnected before request completion'
    )
    this.rejectPendingConnection(
      new ProviderFailure(
        'not-connected',
        '[collaboration] provider connection was cancelled'
      ),
      generation
    )
    this.rejectPending(failure)
    this.documentSessionBootstrap = null
    this.documentBootstrapCompleted = false
    this.appliedDocumentSequence = null
    this.bootstrapCompletionPromise = null
    this.setStatus('disconnected')

    if (!worker || this.transportWorkerGeneration !== generation) {
      this.stopTransportWorker()
      return
    }

    this.disconnectPromise = new Promise<void>((resolve) => {
      this.pendingDisconnect = { generation, resolve }
    })
    const disconnection = this.disconnectPromise
    try {
      this.postToTransportWorker({
        type: 'disconnect',
        generation
      })
    } catch {
      this.resolvePendingDisconnect(generation)
      this.stopTransportWorker()
    }
    return disconnection
  }

  async reconnect(): Promise<void> {
    this.requireUsable()
    if (this.transportWorker) await this.disconnect()
    await this.connect()
  }

  async destroy(): Promise<void> {
    if (this.status === 'disposed') return

    const generation = this.connectionGeneration
    const disposedFailure = new ProviderFailure(
      'disposed',
      '[collaboration] provider is disposed'
    )
    this.setStatus('disposed')
    this.rejectPendingConnection(disposedFailure, generation)
    this.rejectPending(disposedFailure)
    this.documentSessionBootstrap = null
    this.documentBootstrapCompleted = false
    this.appliedDocumentSequence = null
    this.bootstrapCompletionPromise = null
    this.resolvePendingDisconnect(generation)

    if (this.transportWorker && this.transportWorkerGeneration === generation) {
      try {
        this.postToTransportWorker({
          type: 'destroy',
          generation
        })
      } catch {
        // Termination below remains the authoritative teardown boundary.
      }
    }
    this.stopTransportWorker()
    this.statusSubscribers.clear()
    this.publicationConsumer = null
    this.awarenessSubscribers.clear()
    this.awarenessDisconnectSubscribers.clear()
    this.failureSubscribers.clear()
  }

  getStatus(): ProviderStatus {
    return this.status
  }

  onStatusChange(subscriber: Subscriber<ProviderStatus>): () => void {
    return this.subscribe(this.statusSubscribers, subscriber)
  }

  async sendPublication(publication: SharedPublication): Promise<void> {
    await this.sendPublicationWithAcceptance(publication, async () => undefined)
  }

  async sendPublicationWithAcceptance(
    publication: SharedPublication,
    consumeAcceptedSource: PublicationConsumer
  ): Promise<DocumentSourcePublicationAcceptance> {
    this.requireDocumentSessionLive()
    const generation = this.connectionGeneration
    await this.acquirePublicationCapacity(generation)
    try {
      return await measureBrowserDragAsyncPhase(
        'collaboration:outbound-send-to-acceptance',
        () =>
          this.request(
            {
              type: CollaborationMessageTypes.SEND_PUBLICATION,
              publication
            },
            generation,
            consumeAcceptedSource
          ) as Promise<DocumentSourcePublicationAcceptance>
      )
    } catch (error) {
      if (!this.transportWorker || this.status !== 'connected') {
        this.releasePublicationCapacity()
      }
      throw error
    }
  }

  getAppliedDocumentSequence(): number | null {
    return this.appliedDocumentSequence
  }

  onPublication(consume: PublicationConsumer): () => void {
    this.requireUsable()
    if (this.publicationConsumer) {
      throw new Error(
        '[collaboration] an inbound publication consumer is already registered'
      )
    }
    this.publicationConsumer = consume
    this.consumeActivePublication()
    return () => {
      if (this.publicationConsumer === consume) {
        this.publicationConsumer = null
      }
    }
  }

  async sendAwareness(message: ProviderAwarenessMessage): Promise<void> {
    this.requireDocumentSessionLive()
    if (message.actorId !== this.identity.actorId) {
      const failure = new ProviderFailure(
        'invalid-awareness-actor',
        '[collaboration] awareness actor must match provider identity'
      )
      this.emit(this.failureSubscribers, failure)
      throw failure
    }
    await this.request(
      {
        type: CollaborationMessageTypes.SEND_AWARENESS,
        message
      },
      this.connectionGeneration
    )
  }

  async resetDocument(): Promise<void> {
    this.requireDocumentSessionLive()
    await this.request(
      {
        type: CollaborationMessageTypes.RESET_DOCUMENT
      },
      this.connectionGeneration
    )
  }

  onAwareness(subscriber: Subscriber<ProviderAwarenessMessage>): () => void {
    return this.subscribe(this.awarenessSubscribers, subscriber)
  }

  onAwarenessDisconnect(
    subscriber: Subscriber<ProviderAwarenessDisconnect>
  ): () => void {
    return this.subscribe(this.awarenessDisconnectSubscribers, subscriber)
  }

  onFailure(subscriber: Subscriber<ProviderFailure>): () => void {
    return this.subscribe(this.failureSubscribers, subscriber)
  }

  private request(
    input: CollaborationRequestInput,
    generation: number,
    consumeAcceptedSource?: PublicationConsumer
  ): Promise<unknown> {
    this.requireConnectedGeneration(generation)
    const requestId = `${this.identity.actorId}:${++this.requestSequence}`
    const message: CollaborationRequestMessage = {
      ...input,
      requestId
    }
    const kind =
      message.type === CollaborationMessageTypes.SEND_PUBLICATION
        ? 'publication'
        : 'control'

    return new Promise((resolve, reject) => {
      const pending: PendingRequest =
        kind === 'publication' &&
        message.type === CollaborationMessageTypes.SEND_PUBLICATION
          ? {
              kind,
              publication: message.publication,
              consumeAcceptedSource:
                consumeAcceptedSource ?? (async () => undefined),
              resolve: resolve as PendingPublicationRequest['resolve'],
              reject
            }
          : {
              kind: 'control',
              resolve,
              reject
            }
      this.pendingRequests.set(requestId, pending)
      try {
        this.postToTransportWorker({
          type: 'send-request',
          generation,
          message
        })
      } catch (error) {
        this.pendingRequests.delete(requestId)
        const failure = new ProviderFailure(
          'transport-failed',
          '[collaboration] collaboration transport worker request failed',
          error,
          message.type === CollaborationMessageTypes.SEND_PUBLICATION
            ? message.publication.publicationId
            : undefined
        )
        if (kind === 'publication') {
          this.releasePublicationCapacity()
        }
        reject(failure)
      }
    })
  }

  private acquirePublicationCapacity(generation: number): Promise<void> {
    this.requireConnectedGeneration(generation)
    if (!this.publicationCapacityReserved) {
      this.publicationCapacityReserved = true
      return Promise.resolve()
    }
    return new Promise<void>((resolve, reject) => {
      this.publicationCapacityWaiters.push({
        generation,
        resolve,
        reject
      })
    })
  }

  private releasePublicationCapacity(): void {
    if (!this.publicationCapacityReserved) return
    this.publicationCapacityReserved = false
    while (this.publicationCapacityWaiters.length > 0) {
      const waiter = this.publicationCapacityWaiters.shift()
      if (!waiter) return
      if (
        waiter.generation !== this.connectionGeneration ||
        this.status !== 'connected' ||
        !this.transportWorker
      ) {
        waiter.reject(
          new ProviderFailure(
            'not-connected',
            '[collaboration] provider disconnected before publication acceptance'
          )
        )
        continue
      }
      this.publicationCapacityReserved = true
      waiter.resolve()
      return
    }
  }

  private startTransportWorker(generation: number): void {
    if (this.transportWorker) {
      throw new Error('[collaboration] transport worker is already active')
    }
    const worker = this.transportWorkerFactory()
    const onMessage: TransportWorkerListener = (event) => {
      if (
        this.transportWorker !== worker ||
        this.transportWorkerGeneration !== generation ||
        !event.data
      ) {
        return
      }
      this.handleTransportWorkerResponse(event.data)
    }
    const onFailure: TransportWorkerListener = (event) => {
      if (
        this.transportWorker !== worker ||
        this.transportWorkerGeneration !== generation
      ) {
        return
      }
      this.failTransportWorker(
        new ProviderFailure(
          'transport-failed',
          '[collaboration] collaboration transport worker failed',
          event.error
        ),
        generation
      )
    }
    worker.addEventListener('message', onMessage)
    worker.addEventListener('error', onFailure)
    worker.addEventListener('messageerror', onFailure)
    this.transportWorker = worker
    this.transportWorkerGeneration = generation
    this.transportWorkerListeners = { onMessage, onFailure }
  }

  private stopTransportWorker(): void {
    this.clearConnectionTimeout()
    const worker = this.transportWorker
    const listeners = this.transportWorkerListeners
    this.transportWorker = null
    this.transportWorkerGeneration = 0
    this.transportWorkerListeners = null
    this.activePublicationDelivery = null
    this.deferredPublicationDelivery = null
    if (worker && listeners) {
      worker.removeEventListener('message', listeners.onMessage)
      worker.removeEventListener('error', listeners.onFailure)
      worker.removeEventListener('messageerror', listeners.onFailure)
    }
    worker?.terminate()
  }

  private postToTransportWorker(
    message: CollaborationTransportWorkerRequest
  ): void {
    const worker = this.transportWorker
    if (!worker) {
      throw new ProviderFailure(
        'not-connected',
        '[collaboration] collaboration transport worker is unavailable'
      )
    }
    worker.postMessage(message)
  }

  private handleTransportWorkerResponse(
    response: CollaborationTransportWorkerResponse
  ): void {
    if (
      response.generation !== this.connectionGeneration ||
      response.generation !== this.transportWorkerGeneration
    ) {
      return
    }

    if (response.type === 'timing') {
      recordWorkerTiming(response.phase, response.durationMs)
      return
    }
    if (response.type === 'diagnostic-counter') {
      emitDiagnosticCounter(response.name, response.value)
      return
    }
    if (response.type === 'connected') {
      const pending = this.pendingConnection
      if (
        !pending ||
        pending.generation !== response.generation ||
        this.status !== 'connecting'
      ) {
        return
      }
      this.clearConnectionTimeout()
      this.pendingConnection = null
      this.connectPromise = null
      this.documentSessionBootstrap = response.bootstrap
      this.setStatus('connected')
      pending.resolve()
      return
    }
    if (response.type === 'request-accepted') {
      const pending = this.pendingRequests.get(response.requestId)
      if (!pending) return
      this.pendingRequests.delete(response.requestId)
      if (pending.kind === 'control') {
        pending.resolve(undefined)
        return
      }
      const sequence = response.acceptedSequences?.[0]
      if (!Number.isSafeInteger(sequence) || Number(sequence) <= 0) {
        pending.reject(
          new ProviderFailure(
            'acknowledgement-failed',
            '[collaboration] source publication acceptance sequence is invalid',
            undefined,
            pending.publication.publicationId
          )
        )
        return
      }
      this.acceptSourcePublication(
        pending,
        Number(sequence),
        response.generation
      )
      return
    }
    if (response.type === 'request-rejected') {
      const pending = this.pendingRequests.get(response.requestId)
      if (!pending) return
      this.pendingRequests.delete(response.requestId)
      if (pending.kind === 'publication') {
        this.releasePublicationCapacity()
      }
      pending.reject(
        toFailure(response.code, response.message, response.publicationId)
      )
      return
    }
    if (response.type === 'publication-capacity-released') {
      this.releasePublicationCapacity()
      return
    }
    if (response.type === 'publication-delivery') {
      this.handlePublicationDelivery(response)
      return
    }
    if (response.type === 'awareness') {
      this.emit(this.awarenessSubscribers, response.message)
      return
    }
    if (response.type === 'awareness-disconnect') {
      this.emit(this.awarenessDisconnectSubscribers, response.event)
      return
    }
    if (response.type === 'disconnected') {
      this.handleWorkerDisconnected(response)
      return
    }
    this.handleWorkerFailure(response)
  }

  private handlePublicationDelivery(
    response: Extract<
      CollaborationTransportWorkerResponse,
      { type: 'publication-delivery' }
    >
  ): void {
    if (this.appliedDocumentSequence === null) {
      this.failTransportWorker(
        new ProviderFailure(
          'transport-failed',
          '[collaboration] live document sequence is not contiguous',
          undefined,
          response.publication.publicationId
        ),
        response.generation
      )
      return
    }
    const expectedSequence = this.appliedDocumentSequence + 1
    if (
      response.sequence > expectedSequence &&
      this.canAwaitEarlierSourceSequence()
    ) {
      if (this.deferredPublicationDelivery) {
        this.failTransportWorker(
          new ProviderFailure(
            'transport-failed',
            '[collaboration] transport worker released overlapping deferred publication deliveries',
            undefined,
            response.publication.publicationId
          ),
          response.generation
        )
        return
      }
      this.deferredPublicationDelivery = response
      return
    }
    if (response.sequence !== expectedSequence) {
      this.failTransportWorker(
        new ProviderFailure(
          'transport-failed',
          '[collaboration] live document sequence is not contiguous',
          undefined,
          response.publication.publicationId
        ),
        response.generation
      )
      return
    }
    if (this.activePublicationDelivery || this.sourcePublicationAcceptance) {
      this.failTransportWorker(
        new ProviderFailure(
          'transport-failed',
          '[collaboration] transport worker released overlapping publication deliveries',
          undefined,
          response.publication.publicationId
        ),
        response.generation
      )
      return
    }
    this.startPublicationDelivery(response)
  }

  private startPublicationDelivery(
    response: Extract<
      CollaborationTransportWorkerResponse,
      { type: 'publication-delivery' }
    >
  ): void {
    this.activePublicationDelivery = {
      deliveryId: response.deliveryId,
      generation: response.generation,
      publication: response.publication,
      sequence: response.sequence,
      state: 'awaiting-consumer'
    }
    this.consumeActivePublication()
  }

  private consumeActivePublication(): void {
    const delivery = this.activePublicationDelivery
    const consume = this.publicationConsumer
    if (!delivery || delivery.state !== 'awaiting-consumer' || !consume) return
    delivery.state = 'applying'
    void Promise.resolve()
      .then(() => consume(delivery.publication))
      .then(
        () => this.settlePublicationDelivery(delivery, 'applied'),
        (error: unknown) => this.failPublicationDelivery(delivery, error)
      )
  }

  private settlePublicationDelivery(
    delivery: ActivePublicationDelivery,
    outcome: 'applied'
  ): void {
    if (
      this.activePublicationDelivery !== delivery ||
      delivery.generation !== this.connectionGeneration
    ) {
      return
    }
    this.appliedDocumentSequence = delivery.sequence
    this.activePublicationDelivery = null
    try {
      this.postToTransportWorker({
        type: 'settle-publication',
        generation: delivery.generation,
        deliveryId: delivery.deliveryId,
        outcome
      })
    } catch (error) {
      this.failTransportWorker(
        new ProviderFailure(
          'transport-failed',
          '[collaboration] remote publication settlement failed',
          error,
          delivery.publication.publicationId
        ),
        delivery.generation
      )
      return
    }
    this.consumeNextDocumentSequence()
  }

  private failPublicationDelivery(
    delivery: ActivePublicationDelivery,
    error: unknown
  ): void {
    if (
      this.activePublicationDelivery !== delivery ||
      delivery.generation !== this.connectionGeneration
    ) {
      return
    }
    this.activePublicationDelivery = null
    this.suppressedAppFailureGeneration = delivery.generation
    const failure = new ProviderFailure(
      'transport-failed',
      '[collaboration] remote publication apply failed',
      error,
      delivery.publication.publicationId
    )
    this.rejectPending(failure)
    this.setStatus('failed')
    try {
      this.postToTransportWorker({
        type: 'settle-publication',
        generation: delivery.generation,
        deliveryId: delivery.deliveryId,
        outcome: 'failed',
        message: error instanceof Error ? error.message : String(error)
      })
    } finally {
      this.stopTransportWorker()
    }
  }

  private handleWorkerDisconnected(
    response: Extract<
      CollaborationTransportWorkerResponse,
      { type: 'disconnected' }
    >
  ): void {
    if (this.pendingDisconnect?.generation === response.generation) {
      this.resolvePendingDisconnect(response.generation)
      this.stopTransportWorker()
      return
    }
    if (this.suppressedAppFailureGeneration === response.generation) {
      this.stopTransportWorker()
      return
    }

    const closeDetail =
      response.code === undefined && !response.reason
        ? ''
        : ` (${response.code ?? 1005}${
            response.reason ? `: ${response.reason}` : ''
          })`
    if (this.status === 'connecting') {
      const failure = new ProviderFailure(
        'connection-failed',
        `[collaboration] WebSocket closed before ready${closeDetail}`
      )
      this.rejectPendingConnection(failure, response.generation)
      this.rejectPending(failure)
      this.setStatus('failed')
      this.emit(this.failureSubscribers, failure)
      this.stopTransportWorker()
      return
    }
    const failure = new ProviderFailure(
      'not-connected',
      `[collaboration] WebSocket connection closed${closeDetail}`
    )
    this.rejectPendingConnection(failure, response.generation)
    this.rejectPending(failure)
    if (this.status !== 'failed' && this.status !== 'disposed') {
      this.setStatus('disconnected')
      this.emit(this.failureSubscribers, failure)
    }
    this.stopTransportWorker()
  }

  private handleWorkerFailure(
    response: Extract<CollaborationTransportWorkerResponse, { type: 'failure' }>
  ): void {
    if (this.suppressedAppFailureGeneration === response.generation) {
      if (response.terminal) this.stopTransportWorker()
      return
    }
    const failure = toFailure(
      response.code,
      response.message,
      response.publicationId
    )
    if (!response.terminal) {
      this.emit(this.failureSubscribers, failure)
      return
    }
    this.rejectPendingConnection(failure, response.generation)
    this.rejectPending(failure)
    this.resolvePendingDisconnect(response.generation)
    if (this.status !== 'disposed' && this.status !== 'disconnected') {
      this.setStatus('failed')
      this.emit(this.failureSubscribers, failure)
    }
    this.stopTransportWorker()
  }

  private failTransportWorker(
    failure: ProviderFailure,
    generation: number
  ): void {
    if (
      generation !== this.connectionGeneration ||
      generation !== this.transportWorkerGeneration
    ) {
      return
    }
    if (this.suppressedAppFailureGeneration === generation) {
      this.stopTransportWorker()
      return
    }
    this.rejectPendingConnection(failure, generation)
    this.rejectPending(failure)
    this.resolvePendingDisconnect(generation)
    if (this.status !== 'disposed' && this.status !== 'disconnected') {
      this.setStatus('failed')
      this.emit(this.failureSubscribers, failure)
    }
    this.stopTransportWorker()
  }

  private rejectPendingConnection(
    failure: ProviderFailure,
    generation: number
  ): void {
    const pending = this.pendingConnection
    if (!pending || pending.generation !== generation) return
    this.clearConnectionTimeout()
    this.pendingConnection = null
    this.connectPromise = null
    pending.reject(failure)
  }

  private startConnectionTimeout(generation: number): void {
    if (
      this.pendingConnection?.generation !== generation ||
      this.status !== 'connecting'
    ) {
      return
    }
    this.clearConnectionTimeout()
    this.connectionTimeout = setTimeout(() => {
      this.connectionTimeout = null
      this.failTransportWorker(
        new ProviderFailure(
          'connection-failed',
          '[collaboration] document-session handshake timed out before ready'
        ),
        generation
      )
    }, this.connectionTimeoutMs)
  }

  private clearConnectionTimeout(): void {
    if (!this.connectionTimeout) return
    clearTimeout(this.connectionTimeout)
    this.connectionTimeout = null
  }

  private resolvePendingDisconnect(generation: number): void {
    const pending = this.pendingDisconnect
    if (!pending || pending.generation !== generation) return
    this.pendingDisconnect = null
    this.disconnectPromise = null
    pending.resolve()
  }

  private requireUsable(): void {
    if (this.status === 'disposed') {
      throw new ProviderFailure(
        'disposed',
        '[collaboration] provider is disposed'
      )
    }
  }

  private requireConnected(): void {
    this.requireUsable()
    if (this.status === 'connected' && this.transportWorker) return
    const failure = new ProviderFailure(
      'not-connected',
      '[collaboration] provider is not connected'
    )
    this.emit(this.failureSubscribers, failure)
    throw failure
  }

  private requireConnectedGeneration(generation: number): void {
    if (generation !== this.connectionGeneration) {
      throw new ProviderFailure(
        'not-connected',
        '[collaboration] provider connection generation changed'
      )
    }
    this.requireConnected()
  }

  private requireDocumentSessionLive(): void {
    this.requireConnected()
    if (this.documentBootstrapCompleted) return
    const failure = new ProviderFailure(
      'not-connected',
      '[collaboration] document bootstrap has not completed'
    )
    this.emit(this.failureSubscribers, failure)
    throw failure
  }

  private rejectPending(failure: ProviderFailure): void {
    const waiters = this.publicationCapacityWaiters.splice(0)
    this.publicationCapacityReserved = false
    waiters.forEach(({ reject }) => reject(failure))
    this.pendingRequests.forEach(({ reject }) => reject(failure))
    this.pendingRequests.clear()
    const sourceAcceptance = this.sourcePublicationAcceptance
    this.sourcePublicationAcceptance = null
    sourceAcceptance?.pending.reject(failure)
    this.deferredPublicationDelivery = null
  }

  private acceptSourcePublication(
    pending: PendingPublicationRequest,
    sequence: number,
    generation: number
  ): void {
    const acceptance = Object.freeze({
      publicationId: pending.publication.publicationId,
      sequence
    })
    const appliedSequence = this.appliedDocumentSequence
    if (appliedSequence !== null && sequence <= appliedSequence) {
      pending.resolve(acceptance)
      this.consumeNextDocumentSequence()
      return
    }
    if (this.sourcePublicationAcceptance) {
      const failure = new ProviderFailure(
        'transport-failed',
        '[collaboration] source publication acceptance overlapped',
        undefined,
        pending.publication.publicationId
      )
      pending.reject(failure)
      this.failTransportWorker(failure, generation)
      return
    }
    this.sourcePublicationAcceptance = {
      acceptance,
      generation,
      pending,
      state: 'awaiting-consumer'
    }
    this.consumeNextDocumentSequence()
  }

  private consumeNextDocumentSequence(): void {
    if (
      this.appliedDocumentSequence === null ||
      this.activePublicationDelivery
    ) {
      return
    }
    const source = this.sourcePublicationAcceptance
    if (source?.state === 'applying') return
    const expectedSequence = this.appliedDocumentSequence + 1
    if (source?.acceptance.sequence === expectedSequence) {
      source.state = 'applying'
      void Promise.resolve()
        .then(() =>
          source.pending.consumeAcceptedSource(source.pending.publication)
        )
        .then(
          () => {
            if (
              this.sourcePublicationAcceptance !== source ||
              source.generation !== this.connectionGeneration
            ) {
              return
            }
            this.appliedDocumentSequence = source.acceptance.sequence
            this.sourcePublicationAcceptance = null
            source.pending.resolve(source.acceptance)
            this.consumeNextDocumentSequence()
          },
          (error: unknown) => {
            if (this.sourcePublicationAcceptance !== source) return
            this.sourcePublicationAcceptance = null
            source.pending.reject(error)
            this.failTransportWorker(
              new ProviderFailure(
                'transport-failed',
                '[collaboration] accepted source publication apply failed',
                error,
                source.pending.publication.publicationId
              ),
              source.generation
            )
          }
        )
      return
    }
    const deferred = this.deferredPublicationDelivery
    if (deferred?.sequence === expectedSequence) {
      this.deferredPublicationDelivery = null
      this.startPublicationDelivery(deferred)
    }
  }

  private canAwaitEarlierSourceSequence(): boolean {
    if (this.sourcePublicationAcceptance) return true
    return [...this.pendingRequests.values()].some(
      ({ kind }) => kind === 'publication'
    )
  }

  private setStatus(status: ProviderStatus): void {
    if (this.status === status) return
    this.status = status
    this.emit(this.statusSubscribers, status)
  }

  private subscribe<T>(
    subscribers: Set<Subscriber<T>>,
    subscriber: Subscriber<T>
  ): () => void {
    this.requireUsable()
    subscribers.add(subscriber)
    return () => subscribers.delete(subscriber)
  }

  private emit<T>(subscribers: Set<Subscriber<T>>, value: T): void {
    ;[...subscribers].forEach((subscriber) => {
      try {
        subscriber(value)
      } catch {
        // Transport observers cannot alter provider settlement.
      }
    })
  }
}
