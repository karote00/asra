import type { SharedPublication } from '@asyra/factory'
import {
  ProviderFailure,
  createProviderIdentitySnapshot,
  isProviderFailureCode,
  type Provider,
  type ProviderIdentity,
  type ProviderStatus,
  type InboundPublication,
  type ProviderAwarenessDisconnect,
  type ProviderAwarenessMessage
} from '@asyra/collaboration'
import {
  CollaborationMessageTypes,
  encodeCollaborationMessage,
  parseCollaborationServerMessage,
  type CollaborationHelloMessage,
  type CollaborationRequestInput,
  type CollaborationRequestMessage,
  type CollaborationServerMessage
} from './protocol'

type Subscriber<T> = (value: T) => void

interface PendingRequest {
  resolve(value: unknown): void
  reject(error: unknown): void
}

export interface CollaborationWebSocketProviderOptions {
  endpoint: string
  identity: ProviderIdentity
}

const toFailure = (
  code: unknown,
  message: unknown,
  publicationId?: string
): ProviderFailure =>
  new ProviderFailure(
    isProviderFailureCode(code) ? code : 'transport-failed',
    typeof message === 'string' && message.trim()
      ? message
      : '[collaboration] WebSocket transport failed',
    undefined,
    publicationId
  )

export class CollaborationWebSocketProvider implements Provider {
  readonly identity: ProviderIdentity

  private readonly endpoint: string
  private status: ProviderStatus = 'idle'
  private socket: WebSocket | null = null
  private connectPromise: Promise<void> | null = null
  private cancelConnect?: (failure: ProviderFailure) => void
  private connectionGeneration = 0
  private requestSequence = 0
  private readonly pendingRequests = new Map<string, PendingRequest>()
  private readonly statusSubscribers = new Set<Subscriber<ProviderStatus>>()
  private readonly publicationSubscribers = new Set<
    Subscriber<InboundPublication>
  >()
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
  }

  connect(): Promise<void> {
    this.requireUsable()
    if (this.status === 'connected') return Promise.resolve()
    if (this.connectPromise) return this.connectPromise

    const generation = ++this.connectionGeneration
    this.setStatus('connecting')
    let socket: WebSocket
    try {
      socket = new WebSocket(this.endpoint)
    } catch (error) {
      const failure = new ProviderFailure(
        'connection-failed',
        '[collaboration] WebSocket construction failed',
        error
      )
      this.setStatus('failed')
      this.emit(this.failureSubscribers, failure)
      return Promise.reject(failure)
    }
    this.socket = socket
    this.connectPromise = new Promise<void>((resolve, reject) => {
      let settled = false

      const rejectConnection = (failure: ProviderFailure) => {
        if (settled) return
        settled = true
        if (generation === this.connectionGeneration) {
          this.connectPromise = null
          this.cancelConnect = undefined
        }
        if (this.status === 'disposed') {
          reject(
            new ProviderFailure(
              'disposed',
              '[collaboration] provider was disposed before connection ready'
            )
          )
          return
        }
        if (
          generation !== this.connectionGeneration ||
          this.status === 'disconnected'
        ) {
          reject(
            failure.code === 'not-connected'
              ? failure
              : new ProviderFailure(
                  'not-connected',
                  '[collaboration] provider connection was cancelled',
                  failure
                )
          )
          return
        }
        this.setStatus('failed')
        this.emit(this.failureSubscribers, failure)
        reject(failure)
      }
      this.cancelConnect = rejectConnection

      socket.addEventListener('open', () => {
        const hello: CollaborationHelloMessage = {
          type: CollaborationMessageTypes.HELLO,
          identity: this.identity
        }
        let encodedHello: string
        try {
          encodedHello = encodeCollaborationMessage(hello)
        } catch (error) {
          rejectConnection(
            new ProviderFailure(
              'transport-failed',
              '[collaboration] identity contains a value that JSON cannot preserve',
              error
            )
          )
          socket.close(1007, 'invalid hello payload')
          return
        }
        try {
          socket.send(encodedHello)
        } catch (error) {
          rejectConnection(
            new ProviderFailure(
              'transport-failed',
              '[collaboration] WebSocket identity hello send failed',
              error
            )
          )
          socket.close(1011, 'hello send failed')
        }
      })
      socket.addEventListener('message', (event) => {
        if (generation !== this.connectionGeneration) return
        const message = this.parseMessage(event.data)
        if (!message) {
          const failure = new ProviderFailure(
            'transport-failed',
            '[collaboration] invalid WebSocket server message'
          )
          if (!settled) {
            rejectConnection(failure)
          } else {
            this.rejectPending(failure)
            this.setStatus('failed')
            this.emit(this.failureSubscribers, failure)
          }
          socket.close(1002, 'invalid server message')
          return
        }
        if (message.type === CollaborationMessageTypes.READY) {
          if (!settled) {
            if (this.status === 'disposed') {
              rejectConnection(
                new ProviderFailure(
                  'disposed',
                  '[collaboration] provider was disposed before connection ready'
                )
              )
              return
            }
            settled = true
            this.connectPromise = null
            this.cancelConnect = undefined
            this.setStatus('connected')
            resolve()
          }
          return
        }
        if (message.type === CollaborationMessageTypes.CONNECTION_ERROR) {
          rejectConnection(toFailure(message.code, message.message))
          socket.close()
          return
        }
        this.handleMessage(message)
      })
      socket.addEventListener('error', () => {
        rejectConnection(
          new ProviderFailure(
            'connection-failed',
            '[collaboration] WebSocket connection failed'
          )
        )
      })
      socket.addEventListener('close', (event) => {
        if (generation !== this.connectionGeneration) return
        this.socket = null
        const closeReason = event.reason.trim()
        const closeDetail =
          event.code === 1005 && closeReason.length === 0
            ? ''
            : ` (${event.code}${closeReason ? `: ${closeReason}` : ''})`
        this.rejectPending(
          new ProviderFailure(
            'not-connected',
            `[collaboration] WebSocket connection closed${closeDetail}`
          )
        )
        if (!settled) {
          rejectConnection(
            new ProviderFailure(
              'connection-failed',
              '[collaboration] WebSocket closed before ready'
            )
          )
          return
        }
        if (this.status !== 'disposed' && this.status !== 'failed') {
          this.setStatus('disconnected')
        }
      })
    })
    return this.connectPromise
  }

  async disconnect(): Promise<void> {
    this.requireUsable()
    const socket = this.socket
    this.connectionGeneration += 1
    this.socket = null
    this.cancelConnect?.(
      new ProviderFailure(
        'not-connected',
        '[collaboration] provider connection was cancelled'
      )
    )
    this.cancelConnect = undefined
    this.connectPromise = null
    this.setStatus('disconnected')
    this.rejectPending(
      new ProviderFailure(
        'not-connected',
        '[collaboration] provider disconnected before request completion'
      )
    )
    if (!socket || socket.readyState === WebSocket.CLOSED) {
      return
    }
    await new Promise<void>((resolve) => {
      socket.addEventListener('close', () => resolve(), { once: true })
      socket.close(1000, 'client disconnect')
    })
  }

  async reconnect(): Promise<void> {
    this.requireUsable()
    if (this.socket) await this.disconnect()
    await this.connect()
  }

  async destroy(): Promise<void> {
    if (this.status === 'disposed') return
    const socket = this.socket
    this.connectionGeneration += 1
    this.setStatus('disposed')
    this.cancelConnect?.(
      new ProviderFailure('disposed', '[collaboration] provider is disposed')
    )
    this.cancelConnect = undefined
    this.connectPromise = null
    if (socket && socket.readyState !== WebSocket.CLOSED) {
      socket.close(1000, 'provider disposed')
    }
    this.socket = null
    this.rejectPending(
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

  onStatusChange(subscriber: Subscriber<ProviderStatus>): () => void {
    return this.subscribe(this.statusSubscribers, subscriber)
  }

  async sendPublication(publication: SharedPublication): Promise<void> {
    await this.request({
      type: CollaborationMessageTypes.SEND_PUBLICATION,
      publication
    })
  }

  onPublication(subscriber: Subscriber<InboundPublication>): () => void {
    return this.subscribe(this.publicationSubscribers, subscriber)
  }

  async sendAwareness(message: ProviderAwarenessMessage): Promise<void> {
    if (message.actorId !== this.identity.actorId) {
      const failure = new ProviderFailure(
        'invalid-awareness-actor',
        '[collaboration] awareness actor must match provider identity'
      )
      this.emit(this.failureSubscribers, failure)
      throw failure
    }
    await this.request({
      type: CollaborationMessageTypes.SEND_AWARENESS,
      message
    })
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

  private async request(input: CollaborationRequestInput): Promise<unknown> {
    this.requireConnected()
    const requestId = `${this.identity.actorId}:${++this.requestSequence}`
    const socket = this.socket as WebSocket
    const message: CollaborationRequestMessage = {
      ...input,
      requestId
    }
    let encodedMessage: string
    try {
      encodedMessage = encodeCollaborationMessage(message)
    } catch (error) {
      throw new ProviderFailure(
        'transport-failed',
        '[collaboration] request contains a value that JSON cannot preserve',
        error
      )
    }
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject })
      try {
        socket.send(encodedMessage)
      } catch (error) {
        this.pendingRequests.delete(requestId)
        reject(toFailure('transport-failed', String(error)))
      }
    })
  }

  private handleMessage(
    message: Exclude<
      CollaborationServerMessage,
      { type: typeof CollaborationMessageTypes.READY }
    >
  ): void {
    if (message.type === CollaborationMessageTypes.RESPONSE) {
      const pending = this.pendingRequests.get(message.requestId)
      if (!pending) return
      this.pendingRequests.delete(message.requestId)
      if (message.ok) {
        pending.resolve(undefined)
      } else {
        pending.reject(toFailure(message.error?.code, message.error?.message))
      }
      return
    }
    if (message.type === CollaborationMessageTypes.PUBLICATION) {
      this.emit(this.publicationSubscribers, {
        publication: structuredClone(message.publication),
        ...(message.fromActorId ? { fromActorId: message.fromActorId } : {})
      })
      return
    }
    if (message.type === CollaborationMessageTypes.AWARENESS) {
      this.emit(this.awarenessSubscribers, {
        actorId: message.actorId,
        clock: message.clock,
        state: message.state
      })
      return
    }
    if (message.type === CollaborationMessageTypes.AWARENESS_DISCONNECT) {
      this.emit(this.awarenessDisconnectSubscribers, {
        actorId: message.actorId,
        reason: 'disconnect'
      })
      return
    }
    if (message.type === CollaborationMessageTypes.FAILURE) {
      this.emit(
        this.failureSubscribers,
        toFailure(message.code, message.message, message.publicationId)
      )
    }
  }

  private parseMessage(value: unknown): CollaborationServerMessage | undefined {
    let message: CollaborationServerMessage | undefined
    try {
      message =
        typeof value === 'string'
          ? parseCollaborationServerMessage(JSON.parse(value) as unknown)
          : undefined
    } catch {
      // Report the same protocol failure for invalid JSON and invalid payloads.
    }
    return message
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
    if (
      this.status === 'connected' &&
      this.socket?.readyState === WebSocket.OPEN
    ) {
      return
    }
    const failure = new ProviderFailure(
      'not-connected',
      '[collaboration] provider is not connected'
    )
    this.emit(this.failureSubscribers, failure)
    throw failure
  }

  private rejectPending(error: ProviderFailure): void {
    this.pendingRequests.forEach(({ reject }) => reject(error))
    this.pendingRequests.clear()
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
