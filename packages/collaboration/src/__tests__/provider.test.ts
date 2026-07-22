import type { SharedPublication } from '@asyra/factory'
import { describe, expect, it, vi } from 'vitest'
import { PROVIDER_FAILURE_CODES, isProviderFailureCode } from '../provider'
import { MemoryHub, MemoryProvider } from '../providers/memory'

const identity = (actorId: string, roomId = 'room-a') => ({
  documentId: 'document-a',
  roomId,
  actorId,
  connectionMetadata: { token: `token-for-${actorId}` }
})

const publication = (
  publicationId: string,
  value: number
): SharedPublication => ({
  publicationId,
  transactionId: value,
  origin: 'action',
  deliveries: [
    {
      deliveryId: `${publicationId}:delivery`,
      transactionId: value,
      origin: 'action',
      kind: 'forward',
      channel: 'scene',
      eventName: 'set-value',
      payload: { value },
      sharedDelivery: 'immediate'
    }
  ]
})

describe('replaceable collaboration Provider contract', () => {
  it('owns one frozen runtime registry for Provider failure codes', () => {
    expect(PROVIDER_FAILURE_CODES).toEqual([
      'connection-rejected',
      'connection-failed',
      'not-connected',
      'invalid-awareness-actor',
      'acknowledgement-failed',
      'transport-failed',
      'disposed'
    ])
    expect(Object.isFrozen(PROVIDER_FAILURE_CODES)).toBe(true)
    expect(isProviderFailureCode('transport-failed')).toBe(true)
    expect(isProviderFailureCode('unknown-provider-failure')).toBe(false)
  })

  it('transports one detached publication to live room peers without sender echo', async () => {
    const hub = new MemoryHub()
    const first = new MemoryProvider(hub, identity('actor-a'))
    const second = new MemoryProvider(hub, identity('actor-b'))
    const firstInbound = vi.fn()
    const secondInbound = vi.fn()
    first.onPublication(firstInbound)
    second.onPublication((inbound) => {
      const payload = inbound.publication.deliveries[0]?.payload as {
        value: number
      }
      payload.value = 999
    })
    second.onPublication(secondInbound)
    await first.connect()
    await second.connect()
    const sent = publication('publication-a', 1)

    await first.sendPublication(sent)

    expect(firstInbound).not.toHaveBeenCalled()
    expect(secondInbound).toHaveBeenCalledTimes(1)
    expect(secondInbound).toHaveBeenCalledWith({
      publication: sent,
      fromActorId: 'actor-a'
    })
    expect((sent.deliveries[0]?.payload as { value: number }).value).toBe(1)
  })

  it('forwards repeated equal publications instead of deduplicating them', async () => {
    const hub = new MemoryHub()
    const sender = new MemoryProvider(hub, identity('actor-a'))
    const receiver = new MemoryProvider(hub, identity('actor-b'))
    const inbound = vi.fn()
    receiver.onPublication(inbound)
    await sender.connect()
    await receiver.connect()
    const repeated = publication('publication-a', 1)

    await sender.sendPublication(repeated)
    await sender.sendPublication(repeated)

    expect(inbound).toHaveBeenCalledTimes(2)
    expect(
      inbound.mock.calls.map(([received]) => received.publication)
    ).toEqual([repeated, repeated])
  })

  it('isolates rooms and reconnects to future publications without replay', async () => {
    const hub = new MemoryHub()
    const sender = new MemoryProvider(hub, identity('actor-a'))
    const peer = new MemoryProvider(hub, identity('actor-b'))
    const otherRoom = new MemoryProvider(hub, identity('actor-c', 'room-b'))
    const peerInbound = vi.fn()
    const otherRoomInbound = vi.fn()
    peer.onPublication(peerInbound)
    otherRoom.onPublication(otherRoomInbound)
    await sender.connect()
    await peer.connect()
    await otherRoom.connect()

    await sender.sendPublication(publication('publication-1', 1))
    await peer.disconnect()
    await sender.sendPublication(publication('publication-2', 2))
    await peer.reconnect()

    expect(peerInbound).toHaveBeenCalledTimes(1)
    expect(otherRoomInbound).not.toHaveBeenCalled()

    await sender.sendPublication(publication('publication-3', 3))

    expect(peerInbound).toHaveBeenCalledTimes(2)
    expect(
      peerInbound.mock.calls.map(
        ([received]) => received.publication.publicationId
      )
    ).toEqual(['publication-1', 'publication-3'])
    expect('requestSync' in peer).toBe(false)
    expect('exchangeStateVector' in peer).toBe(false)
    expect('sendSyncUpdate' in peer).toBe(false)
  })

  it('transports opaque Awareness and emits disconnect cleanup without granting authority', async () => {
    const hub = new MemoryHub()
    const sender = new MemoryProvider(hub, identity('actor-a'))
    const receiver = new MemoryProvider(hub, identity('actor-b'))
    const awareness = vi.fn()
    const disconnect = vi.fn()
    receiver.onAwareness((message) => {
      ;(message.state as { cursor: number[] }).cursor[0] = 999
    })
    receiver.onAwareness(awareness)
    receiver.onAwarenessDisconnect(disconnect)
    await sender.connect()
    await receiver.connect()

    await sender.sendAwareness({
      actorId: 'actor-a',
      clock: 1,
      state: { cursor: [10, 20], claimedRole: 'admin' }
    })
    await sender.disconnect()

    expect(awareness).toHaveBeenCalledWith({
      actorId: 'actor-a',
      clock: 1,
      state: { cursor: [10, 20], claimedRole: 'admin' }
    })
    expect(disconnect).toHaveBeenCalledWith({
      actorId: 'actor-a',
      reason: 'disconnect'
    })
  })
})
