import type {
  SharedPublication,
  SharedPublicationSubscriber
} from '@asyra/factory'
import { describe, expect, it, vi } from 'vitest'
import {
  Awareness,
  DisposalError,
  createCollaboration,
  type CreateCollaborationInput,
  type InboundPublication,
  type Provider
} from '..'

const publication: SharedPublication = {
  publicationId: 'publication-a',
  transactionId: 1,
  origin: 'action',
  deliveries: [
    {
      deliveryId: 'delivery-a',
      transactionId: 1,
      origin: 'action',
      kind: 'forward',
      channel: 'document',
      eventName: 'set-value',
      payload: { value: 1 },
      sharedDelivery: 'immediate'
    }
  ]
}

const createProvider = (overrides: Partial<Provider> = {}): Provider => ({
  identity: {
    documentId: 'document-a',
    roomId: 'room-a',
    actorId: 'actor-a'
  },
  connect: vi.fn(),
  disconnect: vi.fn(),
  reconnect: vi.fn(),
  destroy: vi.fn(),
  getStatus: vi.fn((): ReturnType<Provider['getStatus']> => 'idle'),
  onStatusChange: vi.fn(() => () => undefined),
  sendPublication: vi.fn(),
  onPublication: vi.fn(() => () => undefined),
  sendAwareness: vi.fn(),
  onAwareness: vi.fn(() => () => undefined),
  onAwarenessDisconnect: vi.fn(() => () => undefined),
  onFailure: vi.fn(() => () => undefined),
  ...overrides
})

const input = (
  overrides: Partial<CreateCollaborationInput> = {}
): CreateCollaborationInput => ({
  documentId: 'document-a',
  roomId: 'room-a',
  actorId: 'actor-a',
  factory: {
    subscribeToSharedPublication: vi.fn(() => () => undefined)
  },
  processRemotePublication: vi.fn(),
  ...overrides
})

describe('Collaboration ownership, processing, and disposal', () => {
  it('creates isolated Awareness only for explicit instances and no Y.Doc', () => {
    const first = createCollaboration(input())
    const second = createCollaboration(
      input({ documentId: 'document-b', roomId: 'room-b', actorId: 'actor-b' })
    )

    expect(first.awareness).toBeInstanceOf(Awareness)
    expect(first.awareness).not.toBe(second.awareness)
    expect('yDoc' in first).toBe(false)
    expect(first.provider).toBeUndefined()
  })

  it('does not connect an injected Provider during construction', () => {
    const provider = createProvider()
    const instance = createCollaboration(input({ provider }))

    expect(instance.provider).toBe(provider)
    expect(provider.connect).not.toHaveBeenCalled()
    expect(provider.onPublication).not.toHaveBeenCalled()
  })

  it('delivers one detached inbound publication to the app once', async () => {
    let subscriber: ((inbound: InboundPublication) => void) | undefined
    const provider = createProvider({
      onPublication: vi.fn((next) => {
        subscriber = next
        return () => undefined
      })
    })
    const processRemotePublication = vi.fn()
    const instance = createCollaboration(
      input({ provider, processRemotePublication })
    )
    await instance.start()

    subscriber?.({ publication, fromActorId: 'actor-b' })
    await instance.whenIdle()

    expect(processRemotePublication).toHaveBeenCalledOnce()
    expect(processRemotePublication).toHaveBeenCalledWith(publication, {
      fromActorId: 'actor-b'
    })

    const received = processRemotePublication.mock.calls[0]?.[0]
    expect(received).not.toBe(publication)
    expect(received.deliveries).not.toBe(publication.deliveries)
  })

  it('reports app callback failure without retry or semantic handling', async () => {
    let subscriber: ((inbound: InboundPublication) => void) | undefined
    const failure = new Error('app rejected publication')
    const provider = createProvider({
      onPublication: vi.fn((next) => {
        subscriber = next
        return () => undefined
      })
    })
    const processRemotePublication = vi.fn(() => {
      throw failure
    })
    const instance = createCollaboration(
      input({ provider, processRemotePublication })
    )
    const outcomes: unknown[] = []
    instance.observePublicationOutcomes((outcome) => outcomes.push(outcome))
    await instance.start()

    subscriber?.({ publication, fromActorId: 'actor-b' })
    await instance.whenIdle()

    expect(processRemotePublication).toHaveBeenCalledOnce()
    expect(outcomes).toEqual([
      {
        direction: 'remote',
        status: 'process-failed',
        publicationId: 'publication-a',
        fromActorId: 'actor-b',
        error: failure
      }
    ])
  })

  it('destroys owned resources once and detaches all observers', async () => {
    const awareness = new Awareness()
    const detachSharedPublication = vi.fn()
    const detachProviderPublication = vi.fn()
    const provider = createProvider({
      onPublication: vi.fn(() => detachProviderPublication)
    })
    const disposeAwareness = vi.fn()
    awareness.dispose = disposeAwareness
    const instance = createCollaboration(
      input({
        awareness,
        provider,
        factory: {
          subscribeToSharedPublication: vi.fn(() => detachSharedPublication)
        },
        resourceOwnership: {
          awareness: 'owned',
          provider: 'owned'
        }
      })
    )

    await instance.start()
    await instance.dispose()
    await instance.dispose()

    expect(detachSharedPublication).toHaveBeenCalledTimes(1)
    expect(detachProviderPublication).toHaveBeenCalledTimes(1)
    expect(provider.destroy).toHaveBeenCalledTimes(1)
    expect(disposeAwareness).toHaveBeenCalledTimes(1)
    expect(instance.isDisposed()).toBe(true)
  })

  it('destroys an owned Provider before awaiting a pending connection', async () => {
    let rejectConnect: ((error: Error) => void) | undefined
    const connectFailure = new Error('connection aborted by disposal')
    const provider = createProvider({
      connect: vi.fn(
        () =>
          new Promise<void>((_resolve, reject) => {
            rejectConnect = reject
          })
      ),
      destroy: vi.fn(async () => rejectConnect?.(connectFailure))
    })
    const instance = createCollaboration(
      input({ provider, resourceOwnership: { provider: 'owned' } })
    )
    const startPromise = instance.start().catch((error) => error)
    await Promise.resolve()

    const disposePromise = instance.dispose()

    await vi.waitFor(() => expect(provider.destroy).toHaveBeenCalledOnce(), {
      timeout: 100
    })
    rejectConnect?.(connectFailure)
    await Promise.all([startPromise, disposePromise])
  })

  it('bypasses queued local publication after disposal begins', async () => {
    let subscriber: SharedPublicationSubscriber | undefined
    const provider = createProvider()
    const instance = createCollaboration(
      input({
        provider,
        factory: {
          subscribeToSharedPublication: vi.fn((next) => {
            subscriber = next
            return () => undefined
          })
        }
      })
    )
    await instance.start()

    subscriber?.(publication)
    await instance.dispose()

    expect(provider.sendPublication).not.toHaveBeenCalled()
  })

  it('aggregates owned cleanup failures', async () => {
    const providerFailure = new Error('provider destroy failed')
    const awarenessFailure = new Error('awareness dispose failed')
    const awareness = new Awareness()
    awareness.dispose = vi.fn(() => {
      throw awarenessFailure
    })
    const provider = createProvider({
      destroy: vi.fn(() => Promise.reject(providerFailure))
    })
    const instance = createCollaboration(
      input({
        provider,
        awareness,
        resourceOwnership: { provider: 'owned', awareness: 'owned' }
      })
    )

    await expect(instance.dispose()).rejects.toEqual(
      expect.objectContaining<Partial<DisposalError>>({
        failures: [providerFailure, awarenessFailure]
      })
    )
  })
})
