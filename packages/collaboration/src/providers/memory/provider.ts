import type { SharedPublication } from '@asyra/factory'
import {
  createProviderIdentitySnapshot,
  ProviderFailure,
  type InboundPublication,
  type Provider,
  type ProviderAwarenessDisconnect,
  type ProviderAwarenessMessage,
  type ProviderIdentity,
  type ProviderStatus
} from '../../provider'
import { cloneAwareness, clonePublication } from './cloning'
import { MemoryHub, type MemoryPeer } from './hub'

export class MemoryProvider implements Provider, MemoryPeer {
  readonly identity: ProviderIdentity

  private status: ProviderStatus = 'idle'
  private connectionGeneration = 0
  private connectPromise: Promise<void> | null = null
  private cancelConnect?: (failure: ProviderFailure) => void
  private activeConnectionToken?: symbol
  private readonly statusSubscribers = new Set<
    (status: ProviderStatus) => void
  >()
  private readonly publicationSubscribers = new Set<
    (publication: InboundPublication) => void
  >()
  private readonly awarenessSubscribers = new Set<
    (message: ProviderAwarenessMessage) => void
  >()
  private readonly awarenessDisconnectSubscribers = new Set<
    (event: ProviderAwarenessDisconnect) => void
  >()
  private readonly failureSubscribers = new Set<
    (failure: ProviderFailure) => void
  >()

  constructor(
    private readonly hub: MemoryHub,
    identity: ProviderIdentity
  ) {
    this.identity = createProviderIdentitySnapshot(identity)
  }

  connect(): Promise<void> {
    try {
      this.requireUsable()
    } catch (error) {
      return Promise.reject(error)
    }
    if (this.status === 'connected') return Promise.resolve()
    if (this.connectPromise) return this.connectPromise
    const generation = ++this.connectionGeneration
    const connectionToken = Symbol('memory-collaboration-connection')
    this.setStatus('connecting')
    let cancelConnection: ((failure: ProviderFailure) => void) | undefined
    const cancellation = new Promise<never>((_resolve, reject) => {
      cancelConnection = reject
    })
    const hubConnection = this.hub.connect(this, connectionToken)
    void hubConnection.then(
      () => {
        if (
          generation !== this.connectionGeneration ||
          this.status === 'disposed' ||
          this.status === 'disconnected'
        ) {
          this.hub.disconnect(this, connectionToken)
        }
      },
      () => undefined
    )
    const attempt = Promise.race([hubConnection, cancellation]).then(
      () => {
        if (this.status === 'disposed') {
          this.hub.disconnect(this, connectionToken)
          throw new ProviderFailure(
            'disposed',
            '[collaboration] provider was disposed before connection completed'
          )
        }
        if (
          generation !== this.connectionGeneration ||
          this.status === 'disconnected'
        ) {
          this.hub.disconnect(this, connectionToken)
          throw new ProviderFailure(
            'not-connected',
            '[collaboration] provider connection was cancelled'
          )
        }
        this.activeConnectionToken = connectionToken
        this.setStatus('connected')
      },
      (error: unknown) => {
        if (this.status === 'disposed') {
          this.hub.disconnect(this, connectionToken)
          throw error instanceof ProviderFailure && error.code === 'disposed'
            ? error
            : new ProviderFailure(
                'disposed',
                '[collaboration] provider was disposed before connection completed',
                error
              )
        }
        if (
          generation !== this.connectionGeneration ||
          this.status === 'disconnected'
        ) {
          this.hub.disconnect(this, connectionToken)
          throw error instanceof ProviderFailure &&
            error.code === 'not-connected'
            ? error
            : new ProviderFailure(
                'not-connected',
                '[collaboration] provider connection was cancelled',
                error
              )
        }
        const failure =
          error instanceof ProviderFailure
            ? error
            : new ProviderFailure(
                'connection-failed',
                '[collaboration] provider connection failed',
                error
              )
        this.setStatus('failed')
        this.emit(this.failureSubscribers, failure)
        throw failure
      }
    )
    this.connectPromise = attempt
    this.cancelConnect = cancelConnection
    const clearAttempt = () => {
      if (this.connectPromise !== attempt) return
      this.connectPromise = null
      this.cancelConnect = undefined
    }
    void attempt.then(clearAttempt, clearAttempt)
    return attempt
  }

  async disconnect(): Promise<void> {
    this.requireUsable()
    const cancelConnect = this.cancelConnect
    this.connectionGeneration += 1
    this.hub.disconnect(this, this.activeConnectionToken)
    this.activeConnectionToken = undefined
    if (this.status !== 'disconnected') this.setStatus('disconnected')
    this.connectPromise = null
    this.cancelConnect = undefined
    cancelConnect?.(
      new ProviderFailure(
        'not-connected',
        '[collaboration] provider connection was cancelled'
      )
    )
  }

  async reconnect(): Promise<void> {
    this.requireUsable()
    if (this.status === 'connected' || this.connectPromise) {
      await this.disconnect()
    }
    await this.connect()
  }

  async destroy(): Promise<void> {
    if (this.status === 'disposed') return
    const cancelConnect = this.cancelConnect
    this.connectionGeneration += 1
    this.hub.disconnect(this, this.activeConnectionToken)
    this.activeConnectionToken = undefined
    this.setStatus('disposed')
    this.connectPromise = null
    this.cancelConnect = undefined
    cancelConnect?.(
      new ProviderFailure('disposed', '[collaboration] provider is disposed')
    )
    this.statusSubscribers.clear()
    this.publicationSubscribers.clear()
    this.awarenessSubscribers.clear()
    this.awarenessDisconnectSubscribers.clear()
    this.failureSubscribers.clear()
  }

  getStatus(): ProviderStatus {
    return this.status
  }

  onStatusChange(subscriber: (status: ProviderStatus) => void): () => void {
    return this.subscribe(this.statusSubscribers, subscriber)
  }

  async sendPublication(publication: SharedPublication): Promise<void> {
    this.requireConnected()
    try {
      await this.hub.receivePublication(this, clonePublication(publication))
    } catch (error) {
      this.failTransport(error)
    }
  }

  onPublication(
    subscriber: (publication: InboundPublication) => void
  ): () => void {
    return this.subscribe(this.publicationSubscribers, subscriber)
  }

  async sendAwareness(message: ProviderAwarenessMessage): Promise<void> {
    this.requireConnected()
    if (message.actorId !== this.identity.actorId) {
      const failure = new ProviderFailure(
        'invalid-awareness-actor',
        '[collaboration] awareness actor must match provider identity'
      )
      this.emit(this.failureSubscribers, failure)
      throw failure
    }
    try {
      this.hub.receiveAwareness(this, cloneAwareness(message))
    } catch (error) {
      this.failTransport(error)
    }
  }

  onAwareness(
    subscriber: (message: ProviderAwarenessMessage) => void
  ): () => void {
    return this.subscribe(this.awarenessSubscribers, subscriber)
  }

  onAwarenessDisconnect(
    subscriber: (event: ProviderAwarenessDisconnect) => void
  ): () => void {
    return this.subscribe(this.awarenessDisconnectSubscribers, subscriber)
  }

  onFailure(subscriber: (failure: ProviderFailure) => void): () => void {
    return this.subscribe(this.failureSubscribers, subscriber)
  }

  receivePublication(inbound: InboundPublication): void {
    if (this.status !== 'connected') return
    ;[...this.publicationSubscribers].forEach((subscriber) => {
      try {
        subscriber(
          Object.freeze({
            publication: clonePublication(inbound.publication),
            ...(inbound.fromActorId ? { fromActorId: inbound.fromActorId } : {})
          })
        )
      } catch {
        // Provider observers cannot alter transport settlement.
      }
    })
  }

  receiveAwareness(message: ProviderAwarenessMessage): void {
    if (this.status !== 'connected') return
    ;[...this.awarenessSubscribers].forEach((subscriber) => {
      try {
        subscriber(cloneAwareness(message))
      } catch {
        // Provider observers cannot alter transport settlement.
      }
    })
  }

  receiveAwarenessDisconnect(event: ProviderAwarenessDisconnect): void {
    if (this.status !== 'connected') return
    this.emit(this.awarenessDisconnectSubscribers, Object.freeze({ ...event }))
  }

  private requireUsable(): void {
    if (this.status !== 'disposed') return
    throw new ProviderFailure(
      'disposed',
      '[collaboration] provider is disposed'
    )
  }

  private requireConnected(): void {
    this.requireUsable()
    if (this.status === 'connected') return
    const failure = new ProviderFailure(
      'not-connected',
      '[collaboration] provider is not connected'
    )
    this.emit(this.failureSubscribers, failure)
    throw failure
  }

  private failTransport(error: unknown): never {
    const failure =
      error instanceof ProviderFailure
        ? error
        : new ProviderFailure(
            'transport-failed',
            '[collaboration] provider transport failed',
            error
          )
    this.emit(this.failureSubscribers, failure)
    throw failure
  }

  private setStatus(status: ProviderStatus): void {
    this.status = status
    this.emit(this.statusSubscribers, status)
  }

  private subscribe<T>(
    subscribers: Set<(value: T) => void>,
    subscriber: (value: T) => void
  ): () => void {
    this.requireUsable()
    subscribers.add(subscriber)
    return () => subscribers.delete(subscriber)
  }

  private emit<T>(subscribers: Set<(value: T) => void>, value: T): void {
    ;[...subscribers].forEach((subscriber) => {
      try {
        subscriber(value)
      } catch {
        // Provider observers cannot alter transport settlement.
      }
    })
  }
}
