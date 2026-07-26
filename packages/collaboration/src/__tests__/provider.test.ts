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

  it('fans out one detached ordered publication batch through the hub once', async () => {
    const acknowledgePublication = vi.fn()
    const acknowledgePublications = vi.fn(() => true)
    const hub = new MemoryHub({
      acknowledgePublication,
      acknowledgePublications
    })
    const sender = new MemoryProvider(
      hub,
      identity('actor-a')
    ) as MemoryProvider & {
      sendPublications(
        publications: readonly SharedPublication[]
      ): Promise<void>
    }
    const receiver = new MemoryProvider(
      hub,
      identity('actor-b')
    ) as MemoryProvider & {
      onPublications(
        subscriber: (
          publications: readonly {
            publication: SharedPublication
            fromActorId?: string
          }[]
        ) => void
      ): () => void
    }
    const inbound = vi.fn()
    receiver.onPublications(inbound)
    await sender.connect()
    await receiver.connect()
    const publications = [
      publication('publication-a', 1),
      publication('publication-b', 2)
    ] as const

    await sender.sendPublications(publications)

    expect(inbound).toHaveBeenCalledOnce()
    expect(inbound).toHaveBeenCalledWith([
      { publication: publications[0], fromActorId: 'actor-a' },
      { publication: publications[1], fromActorId: 'actor-a' }
    ])
    expect(inbound.mock.calls[0]?.[0]).not.toBe(publications)
    expect(inbound.mock.calls[0]?.[0][0].publication).not.toBe(publications[0])
    expect(acknowledgePublications).toHaveBeenCalledOnce()
    expect(acknowledgePublications).toHaveBeenCalledWith(
      publications,
      sender.identity
    )
    expect(acknowledgePublication).not.toHaveBeenCalled()
  })

  it('does not fall back to per-publication clone work for an unguarded hub batch', async () => {
    const hub = new MemoryHub()
    const sender = new MemoryProvider(hub, identity('actor-a'))
    const receiver = new MemoryProvider(hub, identity('actor-b'))
    const inbound = vi.fn()
    receiver.onPublications(inbound)
    await sender.connect()
    await receiver.connect()
    const phaseSink = vi.fn()
    ;(
      globalThis as typeof globalThis & {
        __asyraBrowserDragPhaseSink?: (
          phaseName: string,
          durationMs: number
        ) => void
      }
    ).__asyraBrowserDragPhaseSink = phaseSink

    try {
      await sender.sendPublications([
        publication('publication-a', 1),
        publication('publication-b', 2)
      ])
    } finally {
      delete (
        globalThis as typeof globalThis & {
          __asyraBrowserDragPhaseSink?: unknown
        }
      ).__asyraBrowserDragPhaseSink
    }

    expect(inbound).toHaveBeenCalledOnce()
    const phaseNames = phaseSink.mock.calls.map(([phaseName]) => phaseName)
    expect(phaseNames).not.toContain('collaboration:clone-publication')
    expect(
      phaseNames.filter(
        (phaseName) => phaseName === 'collaboration:clone-publications'
      )
    ).toHaveLength(2)
    expect(phaseNames).not.toContain('collaboration:clone-inbound-publications')
  })

  it('isolates multiple batch subscribers without adding a single-item path', async () => {
    const hub = new MemoryHub()
    const sender = new MemoryProvider(hub, identity('actor-a'))
    const receiver = new MemoryProvider(hub, identity('actor-b'))
    const secondInbound = vi.fn()
    receiver.onPublications((inbound) => {
      const payload = inbound[0]?.publication.deliveries[0]?.payload as {
        value: number
      }
      payload.value = 999
    })
    receiver.onPublications(secondInbound)
    await sender.connect()
    await receiver.connect()
    const sent = publication('publication-a', 1)

    await sender.sendPublications([sent, publication('publication-b', 2)])

    expect(secondInbound).toHaveBeenCalledOnce()
    expect(
      (
        secondInbound.mock.calls[0]?.[0][0].publication.deliveries[0]
          ?.payload as { value: number }
      ).value
    ).toBe(1)
    expect((sent.deliveries[0]?.payload as { value: number }).value).toBe(1)
  })

  it('isolates legacy single subscribers from batch subscriber mutation', async () => {
    const hub = new MemoryHub()
    const sender = new MemoryProvider(hub, identity('actor-a'))
    const receiver = new MemoryProvider(hub, identity('actor-b'))
    const singleInbound = vi.fn()
    receiver.onPublications((inbound) => {
      const payload = inbound[0]?.publication.deliveries[0]?.payload as {
        value: number
      }
      payload.value = 999
    })
    receiver.onPublication(singleInbound)
    await sender.connect()
    await receiver.connect()

    await sender.sendPublications([
      publication('publication-a', 1),
      publication('publication-b', 2)
    ])

    expect(
      (
        singleInbound.mock.calls[0]?.[0].publication.deliveries[0]?.payload as {
          value: number
        }
      ).value
    ).toBe(1)
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
