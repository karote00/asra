import * as Y from 'yjs'
import type { YjsBinaryUpdate } from '../yjs-document'
import {
  type CollaborationProvider,
  type CollaborationProviderIdentity,
  type CollaborationProviderStatus,
  type InboundBinaryUpdate,
  type ProviderAcknowledgement,
  type ProviderAwarenessDisconnect,
  type ProviderAwarenessMessage,
  type ProviderStateVectorExchange,
  ProviderFailure
} from '../provider'

export interface MemoryCollaborationHubOptions {
  authorizeConnection?: (
    identity: CollaborationProviderIdentity
  ) => boolean | Promise<boolean>
  acknowledgeUpdate?: (
    update: YjsBinaryUpdate,
    identity: CollaborationProviderIdentity
  ) => boolean | Promise<boolean>
}

interface MemoryRoom {
  readonly document: Y.Doc
  readonly providers: Set<MemoryCollaborationProvider>
}

const roomKey = (identity: CollaborationProviderIdentity): string =>
  JSON.stringify([identity.documentId, identity.roomId])

const cloneBytes = (value: Uint8Array): Uint8Array => value.slice()

const cloneAwareness = (
  value: ProviderAwarenessMessage
): ProviderAwarenessMessage => structuredClone(value)

export class MemoryCollaborationHub {
  private readonly rooms = new Map<string, MemoryRoom>()
  private readonly authorizeConnection?: MemoryCollaborationHubOptions['authorizeConnection']
  private readonly acknowledgeUpdate?: MemoryCollaborationHubOptions['acknowledgeUpdate']

  constructor(options: MemoryCollaborationHubOptions = {}) {
    this.authorizeConnection = options.authorizeConnection
    this.acknowledgeUpdate = options.acknowledgeUpdate
  }

  async connect(provider: MemoryCollaborationProvider): Promise<void> {
    let authorized = true
    try {
      authorized = (await this.authorizeConnection?.(provider.identity)) ?? true
    } catch (error) {
      throw new ProviderFailure(
        'connection-failed',
        '[collaboration] provider connection failed',
        error
      )
    }
    if (!authorized) {
      throw new ProviderFailure(
        'connection-rejected',
        '[collaboration] provider connection was rejected'
      )
    }

    this.room(provider.identity).providers.add(provider)
  }

  disconnect(provider: MemoryCollaborationProvider): void {
    const key = roomKey(provider.identity)
    const room = this.rooms.get(key)
    if (!room?.providers.delete(provider)) return

    const event: ProviderAwarenessDisconnect = Object.freeze({
      actorId: provider.identity.actorId,
      reason: 'disconnect'
    })
    room.providers.forEach((peer) => peer.receiveAwarenessDisconnect(event))
  }

  async receiveUpdate(
    sender: MemoryCollaborationProvider,
    binary: YjsBinaryUpdate
  ): Promise<void> {
    const room = this.room(sender.identity)
    if (binary.update.byteLength > 0) {
      Y.applyUpdate(room.document, binary.update)
      room.providers.forEach((peer) => {
        if (peer === sender) return
        peer.receiveUpdate(
          Object.freeze({
            operationId: binary.operationId,
            update: cloneBytes(binary.update),
            fromActorId: sender.identity.actorId
          })
        )
      })
    }

    let acknowledged = true
    try {
      acknowledged =
        (await this.acknowledgeUpdate?.(binary, sender.identity)) ?? true
    } catch (error) {
      throw new ProviderFailure(
        'acknowledgement-failed',
        '[collaboration] durable acknowledgement failed',
        error,
        binary.operationId
      )
    }
    if (!acknowledged) {
      throw new ProviderFailure(
        'acknowledgement-failed',
        '[collaboration] durable acknowledgement was rejected',
        undefined,
        binary.operationId
      )
    }

    sender.receiveAcknowledgement(
      Object.freeze({
        operationId: binary.operationId,
        durability: 'durable'
      })
    )
  }

  receiveAwareness(
    sender: MemoryCollaborationProvider,
    message: ProviderAwarenessMessage
  ): void {
    const room = this.room(sender.identity)
    room.providers.forEach((peer) => {
      if (peer === sender) return
      peer.receiveAwareness(cloneAwareness(message))
    })
  }

  sync(
    provider: MemoryCollaborationProvider,
    stateVector: Uint8Array
  ): Uint8Array {
    const document = this.room(provider.identity).document
    return stateVector.byteLength === 0
      ? Y.encodeStateAsUpdate(document)
      : Y.encodeStateAsUpdate(document, stateVector)
  }

  exchangeStateVector(
    provider: MemoryCollaborationProvider,
    stateVector: Uint8Array
  ): ProviderStateVectorExchange {
    const document = this.room(provider.identity).document
    return Object.freeze({
      remoteStateVector: Y.encodeStateVector(document),
      missingRemoteUpdate:
        stateVector.byteLength === 0
          ? Y.encodeStateAsUpdate(document)
          : Y.encodeStateAsUpdate(document, stateVector)
    })
  }

  receiveSyncUpdate(
    sender: MemoryCollaborationProvider,
    update: Uint8Array
  ): void {
    if (update.byteLength <= 2) return
    const room = this.room(sender.identity)
    Y.applyUpdate(room.document, update)
    room.providers.forEach((peer) => {
      if (peer === sender) return
      peer.receiveUpdate(
        Object.freeze({
          operationId: `sync:${sender.identity.actorId}`,
          update: cloneBytes(update),
          fromActorId: sender.identity.actorId
        })
      )
    })
  }

  private room(identity: CollaborationProviderIdentity): MemoryRoom {
    const key = roomKey(identity)
    let room = this.rooms.get(key)
    if (!room) {
      room = { document: new Y.Doc(), providers: new Set() }
      this.rooms.set(key, room)
    }
    return room
  }
}

const cloneIdentity = (
  identity: CollaborationProviderIdentity
): CollaborationProviderIdentity =>
  Object.freeze({
    documentId: identity.documentId,
    roomId: identity.roomId,
    actorId: identity.actorId,
    ...(identity.connectionMetadata
      ? {
          connectionMetadata: Object.freeze({ ...identity.connectionMetadata })
        }
      : {})
  })

export class MemoryCollaborationProvider implements CollaborationProvider {
  readonly identity: CollaborationProviderIdentity

  private status: CollaborationProviderStatus = 'idle'
  private readonly statusSubscribers = new Set<
    (status: CollaborationProviderStatus) => void
  >()
  private readonly updateSubscribers = new Set<
    (update: InboundBinaryUpdate) => void
  >()
  private readonly acknowledgementSubscribers = new Set<
    (acknowledgement: ProviderAcknowledgement) => void
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
    private readonly hub: MemoryCollaborationHub,
    identity: CollaborationProviderIdentity
  ) {
    this.identity = cloneIdentity(identity)
  }

  async connect(): Promise<void> {
    this.requireUsable()
    if (this.status === 'connected') return
    this.setStatus('connecting')
    try {
      await this.hub.connect(this)
      this.setStatus('connected')
    } catch (error) {
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
  }

  async disconnect(): Promise<void> {
    this.requireUsable()
    if (this.status === 'connected') this.hub.disconnect(this)
    if (this.status !== 'disconnected') this.setStatus('disconnected')
  }

  async reconnect(): Promise<void> {
    this.requireUsable()
    if (this.status === 'connected') await this.disconnect()
    await this.connect()
  }

  async destroy(): Promise<void> {
    if (this.status === 'disposed') return
    if (this.status === 'connected') this.hub.disconnect(this)
    this.setStatus('disposed')
    this.statusSubscribers.clear()
    this.updateSubscribers.clear()
    this.acknowledgementSubscribers.clear()
    this.awarenessSubscribers.clear()
    this.awarenessDisconnectSubscribers.clear()
    this.failureSubscribers.clear()
  }

  getStatus(): CollaborationProviderStatus {
    return this.status
  }

  onStatusChange(
    subscriber: (status: CollaborationProviderStatus) => void
  ): () => void {
    return this.subscribe(this.statusSubscribers, subscriber)
  }

  async sendUpdate(update: YjsBinaryUpdate): Promise<void> {
    this.requireConnected()
    try {
      await this.hub.receiveUpdate(this, {
        operationId: update.operationId,
        update: cloneBytes(update.update)
      })
    } catch (error) {
      this.failTransport(error)
    }
  }

  onUpdate(subscriber: (update: InboundBinaryUpdate) => void): () => void {
    return this.subscribe(this.updateSubscribers, subscriber)
  }

  async requestSync(stateVector: Uint8Array): Promise<Uint8Array> {
    this.requireConnected()
    try {
      return cloneBytes(this.hub.sync(this, cloneBytes(stateVector)))
    } catch (error) {
      return this.failTransport(error)
    }
  }

  async exchangeStateVector(
    stateVector: Uint8Array
  ): Promise<ProviderStateVectorExchange> {
    this.requireConnected()
    try {
      const result = this.hub.exchangeStateVector(this, cloneBytes(stateVector))
      return Object.freeze({
        remoteStateVector: cloneBytes(result.remoteStateVector),
        missingRemoteUpdate: cloneBytes(result.missingRemoteUpdate)
      })
    } catch (error) {
      return this.failTransport(error)
    }
  }

  async sendSyncUpdate(update: Uint8Array): Promise<void> {
    this.requireConnected()
    try {
      this.hub.receiveSyncUpdate(this, cloneBytes(update))
    } catch (error) {
      this.failTransport(error)
    }
  }

  onAcknowledgement(
    subscriber: (acknowledgement: ProviderAcknowledgement) => void
  ): () => void {
    return this.subscribe(this.acknowledgementSubscribers, subscriber)
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

  receiveUpdate(update: InboundBinaryUpdate): void {
    if (this.status !== 'connected') return
    ;[...this.updateSubscribers].forEach((subscriber) => {
      try {
        subscriber({ ...update, update: cloneBytes(update.update) })
      } catch {
        // Provider observers cannot alter transport settlement.
      }
    })
  }

  receiveAcknowledgement(acknowledgement: ProviderAcknowledgement): void {
    if (this.status !== 'connected') return
    this.emit(
      this.acknowledgementSubscribers,
      Object.freeze({ ...acknowledgement })
    )
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

  private setStatus(status: CollaborationProviderStatus): void {
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
