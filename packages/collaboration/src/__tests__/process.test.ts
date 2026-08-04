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
  type Provider
} from '..'
import { createSharedPublicationFixture } from './shared-publication-fixture.js'

const publication: SharedPublication = createSharedPublicationFixture({
  mode: 'progressive',
  publicationId: 'publication-a',
  transactionId: 1,
  delivery: {
    deliveryId: 'delivery-a',
    channel: 'document',
    eventName: 'set-value',
    orderedIds: ['document'],
    payload: { value: 1 }
  }
})

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
  getStatus: vi.fn((): ReturnType<Provider['getStatus']> => 'connected'),
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

  it('sends every Factory publication exactly once and preserves outbound FIFO until each send settles', async () => {
    let subscriber: SharedPublicationSubscriber | undefined
    let settleFirst: (() => void) | undefined
    const firstSend = new Promise<void>((resolve) => {
      settleFirst = resolve
    })
    const sendPublication = vi.fn<Provider['sendPublication']>(
      (nextPublication) =>
        nextPublication.publicationId === 'publication-a'
          ? firstSend
          : Promise.resolve()
    )
    const provider = createProvider({ sendPublication })
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
      mode: 'progressive',
      publicationId: 'publication-b',
      transactionId: 2,
      delivery: {
        deliveryId: 'delivery-b',
        channel: 'document',
        eventName: 'set-value',
        orderedIds: ['document'],
        payload: { value: 2 }
      }
    })

    subscriber?.(publication)
    subscriber?.(secondPublication)
    await vi.waitFor(() => expect(sendPublication).toHaveBeenCalledOnce())

    expect(sendPublication.mock.calls[0]?.[0].publicationId).toBe(
      'publication-a'
    )
    expect(sendPublication.mock.calls[0]?.[0]).toBe(publication)
    await Promise.resolve()
    expect(sendPublication).toHaveBeenCalledTimes(1)
    expect(outcomes).toEqual([])

    settleFirst?.()
    await instance.whenIdle()

    expect(
      sendPublication.mock.calls.map(([sent]) => sent.publicationId)
    ).toEqual(['publication-a', 'publication-b'])
    expect(sendPublication.mock.calls[1]?.[0]).toBe(secondPublication)
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

  it('skips disconnected Factory publications without sending or replaying them after reconnect', async () => {
    let subscriber: SharedPublicationSubscriber | undefined
    let status: ReturnType<Provider['getStatus']> = 'connected'
    const provider = createProvider({
      getStatus: vi.fn(() => status),
      disconnect: vi.fn(async () => {
        status = 'disconnected'
      }),
      reconnect: vi.fn(async () => {
        status = 'connected'
      })
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
    await instance.disconnect()

    subscriber?.(publication)
    await instance.whenIdle()

    expect(provider.sendPublication).not.toHaveBeenCalled()
    expect(outcomes).toEqual([
      {
        direction: 'local',
        status: 'skipped',
        publicationId: 'publication-a'
      }
    ])

    await instance.reconnect()
    await instance.whenIdle()

    expect(provider.sendPublication).not.toHaveBeenCalled()
  })

  it('does not replay an accepted FIFO entry whose connection ended before Provider handoff', async () => {
    let subscriber: SharedPublicationSubscriber | undefined
    let settleFirst: (() => void) | undefined
    const firstSend = new Promise<void>((resolve) => {
      settleFirst = resolve
    })
    const sendPublication = vi.fn<Provider['sendPublication']>(
      (nextPublication) =>
        nextPublication.publicationId === 'publication-a'
          ? firstSend
          : Promise.resolve()
    )
    const provider = createProvider({ sendPublication })
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
    const secondPublication: SharedPublication = {
      ...publication,
      publicationId: 'publication-b'
    }

    subscriber?.(publication)
    subscriber?.(secondPublication)
    await vi.waitFor(() => expect(sendPublication).toHaveBeenCalledOnce())

    await instance.disconnect()
    await instance.reconnect()
    settleFirst?.()
    await instance.whenIdle()

    expect(
      sendPublication.mock.calls.map(([sent]) => sent.publicationId)
    ).toEqual(['publication-a'])
    expect(outcomes).toEqual([
      {
        direction: 'local',
        status: 'sent',
        publicationId: 'publication-a'
      },
      {
        direction: 'local',
        status: 'skipped',
        publicationId: 'publication-b'
      }
    ])
  })

  it('binds one async onPublication callback that remains pending until app apply completes', async () => {
    let subscriber:
      | ((publication: SharedPublication) => Promise<void>)
      | undefined
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
        subscriber = next as unknown as (
          publication: SharedPublication
        ) => Promise<void>
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

    expect(provider.onPublication).toHaveBeenCalledOnce()
    const firstCompletion = subscriber?.(publication)
    let firstCallbackSettled = false
    void Promise.resolve(firstCompletion).then(() => {
      firstCallbackSettled = true
    })
    await Promise.resolve()
    await Promise.resolve()

    expect(firstCompletion).toBeInstanceOf(Promise)
    expect(timeline).toEqual(['start:publication-a'])
    expect(processRemotePublication.mock.calls[0]?.[0]).toBe(publication)
    expect(outcomes).toEqual([])
    expect(firstCallbackSettled).toBe(false)

    releaseFirst?.()
    await firstCompletion

    const secondCompletion = subscriber?.(secondPublication)
    expect(secondCompletion).toBeInstanceOf(Promise)
    await secondCompletion

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
        publicationId: 'publication-a'
      },
      {
        direction: 'remote',
        status: 'processed',
        publicationId: 'publication-b'
      }
    ])
  })

  it('rejects a failed async onPublication callback without retrying app apply', async () => {
    let subscriber:
      | ((publication: SharedPublication) => Promise<void>)
      | undefined
    const failure = new Error('async app rejection')
    const provider = createProvider({
      onPublication: vi.fn((next) => {
        subscriber = next as unknown as (
          publication: SharedPublication
        ) => Promise<void>
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

    const completion = subscriber?.(publication)
    expect(completion).toBeInstanceOf(Promise)
    await expect(completion).rejects.toBe(failure)
    await instance.whenIdle()

    expect(processRemotePublication).toHaveBeenCalledOnce()
    expect(outcomes).toEqual([
      {
        direction: 'remote',
        status: 'process-failed',
        publicationId: 'publication-a',
        error: failure
      }
    ])
  })

  it('reports one active Provider rejection without retrying or fabricating a sent outcome', async () => {
    let subscriber: SharedPublicationSubscriber | undefined
    const failure = new Error('transport permanently rejected publication')
    const sendPublication = vi.fn<Provider['sendPublication']>(() =>
      Promise.reject(failure)
    )
    const provider = createProvider({ sendPublication })
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

    subscriber?.(publication)
    await instance.whenIdle()

    expect(sendPublication).toHaveBeenCalledOnce()
    expect(sendPublication).toHaveBeenCalledWith(publication)
    expect(outcomes).toEqual([
      {
        direction: 'local',
        status: 'send-failed',
        publicationId: 'publication-a',
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
