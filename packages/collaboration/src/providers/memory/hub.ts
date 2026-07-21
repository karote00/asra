import * as Y from 'yjs'
import { applyInboundYjsUpdate, type YjsBinaryUpdate } from '../../yjs-document'
import {
  ProviderFailure,
  type InboundBinaryUpdate,
  type ProviderAcknowledgement,
  type ProviderAwarenessDisconnect,
  type ProviderAwarenessMessage,
  type ProviderIdentity,
  type ProviderStateVectorExchange
} from '../../provider'
import { cloneAwareness, cloneBytes } from './cloning'

export interface MemoryHubOptions {
  authorizeConnection?: (
    identity: ProviderIdentity
  ) => boolean | Promise<boolean>
  acknowledgeUpdate?: (
    update: YjsBinaryUpdate,
    identity: ProviderIdentity
  ) => boolean | Promise<boolean>
}

export interface MemoryPeer {
  readonly identity: ProviderIdentity
  receiveUpdate(update: InboundBinaryUpdate): void
  receiveAcknowledgement(acknowledgement: ProviderAcknowledgement): void
  receiveAwareness(message: ProviderAwarenessMessage): void
  receiveAwarenessDisconnect(event: ProviderAwarenessDisconnect): void
}

interface MemoryRoom {
  readonly document: Y.Doc
  readonly providers: Map<MemoryPeer, symbol>
}

const roomKey = (identity: ProviderIdentity): string =>
  JSON.stringify([identity.documentId, identity.roomId])

const validateUpdateAuthors = (
  document: Y.Doc,
  update: Uint8Array,
  actorId: string
): void => {
  const stagedDocument = new Y.Doc()
  try {
    Y.applyUpdate(stagedDocument, Y.encodeStateAsUpdate(document))
    const decoded = applyInboundYjsUpdate(stagedDocument, update, 'provider')
    for (const operation of decoded.operations) {
      if (
        !operation ||
        typeof operation !== 'object' ||
        Array.isArray(operation)
      ) {
        throw new Error(
          '[collaboration] provider history operation must be a record'
        )
      }
      const descriptor = Object.getOwnPropertyDescriptor(operation, 'actorId')
      if (
        !descriptor ||
        !('value' in descriptor) ||
        descriptor.value !== actorId
      ) {
        throw new Error(
          '[collaboration] provider history operation actor must match the authenticated sender'
        )
      }
    }
  } finally {
    stagedDocument.destroy()
  }
}

export class MemoryHub {
  private readonly rooms = new Map<string, MemoryRoom>()
  private readonly authorizeConnection?: MemoryHubOptions['authorizeConnection']
  private readonly acknowledgeUpdate?: MemoryHubOptions['acknowledgeUpdate']

  constructor(options: MemoryHubOptions = {}) {
    this.authorizeConnection = options.authorizeConnection
    this.acknowledgeUpdate = options.acknowledgeUpdate
  }

  async connect(peer: MemoryPeer, connectionToken: symbol): Promise<void> {
    let authorized = true
    try {
      authorized = (await this.authorizeConnection?.(peer.identity)) ?? true
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
    this.room(peer.identity).providers.set(peer, connectionToken)
  }

  disconnect(peer: MemoryPeer, connectionToken?: symbol): void {
    const room = this.rooms.get(roomKey(peer.identity))
    if (!room) return
    if (
      connectionToken !== undefined &&
      room.providers.get(peer) !== connectionToken
    ) {
      return
    }
    if (!room.providers.delete(peer)) return

    const event: ProviderAwarenessDisconnect = Object.freeze({
      actorId: peer.identity.actorId,
      reason: 'disconnect'
    })
    room.providers.forEach((_token, connectedPeer) =>
      connectedPeer.receiveAwarenessDisconnect(event)
    )
  }

  async receiveUpdate(
    sender: MemoryPeer,
    binary: YjsBinaryUpdate
  ): Promise<void> {
    const room = this.room(sender.identity)
    if (binary.update.byteLength > 0) {
      validateUpdateAuthors(
        room.document,
        binary.update,
        sender.identity.actorId
      )
      applyInboundYjsUpdate(room.document, binary.update, 'provider')
      room.providers.forEach((_token, peer) => {
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
    sender: MemoryPeer,
    message: ProviderAwarenessMessage
  ): void {
    const room = this.room(sender.identity)
    room.providers.forEach((_token, peer) => {
      if (peer === sender) return
      peer.receiveAwareness(cloneAwareness(message))
    })
  }

  sync(peer: MemoryPeer, stateVector: Uint8Array): Uint8Array {
    const document = this.room(peer.identity).document
    return stateVector.byteLength === 0
      ? Y.encodeStateAsUpdate(document)
      : Y.encodeStateAsUpdate(document, stateVector)
  }

  exchangeStateVector(
    peer: MemoryPeer,
    stateVector: Uint8Array
  ): ProviderStateVectorExchange {
    const document = this.room(peer.identity).document
    return Object.freeze({
      remoteStateVector: Y.encodeStateVector(document),
      missingRemoteUpdate:
        stateVector.byteLength === 0
          ? Y.encodeStateAsUpdate(document)
          : Y.encodeStateAsUpdate(document, stateVector)
    })
  }

  receiveSyncUpdate(sender: MemoryPeer, update: Uint8Array): void {
    if (update.byteLength <= 2) return
    const room = this.room(sender.identity)
    validateUpdateAuthors(room.document, update, sender.identity.actorId)
    applyInboundYjsUpdate(room.document, update, 'provider')
    room.providers.forEach((_token, peer) => {
      if (peer === sender) return
      peer.receiveUpdate(
        Object.freeze({
          operationId: `sync:${sender.identity.actorId}`,
          update: cloneBytes(update)
        })
      )
    })
  }

  private room(identity: ProviderIdentity): MemoryRoom {
    const key = roomKey(identity)
    let room = this.rooms.get(key)
    if (!room) {
      room = { document: new Y.Doc(), providers: new Map() }
      this.rooms.set(key, room)
    }
    return room
  }
}
