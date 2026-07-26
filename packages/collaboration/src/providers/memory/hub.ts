import type { SharedPublication } from '@asyra/factory'
import {
  ProviderFailure,
  type InboundPublication,
  type ProviderAwarenessDisconnect,
  type ProviderAwarenessMessage,
  type ProviderIdentity
} from '../../provider'
import {
  cloneAwareness,
  clonePublication,
  clonePublications
} from '../../cloning'

export interface MemoryHubOptions {
  authorizeConnection?: (
    identity: ProviderIdentity
  ) => boolean | Promise<boolean>
  acknowledgePublication?: (
    publication: SharedPublication,
    identity: ProviderIdentity
  ) => boolean | Promise<boolean>
  acknowledgePublications?: (
    publications: readonly SharedPublication[],
    identity: ProviderIdentity
  ) => boolean | Promise<boolean>
}

export interface MemoryPeer {
  readonly identity: ProviderIdentity
  receivePublications(publications: readonly InboundPublication[]): void
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
  private readonly acknowledgePublications?: MemoryHubOptions['acknowledgePublications']

  constructor(options: MemoryHubOptions = {}) {
    this.authorizeConnection = options.authorizeConnection
    this.acknowledgePublication = options.acknowledgePublication
    this.acknowledgePublications = options.acknowledgePublications
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
    await this.receivePublications(sender, [publication])
  }

  async receivePublications(
    sender: MemoryPeer,
    publications: readonly SharedPublication[]
  ): Promise<void> {
    if (publications.length === 0) return
    const room = this.room(sender.identity)
    const detached = publications
    if (this.acknowledgePublications) {
      await this.requireBatchAcknowledgement(detached, sender.identity)
    } else {
      for (const publication of detached) {
        await this.requirePublicationAcknowledgement(
          publication,
          sender.identity
        )
      }
    }

    room.providers.forEach((_token, peer) => {
      if (peer === sender) return
      peer.receivePublications(
        clonePublications(detached).map((publication) =>
          Object.freeze({
            publication,
            fromActorId: sender.identity.actorId
          })
        )
      )
    })
  }

  private async requireBatchAcknowledgement(
    publications: readonly SharedPublication[],
    identity: ProviderIdentity
  ): Promise<void> {
    let acknowledged = true
    try {
      acknowledged =
        (await this.acknowledgePublications?.(
          clonePublications(publications),
          identity
        )) ?? true
    } catch (error) {
      throw new ProviderFailure(
        'acknowledgement-failed',
        '[collaboration] publication batch acknowledgement failed',
        error
      )
    }
    if (!acknowledged) {
      throw new ProviderFailure(
        'acknowledgement-failed',
        '[collaboration] publication batch acknowledgement was rejected'
      )
    }
  }

  private async requirePublicationAcknowledgement(
    publication: SharedPublication,
    identity: ProviderIdentity
  ): Promise<void> {
    let acknowledged = true
    try {
      acknowledged =
        (await this.acknowledgePublication?.(
          clonePublication(publication),
          identity
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
