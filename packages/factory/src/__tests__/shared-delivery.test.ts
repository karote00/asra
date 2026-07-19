import { describe, expect, it, vi } from 'vitest'
import { EventTypes, TransactionEventTypes } from '@asyra/reactive-events'
import { SharedDataChannelNames } from '@asyra/utils'
import { Factory, LocalSharedDataChannel, type SharedDelivery } from '..'

const update = (
  factory: Factory,
  options: {
    sharedDelivery?: 'transaction-end' | 'immediate'
  } = {}
) => {
  factory.updateTransaction({
    type: TransactionEventTypes.UPDATE_TRANSACTION,
    eventName: EventTypes.UPDATE_COMPUTED_DATA,
    payload: { id: 'shared-delivery', before: 0, after: 1 },
    options: {
      shared: SharedDataChannelNames.SCENE_TREE,
      ...options
    }
  })
}

const createHarness = () => {
  const factory = new Factory()
  const channel = new LocalSharedDataChannel()
  factory.registerSharedDataChannel(SharedDataChannelNames.SCENE_TREE, channel)
  const projected: unknown[] = []
  factory.observeSharedDataChannel(
    SharedDataChannelNames.SCENE_TREE,
    (change) => projected.push(change)
  )
  const deliveries: SharedDelivery[] = []
  factory.subscribeToSharedDelivery((delivery) => deliveries.push(delivery))
  return { factory, deliveries, projected }
}

describe('Factory local shared delivery contract', () => {
  it('uses a Factory-owned local channel without constructing a Y.Doc', () => {
    const { factory, projected } = createHarness()

    factory.startTransaction()
    update(factory)
    factory.endTransaction()

    expect(projected).toEqual([
      expect.objectContaining({ id: 'shared-delivery', before: 0, after: 1 })
    ])
  })

  it('publishes detached transaction-end delivery metadata after local projection', () => {
    const { factory, deliveries, projected } = createHarness()

    factory.startTransaction()
    update(factory)
    expect(projected).toEqual([])
    expect(deliveries).toEqual([])
    factory.endTransaction()

    expect(projected).toHaveLength(1)
    expect(deliveries).toEqual([
      {
        deliveryId: '1:0:forward',
        transactionId: 1,
        origin: 'action',
        kind: 'forward',
        channel: SharedDataChannelNames.SCENE_TREE,
        eventName: EventTypes.UPDATE_COMPUTED_DATA,
        payload: expect.objectContaining({
          id: 'shared-delivery',
          before: 0,
          after: 1
        }),
        sharedDelivery: 'transaction-end'
      }
    ])
  })

  it('discards a transaction-end delivery when rollback happens before flush', () => {
    const { factory, deliveries, projected } = createHarness()

    factory.startTransaction()
    update(factory)
    factory.endTransaction({ outcome: 'rollback' })

    expect(projected).toEqual([])
    expect(deliveries).toEqual([])
  })

  it('publishes one linked compensation for an immediate delivery', () => {
    const { factory, deliveries, projected } = createHarness()

    factory.startTransaction()
    update(factory, { sharedDelivery: 'immediate' })
    expect(deliveries).toHaveLength(1)
    factory.endTransaction({ outcome: 'rollback' })

    expect(projected).toEqual([
      expect.objectContaining({ before: 0, after: 1 }),
      expect.objectContaining({ before: 1, after: 0 })
    ])
    expect(deliveries).toEqual([
      expect.objectContaining({
        deliveryId: '1:0:forward',
        origin: 'action',
        kind: 'forward',
        sharedDelivery: 'immediate'
      }),
      expect.objectContaining({
        deliveryId: '1:0:compensation:0',
        origin: 'rollback-compensation',
        kind: 'compensation',
        compensatesDeliveryId: '1:0:forward',
        payload: expect.objectContaining({ before: 1, after: 0 }),
        sharedDelivery: 'immediate'
      })
    ])
  })

  it('publishes committed undo and redo replay as inverse and forward deliveries', () => {
    const { factory, deliveries, projected } = createHarness()
    factory.registerTransactionReplayHandler(
      EventTypes.UPDATE_COMPUTED_DATA,
      () => true
    )
    factory.startTransaction()
    update(factory)
    factory.endTransaction()
    deliveries.length = 0
    projected.length = 0

    factory.undo()

    expect(projected).toEqual([
      expect.objectContaining({ before: 1, after: 0 })
    ])
    expect(deliveries).toEqual([
      expect.objectContaining({
        origin: 'undo',
        kind: 'forward',
        payload: expect.objectContaining({ before: 1, after: 0 }),
        sharedDelivery: 'transaction-end'
      })
    ])

    deliveries.length = 0
    projected.length = 0
    factory.redo()

    expect(projected).toEqual([
      expect.objectContaining({ before: 0, after: 1 })
    ])
    expect(deliveries).toEqual([
      expect.objectContaining({
        origin: 'redo',
        kind: 'forward',
        payload: expect.objectContaining({ before: 0, after: 1 }),
        sharedDelivery: 'transaction-end'
      })
    ])
  })

  it('isolates delivery subscriber failure from other subscribers and commit', () => {
    const factory = new Factory()
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      new LocalSharedDataChannel()
    )
    const later = vi.fn()
    factory.subscribeToSharedDelivery(() => {
      throw new Error('observer failed')
    })
    factory.subscribeToSharedDelivery(later)

    factory.startTransaction()
    update(factory)
    expect(() => factory.endTransaction()).not.toThrow()

    expect(later).toHaveBeenCalledTimes(1)
  })

  it('isolates local projection mutation from later observers and collaboration delivery', () => {
    const factory = new Factory()
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      new LocalSharedDataChannel()
    )
    const laterProjection = vi.fn()
    const delivery = vi.fn()
    factory.observeSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      (change) => {
        ;(change as { after: number }).after = 99
      }
    )
    factory.observeSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      laterProjection
    )
    factory.subscribeToSharedDelivery(delivery)

    factory.startTransaction()
    update(factory)
    factory.endTransaction()

    expect(laterProjection).toHaveBeenCalledWith(
      expect.objectContaining({ after: 1 })
    )
    expect(delivery).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ after: 1 })
      })
    )
  })
})
