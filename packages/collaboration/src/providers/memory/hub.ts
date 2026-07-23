import type { SharedPublication } from '@asyra/factory'
import {
  ProviderFailure,
  type InboundPublication,
  type ProviderAwarenessDisconnect,
  type ProviderAwarenessMessage,
  type ProviderIdentity
} from '../../provider'
import { cloneAwareness, clonePublication } from '../../cloning'

export interface MemoryHubOptions {
  authorizeConnection?: (
    identity: ProviderIdentity
  ) => boolean | Promise<boolean>
  acknowledgePublication?: (
    publication: SharedPublication,
    identity: ProviderIdentity
  ) => boolean | Promise<boolean>
}

export interface MemoryPeer {
  readonly identity: ProviderIdentity
  receivePublication(publication: InboundPublication): void
  receiveAwareness(message: ProviderAwarenessMessage): void
  receiveAwarenessDisconnect(event: ProviderAwarenessDisconnect): void
}

interface MemoryRoom {
  readonly providers: Map<MemoryPeer, symbol>
}

const roomKey = (identity: ProviderIdentity): string =>
  JSON.stringify([identity.documentId, identity.roomId])

export class MemoryHub {
  private readonly rooms = new Map<string, MemoryRoom>()
  private readonly authorizeConnection?: MemoryHubOptions['authorizeConnection']
  private readonly acknowledgePublication?: MemoryHubOptions['acknowledgePublication']

  constructor(options: MemoryHubOptions = {}) {
    this.authorizeConnection = options.authorizeConnection
    this.acknowledgePublication = options.acknowledgePublication
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
    const key = roomKey(peer.identity)
    const room = this.rooms.get(key)
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
    if (room.providers.size === 0) this.rooms.delete(key)
  }

  async receivePublication(
    sender: MemoryPeer,
    publication: SharedPublication
  ): Promise<void> {
    const room = this.room(sender.identity)
    let acknowledged = true
    try {
      acknowledged =
        (await this.acknowledgePublication?.(
          clonePublication(publication),
          sender.identity
        )) ?? true
    } catch (error) {
      throw new ProviderFailure(
        'acknowledgement-failed',
        '[collaboration] publication acknowledgement failed',
        error,
        publication.publicationId
      )
    }
    if (!acknowledged) {
      throw new ProviderFailure(
        'acknowledgement-failed',
        '[collaboration] publication acknowledgement was rejected',
        undefined,
        publication.publicationId
      )
    }

    room.providers.forEach((_token, peer) => {
      if (peer === sender) return
      peer.receivePublication(
        Object.freeze({
          publication: clonePublication(publication),
          fromActorId: sender.identity.actorId
        })
      )
    })
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

  private room(identity: ProviderIdentity): MemoryRoom {
    const key = roomKey(identity)
    let room = this.rooms.get(key)
    if (!room) {
      room = { providers: new Map() }
      this.rooms.set(key, room)
    }
    return room
  }
}
