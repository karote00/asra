import {
  Factory,
  LocalSharedDataChannel,
  type SharedPublication,
  type SharedPublicationSubscriber
} from '@asyra/factory'
import { describe, expect, it, vi } from 'vitest'
import { createCollaboration, MemoryHub, MemoryProvider } from '..'
import { createSharedPublicationFixture } from './shared-publication-fixture'

const CHANNEL = 'document'
const SET_VALUE = 'set-value'

interface SetValuePayload {
  id: string
  before: number
  after: number
}

const createFactoryHarness = () => {
  const factory = new Factory()
  factory.registerSharedDataChannel(CHANNEL, new LocalSharedDataChannel())
  factory.registerTransactionInverter(SET_VALUE, (event) => {
    const payload = (event as unknown as { payload: SetValuePayload }).payload
    return {
      ...event,
      payload: {
        ...payload,
        before: payload.after,
        after: payload.before
      }
    } as typeof event
  })
  const provider = new MemoryProvider(new MemoryHub(), {
    documentId: 'document-a',
    roomId: 'room-a',
    actorId: 'actor-a'
  })
  const sendPublication = vi.spyOn(provider, 'sendPublication')
  const processRemotePublication = vi.fn()
  const instance = createCollaboration({
    documentId: 'document-a',
    roomId: 'room-a',
    actorId: 'actor-a',
    factory,
    provider,
    processRemotePublication,
    resourceOwnership: { provider: 'owned' }
  })
  const update = (id: string, after: number, rollbackable = false) => {
    factory.updateTransaction({
      type: 'updateTransaction' as Parameters<
        Factory['updateTransaction']
      >[0]['type'],
      eventName: SET_VALUE,
      payload: { id, before: after - 1, after },
      options: {
        undoable: false,
        rollbackable,
        shared: CHANNEL,
        sharedDelivery: 'immediate'
      }
    })
  }
  return { factory, instance, provider, sendPublication, update }
}

const publication = (): SharedPublication =>
  createSharedPublicationFixture({
    publicationId: 'publication-a',
    transactionId: 1,
    delivery: {
      deliveryId: 'delivery-a',
      channel: CHANNEL,
      eventName: SET_VALUE,
      payload: { id: 'element-a', before: 0, after: 1 },
      sharedDelivery: 'immediate'
    }
  })

describe('Collaboration publication handoff', () => {
  it('sends one intact ordered publication for one immediate Factory action', async () => {
    const { factory, instance, sendPublication, update } =
      createFactoryHarness()
    await instance.start()

    factory.startTransaction()
    update('element-a', 1)
    update('element-b', 2)
    await instance.whenIdle()

    expect(sendPublication).toHaveBeenCalledTimes(1)
    expect(sendPublication.mock.calls[0]?.[0]).toMatchObject({
      deliveries: [
        expect.objectContaining({
          payload: expect.objectContaining({ id: 'element-a', after: 1 })
        }),
        expect.objectContaining({
          payload: expect.objectContaining({ id: 'element-b', after: 2 })
        })
      ]
    })
    expect('yDoc' in instance).toBe(false)

    factory.endTransaction()
    await instance.whenIdle()
    expect(sendPublication).toHaveBeenCalledTimes(1)

    await instance.dispose()
  })

  it('forwards Factory compensation as an ordinary second publication', async () => {
    const { factory, instance, sendPublication, update } =
      createFactoryHarness()
    await instance.start()

    factory.startTransaction()
    update('element-a', 1, true)
    await instance.whenIdle()
    factory.endTransaction({ outcome: 'rollback' })
    await instance.whenIdle()

    expect(sendPublication).toHaveBeenCalledTimes(2)
    expect(sendPublication.mock.calls[1]?.[0]).toMatchObject({
      origin: 'rollback-compensation',
      deliveries: [
        expect.objectContaining({
          kind: 'compensation',
          origin: 'rollback-compensation',
          payload: expect.objectContaining({
            id: 'element-a',
            before: 1,
            after: 0
          })
        })
      ]
    })

    await instance.dispose()
  })

  it('does not deduplicate repeated equal publications', async () => {
    let subscriber: SharedPublicationSubscriber | undefined
    const source = {
      subscribeToSharedPublication: vi.fn(
        (next: SharedPublicationSubscriber) => {
          subscriber = next
          return () => undefined
        }
      )
    }
    const provider = new MemoryProvider(new MemoryHub(), {
      documentId: 'document-a',
      roomId: 'room-a',
      actorId: 'actor-a'
    })
    const sendPublications = vi.spyOn(provider, 'sendPublications')
    const instance = createCollaboration({
      documentId: 'document-a',
      roomId: 'room-a',
      actorId: 'actor-a',
      factory: source,
      provider,
      processRemotePublication: vi.fn()
    })
    await instance.start()
    const repeated = publication()

    subscriber?.(repeated)
    subscriber?.(repeated)
    await instance.whenIdle()

    expect(sendPublications).toHaveBeenCalledOnce()
    expect(sendPublications).toHaveBeenCalledWith([repeated, repeated])

    await instance.dispose()
  })

  it('does not hand off a later publication batch before the current send settles', async () => {
    let subscriber: SharedPublicationSubscriber | undefined
    let acknowledgeFirst: (() => void) | undefined
    const firstAcknowledgement = new Promise<void>((resolve) => {
      acknowledgeFirst = resolve
    })
    const hub = new MemoryHub({
      acknowledgePublication: (received) =>
        received.publicationId === 'publication-1'
          ? firstAcknowledgement.then(() => true)
          : true
    })
    const provider = new MemoryProvider(hub, {
      documentId: 'document-a',
      roomId: 'room-a',
      actorId: 'actor-a'
    })
    const sendPublication = vi.spyOn(provider, 'sendPublication')
    const sendPublications = vi.spyOn(provider, 'sendPublications')
    const instance = createCollaboration({
      documentId: 'document-a',
      roomId: 'room-a',
      actorId: 'actor-a',
      factory: {
        subscribeToSharedPublication: (next) => {
          subscriber = next
          return () => undefined
        }
      },
      provider,
      processRemotePublication: vi.fn()
    })
    await instance.start()

    subscriber?.({ ...publication(), publicationId: 'publication-1' })
    await vi.waitFor(() => expect(sendPublication).toHaveBeenCalledOnce())
    subscriber?.({ ...publication(), publicationId: 'publication-2' })
    subscriber?.({ ...publication(), publicationId: 'publication-3' })
    await Promise.resolve()

    expect(sendPublications).not.toHaveBeenCalled()

    acknowledgeFirst?.()
    await instance.whenIdle()

    expect(
      sendPublication.mock.calls.map(([sent]) => sent.publicationId)
    ).toEqual(['publication-1'])
    expect(
      sendPublications.mock.calls.map(([sent]) =>
        sent.map(({ publicationId }) => publicationId)
      )
    ).toEqual([['publication-2', 'publication-3']])

    await instance.dispose()
  })
})
