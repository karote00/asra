import type { SharedPublication } from '@asyra/factory'
import {
  ProviderFailure,
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
  receivePublication(publication: SharedPublication): Promise<void>
  receiveAwareness(message: ProviderAwarenessMessage): void
  receiveAwarenessDisconnect(event: ProviderAwarenessDisconnect): void
}

interface MemoryRoom {
  readonly providers: Map<MemoryPeer, symbol>
}

interface MemoryPeerConnection {
  readonly connectionToken: symbol
  readonly endWaiters: Set<() => void>
  readonly waitForEnd: () => Readonly<{
    ended: Promise<void>
    cancel: () => void
  }>
  readonly end: () => void
}

const roomKey = (identity: ProviderIdentity): string =>
  JSON.stringify([identity.documentId, identity.roomId])

export class MemoryHub {
  private readonly rooms = new Map<string, MemoryRoom>()
  private readonly peerAcceptanceTails = new Map<MemoryPeer, Promise<void>>()
  private readonly peerApplicationTails = new Map<MemoryPeer, Promise<void>>()
  private readonly peerConnections = new Map<MemoryPeer, MemoryPeerConnection>()
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
    this.endPeerConnection(peer)
    const endWaiters = new Set<() => void>()
    let active = true
    const connection: MemoryPeerConnection = {
      connectionToken,
      endWaiters,
      waitForEnd: () => {
        if (!active) {
          return Object.freeze({
            ended: Promise.resolve(),
            cancel: () => undefined
          })
        }
        let settle: (() => void) | undefined
        const ended = new Promise<void>((resolve) => {
          settle = () => {
            if (settle) endWaiters.delete(settle)
            resolve()
          }
        })
        if (settle) endWaiters.add(settle)
        return Object.freeze({
          ended,
          cancel: () => {
            if (settle) endWaiters.delete(settle)
          }
        })
      },
      end: () => {
        if (!active) return
        active = false
        ;[...endWaiters].forEach((settle) => settle())
      }
    }
    this.peerConnections.set(peer, connection)
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
    const activeConnectionToken = room.providers.get(peer)
    if (!room.providers.delete(peer)) return
    this.endPeerConnection(peer, activeConnectionToken)

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
    await this.requirePublicationAcknowledgement(publication, sender.identity)
    const room = this.room(sender.identity)
    const acceptances: Promise<void>[] = []
    room.providers.forEach((connectionToken, peer) => {
      if (peer === sender) return
      acceptances.push(
        this.acceptPeerPublication(room, peer, connectionToken, publication)
      )
    })
    await Promise.all(acceptances)
  }

  private acceptPeerPublication(
    room: MemoryRoom,
    peer: MemoryPeer,
    connectionToken: symbol,
    publication: SharedPublication
  ): Promise<void> {
    const previousAcceptance =
      this.peerAcceptanceTails.get(peer) ?? Promise.resolve()
    const connection = this.peerConnections.get(peer)
    const acceptance = previousAcceptance
      .catch(() => undefined)
      .then(async () => {
        const previousApplication = this.peerApplicationTails.get(peer)
        if (previousApplication) {
          if (connection?.connectionToken !== connectionToken) return
          const endWait = connection.waitForEnd()
          try {
            const capacityOutcome = await Promise.race([
              previousApplication.then(
                () => 'available' as const,
                () => 'available' as const
              ),
              endWait.ended.then(() => 'disconnected' as const)
            ])
            if (capacityOutcome === 'disconnected') return
          } finally {
            endWait.cancel()
          }
        }
        if (room.providers.get(peer) !== connectionToken) return
        const application = peer.receivePublication(
          clonePublication(publication)
        )
        this.peerApplicationTails.set(peer, application)
        void application.then(
          () => this.clearPeerApplication(peer, application),
          () => this.clearPeerApplication(peer, application)
        )
      })
    this.peerAcceptanceTails.set(peer, acceptance)
    void acceptance.then(
      () => this.clearPeerAcceptance(peer, acceptance),
      () => this.clearPeerAcceptance(peer, acceptance)
    )
    return acceptance
  }

  private clearPeerAcceptance(
    peer: MemoryPeer,
    acceptance: Promise<void>
  ): void {
    if (this.peerAcceptanceTails.get(peer) === acceptance) {
      this.peerAcceptanceTails.delete(peer)
    }
  }

  private clearPeerApplication(
    peer: MemoryPeer,
    application: Promise<void>
  ): void {
    if (this.peerApplicationTails.get(peer) === application) {
      this.peerApplicationTails.delete(peer)
    }
  }

  private endPeerConnection(peer: MemoryPeer, connectionToken?: symbol): void {
    const connection = this.peerConnections.get(peer)
    if (
      !connection ||
      (connectionToken !== undefined &&
        connection.connectionToken !== connectionToken)
    ) {
      return
    }
    this.peerConnections.delete(peer)
    this.peerApplicationTails.delete(peer)
    connection.end()
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
