import type { SharedPublication } from '@asyra/factory'
import { describe, expect, it, vi } from 'vitest'
// @ts-expect-error InboundPublication was removed from the public contract.
import type { InboundPublication } from '..'
// @ts-expect-error InboundPublicationLease was removed from the public contract.
import type { InboundPublicationLease } from '..'
// @ts-expect-error InboundPublicationLeaseSettlement was removed from the public contract.
import type { InboundPublicationLeaseSettlement } from '..'
import type { Provider } from '../provider'
import * as providerContract from '../provider'
import { PROVIDER_FAILURE_CODES, isProviderFailureCode } from '../provider'
import { MemoryHub, MemoryProvider } from '../providers/memory'
import type { MemoryHubOptions } from '../providers/memory'
import { createSharedPublicationFixture } from './shared-publication-fixture'

type RemovedProviderCapability = Extract<
  keyof Provider,
  | 'maxConcurrentPublicationSends'
  | 'maxPublicationsPerSend'
  | 'onInboundPublicationLease'
  | 'onPublications'
  | 'sendPublications'
>
type RemovedMemoryHubCapability = Extract<
  keyof MemoryHubOptions,
  'acknowledgePublications'
>

const REMOVED_PROVIDER_CAPABILITIES: Record<RemovedProviderCapability, never> =
  {}
const REMOVED_MEMORY_HUB_CAPABILITIES: Record<
  RemovedMemoryHubCapability,
  never
> = {}
type RemovedProviderExportProbe = [
  InboundPublication,
  InboundPublicationLease,
  InboundPublicationLeaseSettlement
]
const REMOVED_PROVIDER_EXPORT_PROBE: RemovedProviderExportProbe | undefined =
  undefined

const identity = (actorId: string, roomId = 'room-a') => ({
  documentId: 'document-a',
  roomId,
  actorId,
  connectionMetadata: { token: `token-for-${actorId}` }
})

const firstDeliveryOf = (publication: SharedPublication | undefined) =>
  publication?.slices[0]?.batches[0]?.deliveries[0]

const publication = (publicationId: string, value: number): SharedPublication =>
  createSharedPublicationFixture({
    mode: 'progressive',
    publicationId,
    transactionId: value,
    delivery: {
      deliveryId: `${publicationId}:delivery`,
      channel: 'scene',
      eventName: 'set-value',
      orderedIds: [publicationId],
      payload: { value }
    }
  })

describe('replaceable collaboration Provider contract', () => {
  it('does not expose removed compatibility capabilities', () => {
    const provider = new MemoryProvider(new MemoryHub(), identity('actor-a'))

    expect(Object.keys(REMOVED_PROVIDER_CAPABILITIES)).toEqual([])
    expect(Object.keys(REMOVED_MEMORY_HUB_CAPABILITIES)).toEqual([])
    expect(REMOVED_PROVIDER_EXPORT_PROBE).toBeUndefined()
    expect(providerContract).not.toHaveProperty('createInboundPublicationLease')
    expect(provider).not.toHaveProperty('sendPublications')
    expect(provider).not.toHaveProperty('onPublications')
    expect(provider).not.toHaveProperty('onInboundPublicationLease')
    expect(provider).not.toHaveProperty('maxConcurrentPublicationSends')
    expect(provider).not.toHaveProperty('maxPublicationsPerSend')
  })

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

  it('transports one detached publication to a live room peer without sender echo', async () => {
    const hub = new MemoryHub()
    const sender = new MemoryProvider(hub, identity('actor-a'))
    const receiver = new MemoryProvider(hub, identity('actor-b'))
    const senderInbound = vi.fn(async () => undefined)
    let received: SharedPublication | undefined
    sender.onPublication(senderInbound)
    receiver.onPublication(async (inbound) => {
      received = inbound
    })
    await sender.connect()
    await receiver.connect()
    const sent = publication('publication-a', 1)

    await sender.sendPublication(sent)

    expect(senderInbound).not.toHaveBeenCalled()
    expect(received).toEqual(sent)
    expect(received).not.toBe(sent)
    expect(firstDeliveryOf(received)?.payload).not.toBe(
      firstDeliveryOf(sent)?.payload
    )
    expect((firstDeliveryOf(sent)?.payload as { value: number }).value).toBe(1)
  })

  it('allows exactly one active async publication consumer and releases the slot on unsubscribe', () => {
    const provider = new MemoryProvider(new MemoryHub(), identity('actor-a'))
    const firstConsumer = vi.fn(async () => undefined)
    const secondConsumer = vi.fn(async () => undefined)

    const unsubscribeFirst = provider.onPublication(firstConsumer)

    expect(() => provider.onPublication(secondConsumer)).toThrow()

    unsubscribeFirst()

    expect(() => provider.onPublication(secondConsumer)).not.toThrow()
  })

  it('accepts outbound delivery without waiting for peer canonical apply', async () => {
    const hub = new MemoryHub()
    const sender = new MemoryProvider(hub, identity('actor-a'))
    const receiver = new MemoryProvider(hub, identity('actor-b'))
    let releaseConsumer: (() => void) | undefined
    const consumerSettlement = new Promise<void>((resolve) => {
      releaseConsumer = resolve
    })
    const consumer = vi.fn(() => consumerSettlement)
    receiver.onPublication(consumer)
    await sender.connect()
    await receiver.connect()

    await expect(
      sender.sendPublication(publication('publication-a', 1))
    ).resolves.toBeUndefined()

    expect(consumer).toHaveBeenCalledOnce()

    releaseConsumer?.()
    await consumerSettlement
  })

  it('bounds each memory peer to one accepted inbound publication until its consumer settles', async () => {
    const acknowledgePublication = vi.fn(() => true)
    const hub = new MemoryHub({ acknowledgePublication })
    const sender = new MemoryProvider(hub, identity('actor-a'))
    const receiver = new MemoryProvider(hub, identity('actor-b'))
    const receivePublication = vi.spyOn(receiver, 'receivePublication')
    let releaseFirst: (() => void) | undefined
    const firstSettlement = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    const consumedPublicationIds: string[] = []
    receiver.onPublication(async (inbound) => {
      consumedPublicationIds.push(inbound.publicationId)
      if (inbound.publicationId === 'publication-a') {
        await firstSettlement
      }
    })
    await sender.connect()
    await receiver.connect()

    await sender.sendPublication(publication('publication-a', 1))
    const secondAcceptance = sender.sendPublication(
      publication('publication-b', 2)
    )
    let secondAccepted = false
    void secondAcceptance.then(() => {
      secondAccepted = true
    })
    await vi.waitFor(() =>
      expect(acknowledgePublication).toHaveBeenCalledTimes(2)
    )
    await new Promise<void>((resolve) => setTimeout(resolve, 0))

    expect(receivePublication).toHaveBeenCalledOnce()
    expect(consumedPublicationIds).toEqual(['publication-a'])
    expect(secondAccepted).toBe(false)

    releaseFirst?.()
    await expect(secondAcceptance).resolves.toBeUndefined()
    await vi.waitFor(() =>
      expect(consumedPublicationIds).toEqual(['publication-a', 'publication-b'])
    )
  })

  it('removes the connection-end waiter when app settlement wins the capacity race', async () => {
    const acknowledgePublication = vi.fn(() => true)
    const hub = new MemoryHub({ acknowledgePublication })
    const sender = new MemoryProvider(hub, identity('actor-a'))
    const receiver = new MemoryProvider(hub, identity('actor-b'))
    let releaseFirst: (() => void) | undefined
    const firstSettlement = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    receiver.onPublication(async (inbound) => {
      if (inbound.publicationId === 'publication-a') {
        await firstSettlement
      }
    })
    await sender.connect()
    await receiver.connect()

    await sender.sendPublication(publication('publication-a', 1))
    const secondAcceptance = sender.sendPublication(
      publication('publication-b', 2)
    )
    await vi.waitFor(() =>
      expect(acknowledgePublication).toHaveBeenCalledTimes(2)
    )
    const connection = (
      hub as unknown as {
        peerConnections: Map<
          MemoryProvider,
          { readonly endWaiters: ReadonlySet<() => void> }
        >
      }
    ).peerConnections.get(receiver)

    await vi.waitFor(() => expect(connection?.endWaiters.size).toBe(1))

    releaseFirst?.()
    await secondAcceptance

    expect(connection?.endWaiters.size).toBe(0)
  })

  it('releases a disconnected peer capacity waiter and never replays it after reconnect', async () => {
    const acknowledgePublication = vi.fn(() => true)
    const hub = new MemoryHub({ acknowledgePublication })
    const sender = new MemoryProvider(hub, identity('actor-a'))
    const receiver = new MemoryProvider(hub, identity('actor-b'))
    let releaseFirst: (() => void) | undefined
    const firstSettlement = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    const consumedPublicationIds: string[] = []
    receiver.onPublication(async (inbound) => {
      consumedPublicationIds.push(inbound.publicationId)
      if (inbound.publicationId === 'publication-a') {
        await firstSettlement
      }
    })
    await sender.connect()
    await receiver.connect()

    await sender.sendPublication(publication('publication-a', 1))
    const staleAcceptance = sender.sendPublication(
      publication('publication-b', 2)
    )
    let staleAccepted = false
    void staleAcceptance.then(() => {
      staleAccepted = true
    })
    await vi.waitFor(() =>
      expect(acknowledgePublication).toHaveBeenCalledTimes(2)
    )

    await receiver.disconnect()
    await new Promise<void>((resolve) => setTimeout(resolve, 0))

    expect(staleAccepted).toBe(true)
    expect(consumedPublicationIds).toEqual(['publication-a'])

    await receiver.reconnect()
    const futureAcceptance = sender.sendPublication(
      publication('publication-c', 3)
    )
    let futureAccepted = false
    void futureAcceptance.then(() => {
      futureAccepted = true
    })
    await vi.waitFor(() =>
      expect(acknowledgePublication).toHaveBeenCalledTimes(3)
    )
    await new Promise<void>((resolve) => setTimeout(resolve, 0))

    expect(futureAccepted).toBe(true)
    expect(consumedPublicationIds).toEqual(['publication-a'])

    releaseFirst?.()
    await Promise.all([staleAcceptance, futureAcceptance])
    await vi.waitFor(() =>
      expect(consumedPublicationIds).toEqual(['publication-a', 'publication-c'])
    )
  })

  it('keeps inbound delivery pending until the exclusive async consumer settles', async () => {
    const receiver = new MemoryProvider(
      new MemoryHub(),
      identity('actor-b')
    ) as MemoryProvider & {
      receivePublication(publication: SharedPublication): Promise<void>
    }
    let releaseConsumer: (() => void) | undefined
    const consumerSettlement = new Promise<void>((resolve) => {
      releaseConsumer = resolve
    })
    const consumer = vi.fn(() => consumerSettlement)
    receiver.onPublication(consumer)
    await receiver.connect()

    expect(receiver.receivePublication).toBeTypeOf('function')

    const inboundDelivery = receiver.receivePublication(
      publication('publication-a', 1)
    )
    const deliveryOutcome = vi.fn()
    void inboundDelivery.then(
      () => deliveryOutcome('resolved'),
      () => deliveryOutcome('rejected')
    )

    await vi.waitFor(() => expect(consumer).toHaveBeenCalledOnce())
    await Promise.resolve()

    expect(deliveryOutcome).not.toHaveBeenCalled()

    releaseConsumer?.()
    await expect(inboundDelivery).resolves.toBeUndefined()
    expect(deliveryOutcome).toHaveBeenCalledWith('resolved')
  })

  it('returns the exclusive async consumer rejection to the inbound delivery caller', async () => {
    const receiver = new MemoryProvider(
      new MemoryHub(),
      identity('actor-b')
    ) as MemoryProvider & {
      receivePublication(publication: SharedPublication): Promise<void>
    }
    const failure = new Error('canonical apply failed')
    const consumerRejection = Promise.reject(failure)
    void consumerRejection.catch(() => undefined)
    receiver.onPublication(() => consumerRejection)
    await receiver.connect()

    expect(receiver.receivePublication).toBeTypeOf('function')

    await expect(
      receiver.receivePublication(publication('publication-a', 1))
    ).rejects.toBe(failure)
  })

  it('releases memory peer capacity after one app rejection without retrying or reporting a transport failure', async () => {
    const hub = new MemoryHub()
    const sender = new MemoryProvider(hub, identity('actor-a'))
    const receiver = new MemoryProvider(hub, identity('actor-b'))
    const failure = new Error('canonical apply failed')
    const receivedPublicationIds: string[] = []
    const providerFailure = vi.fn()
    receiver.onFailure(providerFailure)
    receiver.onPublication(async (inbound) => {
      receivedPublicationIds.push(inbound.publicationId)
      if (inbound.publicationId === 'publication-a') throw failure
    })
    await sender.connect()
    await receiver.connect()

    await expect(
      sender.sendPublication(publication('publication-a', 1))
    ).resolves.toBeUndefined()
    await expect(
      sender.sendPublication(publication('publication-b', 2))
    ).resolves.toBeUndefined()
    await vi.waitFor(() =>
      expect(receivedPublicationIds).toEqual(['publication-a', 'publication-b'])
    )

    expect(
      receivedPublicationIds.filter(
        (publicationId) => publicationId === 'publication-a'
      )
    ).toHaveLength(1)
    expect(providerFailure).not.toHaveBeenCalled()
  })

  it('forwards repeated equal publications without deduplicating them', async () => {
    const hub = new MemoryHub()
    const sender = new MemoryProvider(hub, identity('actor-a'))
    const receiver = new MemoryProvider(hub, identity('actor-b'))
    const receivedPublicationIds: string[] = []
    receiver.onPublication(async (inbound) => {
      receivedPublicationIds.push(inbound.publicationId)
    })
    await sender.connect()
    await receiver.connect()
    const repeated = publication('publication-a', 1)

    await sender.sendPublication(repeated)
    await sender.sendPublication(repeated)

    expect(receivedPublicationIds).toEqual(['publication-a', 'publication-a'])
  })

  it('isolates rooms and reconnects to future publications without replay', async () => {
    const hub = new MemoryHub()
    const sender = new MemoryProvider(hub, identity('actor-a'))
    const peer = new MemoryProvider(hub, identity('actor-b'))
    const otherRoom = new MemoryProvider(hub, identity('actor-c', 'room-b'))
    const peerPublicationIds: string[] = []
    const otherRoomPublicationIds: string[] = []
    peer.onPublication(async (inbound) => {
      peerPublicationIds.push(inbound.publicationId)
    })
    otherRoom.onPublication(async (inbound) => {
      otherRoomPublicationIds.push(inbound.publicationId)
    })
    await sender.connect()
    await peer.connect()
    await otherRoom.connect()

    await sender.sendPublication(publication('publication-1', 1))
    await peer.disconnect()
    await sender.sendPublication(publication('publication-2', 2))
    await peer.reconnect()

    expect(peerPublicationIds).toEqual(['publication-1'])
    expect(otherRoomPublicationIds).toEqual([])

    await sender.sendPublication(publication('publication-3', 3))

    expect(peerPublicationIds).toEqual(['publication-1', 'publication-3'])
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
