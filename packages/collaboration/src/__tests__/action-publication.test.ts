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

const deliveriesOf = (publication: SharedPublication) =>
  publication.slices.flatMap((slice) =>
    slice.batches.flatMap((batch) => batch.deliveries)
  )

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
  factory.registerTransactionReplayHandler(SET_VALUE, () => true)
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
  const update = (
    id: string,
    after: number,
    options: {
      rollbackable?: boolean
      undoable?: boolean
    } = {}
  ) => {
    factory.updateTransaction({
      type: 'updateTransaction' as Parameters<
        Factory['updateTransaction']
      >[0]['type'],
      eventName: SET_VALUE,
      payload: { id, before: after - 1, after },
      options: {
        undoable: options.undoable ?? false,
        rollbackable: options.rollbackable ?? false,
        shared: CHANNEL,
        sharedDelivery: 'immediate'
      }
    })
  }
  return { factory, instance, provider, sendPublication, update }
}

const publication = (): SharedPublication =>
  createSharedPublicationFixture({
    mode: 'progressive',
    publicationId: 'publication-a',
    transactionId: 1,
    delivery: {
      deliveryId: 'delivery-a',
      channel: CHANNEL,
      eventName: SET_VALUE,
      orderedIds: ['element-a'],
      payload: { id: 'element-a', before: 0, after: 1 }
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
    const sent = sendPublication.mock.calls[0]?.[0]
    expect(sent?.mode).toBe('progressive')
    expect(deliveriesOf(sent as SharedPublication)).toEqual([
      expect.objectContaining({
        payload: expect.objectContaining({ id: 'element-a', after: 1 })
      }),
      expect.objectContaining({
        payload: expect.objectContaining({ id: 'element-b', after: 2 })
      })
    ])
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
    update('element-a', 1, { rollbackable: true })
    await instance.whenIdle()
    factory.endTransaction({ outcome: 'rollback' })
    await instance.whenIdle()

    expect(sendPublication).toHaveBeenCalledTimes(2)
    const forward = sendPublication.mock.calls[0]?.[0]
    const compensation = sendPublication.mock.calls[1]?.[0]
    expect(compensation).toMatchObject({
      origin: 'rollback-compensation',
      compensatesPublicationId: forward?.publicationId
    })
    expect(deliveriesOf(compensation as SharedPublication)).toEqual([
      expect.objectContaining({
        compensatesDeliveryId: deliveriesOf(forward as SharedPublication)[0]
          ?.deliveryId,
        payload: expect.objectContaining({
          id: 'element-a',
          before: 1,
          after: 0
        })
      })
    ])

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
    const sendPublication = vi.spyOn(provider, 'sendPublication')
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

    expect(sendPublication).toHaveBeenCalledTimes(2)
    expect(
      sendPublication.mock.calls.map(([sent]) => sent.publicationId)
    ).toEqual(['publication-a', 'publication-a'])

    await instance.dispose()
  })

  it('hands action, Undo, and Redo to the Provider as three separate publications', async () => {
    const { factory, instance, sendPublication, update } =
      createFactoryHarness()
    await instance.start()

    factory.startTransaction()
    update('element-a', 1, { undoable: true })
    factory.endTransaction()
    await instance.whenIdle()

    factory.undo()
    await instance.whenIdle()

    factory.redo()
    await instance.whenIdle()

    expect(sendPublication.mock.calls.map(([sent]) => sent.origin)).toEqual([
      'action',
      'undo',
      'redo'
    ])
    expect(sendPublication).toHaveBeenCalledTimes(3)

    await instance.dispose()
  })
})
