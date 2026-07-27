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
import { createSharedPublicationFixture } from './shared-publication-fixture'

const publication: SharedPublication = createSharedPublicationFixture({
  publicationId: 'publication-a',
  transactionId: 1,
  delivery: {
    deliveryId: 'delivery-a',
    channel: 'document',
    eventName: 'set-value',
    payload: { value: 1 },
    sharedDelivery: 'immediate'
  }
})

const publicationDelivery = (): SharedPublication['deliveries'][number] => {
  const delivery = publication.deliveries[0]
  if (!delivery) throw new Error('Fixture publication delivery is unavailable')
  return delivery
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

  it('hands one ordered source burst to a batch-capable Provider once', async () => {
    let subscriber: SharedPublicationSubscriber | undefined
    const sendPublications = vi.fn()
    const provider = Object.assign(createProvider(), { sendPublications })
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
    const outcomes: unknown[] = []
    instance.observePublicationOutcomes((outcome) => outcomes.push(outcome))
    await instance.start()
    const secondPublication = createSharedPublicationFixture({
      publicationId: 'publication-b',
      transactionId: 2,
      delivery: {
        deliveryId: 'delivery-b',
        channel: 'document',
        eventName: 'set-value',
        payload: { value: 2 },
        sharedDelivery: 'immediate'
      }
    })

    subscriber?.(publication)
    subscriber?.(secondPublication)
    await instance.whenIdle()

    expect(sendPublications).toHaveBeenCalledOnce()
    expect(sendPublications).toHaveBeenCalledWith([
      publication,
      secondPublication
    ])
    expect(provider.sendPublication).not.toHaveBeenCalled()
    expect(outcomes).toEqual([
      {
        direction: 'local',
        status: 'sent',
        publicationId: 'publication-a'
      },
      {
        direction: 'local',
        status: 'sent',
        publicationId: 'publication-b'
      }
    ])
  })

  it('reports a detached batch failure without wedging the idle boundary', async () => {
    let subscriber: SharedPublicationSubscriber | undefined
    const sendPublications = vi.fn()
    const provider = Object.assign(createProvider(), { sendPublications })
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
    const outcomes: unknown[] = []
    instance.observePublicationOutcomes((outcome) => outcomes.push(outcome))
    await instance.start()
    const invalidPublication: SharedPublication = {
      ...publication,
      deliveries: [
        {
          ...publicationDelivery(),
          payload: { invalid: () => undefined }
        }
      ]
    }

    subscriber?.(invalidPublication)
    const idleOutcome = await Promise.race([
      instance.whenIdle().then(() => 'idle'),
      new Promise<'timeout'>((resolve) =>
        setTimeout(() => resolve('timeout'), 100)
      )
    ])

    expect(idleOutcome).toBe('idle')
    expect(sendPublications).not.toHaveBeenCalled()
    expect(outcomes).toEqual([
      expect.objectContaining({
        direction: 'local',
        status: 'send-failed',
        publicationId: invalidPublication.publicationId,
        error: expect.any(Error)
      })
    ])
  })

  it('keeps a declared send window full while reporting reversed acknowledgements in source order', async () => {
    let subscriber: SharedPublicationSubscriber | undefined
    const acknowledgements: (() => void)[] = []
    const sendPublications = vi.fn<NonNullable<Provider['sendPublications']>>(
      (_publications) =>
        new Promise<void>((resolve) => {
          acknowledgements.push(resolve)
        })
    )
    const provider = Object.assign(createProvider(), {
      maxConcurrentPublicationSends: 100,
      sendPublications
    })
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
    const outcomes: unknown[] = []
    instance.observePublicationOutcomes((outcome) => outcomes.push(outcome))
    await instance.start()
    const publications = Array.from({ length: 68 }, (_, index) => ({
      ...publication,
      publicationId: `publication-${index + 1}`,
      transactionId: index + 1
    }))

    publications.forEach((next) => subscriber?.(next))
    await vi.waitFor(() => expect(sendPublications).toHaveBeenCalledTimes(16))

    expect(
      sendPublications.mock.calls.map(([batch]) =>
        batch.map(({ publicationId }: SharedPublication) => publicationId)
      )
    ).toEqual(
      Array.from({ length: 16 }, (_, batchIndex) =>
        Array.from(
          { length: 4 },
          (_value, offset) => `publication-${batchIndex * 4 + offset + 1}`
        )
      )
    )
    expect(provider.sendPublication).not.toHaveBeenCalled()
    ;[...acknowledgements].reverse().forEach((acknowledge) => acknowledge())
    await vi.waitFor(() => expect(sendPublications).toHaveBeenCalledTimes(17))
    expect(outcomes).toEqual(
      publications.slice(0, 64).map(({ publicationId }) => ({
        direction: 'local',
        status: 'sent',
        publicationId
      }))
    )

    acknowledgements[16]?.()
    await instance.whenIdle()

    expect(
      sendPublications.mock.calls[16]?.[0].map(
        ({ publicationId }: SharedPublication) => publicationId
      )
    ).toEqual([
      'publication-65',
      'publication-66',
      'publication-67',
      'publication-68'
    ])
    expect(outcomes).toEqual(
      publications.map(({ publicationId }) => ({
        direction: 'local',
        status: 'sent',
        publicationId
      }))
    )
  })

  it('honors a Provider single-publication request boundary without serializing the send window', async () => {
    let subscriber: SharedPublicationSubscriber | undefined
    const acknowledgements: (() => void)[] = []
    const sendPublication = vi.fn<Provider['sendPublication']>(
      (_publication) =>
        new Promise<void>((resolve) => {
          acknowledgements.push(resolve)
        })
    )
    const sendPublications = vi.fn<NonNullable<Provider['sendPublications']>>()
    const provider = Object.assign(
      createProvider({
        sendPublication
      }),
      {
        maxConcurrentPublicationSends: 5,
        maxPublicationsPerSend: 1,
        sendPublications
      }
    )
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
    const outcomes: unknown[] = []
    instance.observePublicationOutcomes((outcome) => outcomes.push(outcome))
    await instance.start()
    const publications = Array.from({ length: 5 }, (_, index) => ({
      ...publication,
      publicationId: `publication-${index + 1}`,
      transactionId: index + 1
    }))

    publications.forEach((next) => subscriber?.(next))
    await vi.waitFor(() => expect(sendPublication).toHaveBeenCalledTimes(5))

    expect(
      sendPublication.mock.calls.map(([sent]) => sent.publicationId)
    ).toEqual(publications.map(({ publicationId }) => publicationId))
    expect(sendPublications).not.toHaveBeenCalled()
    ;[...acknowledgements].reverse().forEach((acknowledge) => acknowledge())
    await instance.whenIdle()

    expect(outcomes).toEqual(
      publications.map(({ publicationId }) => ({
        direction: 'local',
        status: 'sent',
        publicationId
      }))
    )
  })

  it('preserves ordered single sends for a Provider without batch capability', async () => {
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
    const secondPublication: SharedPublication = {
      ...publication,
      publicationId: 'publication-b'
    }

    subscriber?.(publication)
    subscriber?.(secondPublication)
    await instance.whenIdle()

    expect(provider.sendPublication).toHaveBeenCalledTimes(2)
    expect(
      vi
        .mocked(provider.sendPublication)
        .mock.calls.map(([sent]) => sent.publicationId)
    ).toEqual(['publication-a', 'publication-b'])
  })

  it('applies a Provider batch through separate ordered app callbacks', async () => {
    let batchSubscriber:
      | ((publications: readonly InboundPublication[]) => void)
      | undefined
    const provider = Object.assign(createProvider(), {
      onPublications: vi.fn(
        (next: (publications: readonly InboundPublication[]) => void) => {
          batchSubscriber = next
          return () => undefined
        }
      )
    })
    const processRemotePublication = vi.fn()
    const instance = createCollaboration(
      input({ provider, processRemotePublication })
    )
    await instance.start()
    const secondPublication: SharedPublication = {
      ...publication,
      publicationId: 'publication-b'
    }

    batchSubscriber?.([
      { publication, fromActorId: 'actor-b' },
      { publication: secondPublication, fromActorId: 'actor-b' }
    ])
    await instance.whenIdle()

    expect(
      processRemotePublication.mock.calls.map(
        ([received]) => received.publicationId
      )
    ).toEqual(['publication-a', 'publication-b'])
    expect(provider.onPublication).not.toHaveBeenCalled()
  })

  it('treats onPublications as the complete inbound feed for a singleton', async () => {
    let batchSubscriber:
      | ((publications: readonly InboundPublication[]) => void)
      | undefined
    const provider = Object.assign(createProvider(), {
      onPublications: vi.fn(
        (next: (publications: readonly InboundPublication[]) => void) => {
          batchSubscriber = next
          return () => undefined
        }
      )
    })
    const processRemotePublication = vi.fn()
    const instance = createCollaboration(
      input({ provider, processRemotePublication })
    )
    await instance.start()

    batchSubscriber?.([{ publication, fromActorId: 'actor-b' }])
    await instance.whenIdle()

    expect(processRemotePublication).toHaveBeenCalledOnce()
    expect(processRemotePublication).toHaveBeenCalledWith(publication, {
      fromActorId: 'actor-b'
    })
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

  it('awaits an async app callback before reporting success or advancing FIFO', async () => {
    let subscriber: ((inbound: InboundPublication) => void) | undefined
    let releaseFirst: (() => void) | undefined
    const firstSettled = new Promise<void>((resolve) => {
      releaseFirst = resolve
    })
    const secondPublication: SharedPublication = {
      ...publication,
      publicationId: 'publication-b'
    }
    const timeline: string[] = []
    const provider = createProvider({
      onPublication: vi.fn((next) => {
        subscriber = next
        return () => undefined
      })
    })
    const processRemotePublication = vi.fn(
      async (nextPublication: SharedPublication) => {
        timeline.push(`start:${nextPublication.publicationId}`)
        if (nextPublication.publicationId === 'publication-a') {
          await firstSettled
        }
        timeline.push(`finish:${nextPublication.publicationId}`)
      }
    )
    const instance = createCollaboration(
      input({ provider, processRemotePublication })
    )
    const outcomes: unknown[] = []
    instance.observePublicationOutcomes((outcome) => outcomes.push(outcome))
    await instance.start()

    subscriber?.({ publication, fromActorId: 'actor-b' })
    subscriber?.({ publication: secondPublication, fromActorId: 'actor-b' })
    await Promise.resolve()
    await Promise.resolve()

    expect(timeline).toEqual(['start:publication-a'])
    expect(outcomes).toEqual([])

    releaseFirst?.()
    await instance.whenIdle()

    expect(timeline).toEqual([
      'start:publication-a',
      'finish:publication-a',
      'start:publication-b',
      'finish:publication-b'
    ])
    expect(outcomes).toEqual([
      {
        direction: 'remote',
        status: 'processed',
        publicationId: 'publication-a',
        fromActorId: 'actor-b'
      },
      {
        direction: 'remote',
        status: 'processed',
        publicationId: 'publication-b',
        fromActorId: 'actor-b'
      }
    ])
  })

  it('reports an asynchronously rejected app callback as failed', async () => {
    let subscriber: ((inbound: InboundPublication) => void) | undefined
    const failure = new Error('async app rejection')
    const provider = createProvider({
      onPublication: vi.fn((next) => {
        subscriber = next
        return () => undefined
      })
    })
    const processRemotePublication = vi.fn(async () => {
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
