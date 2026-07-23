import { describe, expect, it, vi } from 'vitest'
import {
  EventTypes,
  TransactionEventTypes,
  subscribeToUserActionCompleted
} from '@asyra/reactive-events'
import { SharedDataChannelNames } from '@asyra/utils'
import { Factory, LocalSharedDataChannel, type SharedPublication } from '..'

const update = (
  factory: Factory,
  id: string,
  after: number,
  options: {
    sharedDelivery?: 'transaction-end' | 'immediate'
  } = {}
) => {
  factory.updateTransaction({
    type: TransactionEventTypes.UPDATE_TRANSACTION,
    eventName: EventTypes.UPDATE_COMPUTED_DATA,
    payload: { id, before: after - 1, after },
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
  const publications: SharedPublication[] = []
  factory.subscribeToSharedPublication((publication) =>
    publications.push(publication)
  )
  return { factory, projected, publications }
}

describe('Factory action-level shared publication', () => {
  it('batches synchronous immediate deliveries before the outer undo transaction ends', async () => {
    const { factory, projected, publications } = createHarness()

    factory.startTransaction()
    update(factory, 'element-a', 1, { sharedDelivery: 'immediate' })
    update(factory, 'element-a', 2, { sharedDelivery: 'immediate' })
    update(factory, 'element-b', 3, { sharedDelivery: 'immediate' })

    expect(projected).toHaveLength(3)
    expect(publications).toEqual([])
    await Promise.resolve()

    expect(publications).toEqual([
      {
        publicationId: '1:publication:1',
        transactionId: 1,
        origin: 'action',
        deliveries: [
          expect.objectContaining({
            deliveryId: '1:0:forward',
            payload: expect.objectContaining({ id: 'element-a', after: 1 })
          }),
          expect.objectContaining({
            deliveryId: '1:1:forward',
            payload: expect.objectContaining({ id: 'element-a', after: 2 })
          }),
          expect.objectContaining({
            deliveryId: '1:2:forward',
            payload: expect.objectContaining({ id: 'element-b', after: 3 })
          })
        ]
      }
    ])

    factory.endTransaction()
    expect(publications).toHaveLength(1)
  })

  it('publishes transaction-end changes only after the outer transaction commits', async () => {
    const { factory, publications } = createHarness()

    factory.startTransaction()
    update(factory, 'element-a', 1)
    update(factory, 'element-b', 2)

    await Promise.resolve()
    expect(publications).toEqual([])

    factory.endTransaction()

    expect(publications).toHaveLength(1)
    expect(publications[0]?.deliveries).toHaveLength(2)
    expect(publications[0]?.publicationId).toBe('1:publication:1')
  })

  it('discards an immediate batch that rolls back before its publication flush', async () => {
    const { factory, projected, publications } = createHarness()

    factory.startTransaction()
    update(factory, 'element-a', 1, { sharedDelivery: 'immediate' })
    update(factory, 'element-a', 2, { sharedDelivery: 'immediate' })
    factory.endTransaction({ outcome: 'rollback' })
    await Promise.resolve()

    expect(projected).toHaveLength(4)
    expect(publications).toEqual([])
  })

  it('publishes one linked compensation batch when an immediate action rolls back after flush', async () => {
    const { factory, publications } = createHarness()

    factory.startTransaction()
    update(factory, 'element-a', 1, { sharedDelivery: 'immediate' })
    update(factory, 'element-b', 2, { sharedDelivery: 'immediate' })
    await Promise.resolve()

    expect(publications).toHaveLength(1)
    factory.endTransaction({ outcome: 'rollback' })

    expect(publications).toHaveLength(2)
    expect(publications[1]).toEqual({
      publicationId: '1:publication:2',
      transactionId: 1,
      origin: 'rollback-compensation',
      deliveries: [
        expect.objectContaining({
          kind: 'compensation',
          compensatesDeliveryId: '1:1:forward'
        }),
        expect.objectContaining({
          kind: 'compensation',
          compensatesDeliveryId: '1:0:forward'
        })
      ]
    })
  })

  it('publishes one inverse batch when one multi-change action is undone', () => {
    const { factory, publications } = createHarness()
    factory.registerTransactionReplayHandler(
      EventTypes.UPDATE_COMPUTED_DATA,
      () => true
    )

    factory.startTransaction()
    update(factory, 'element-a', 1)
    update(factory, 'element-b', 2)
    factory.endTransaction()
    publications.length = 0

    factory.undo()

    expect(publications).toHaveLength(1)
    expect(publications[0]).toEqual(
      expect.objectContaining({
        origin: 'undo',
        deliveries: [
          expect.objectContaining({
            payload: expect.objectContaining({ id: 'element-b' })
          }),
          expect.objectContaining({
            payload: expect.objectContaining({ id: 'element-a' })
          })
        ]
      })
    )
  })

  it('keeps several immediate publications in one outer undo commit', async () => {
    const { factory, publications } = createHarness()
    factory.registerTransactionReplayHandler(
      EventTypes.UPDATE_COMPUTED_DATA,
      () => true
    )

    factory.startTransaction()
    update(factory, 'element-a', 1, { sharedDelivery: 'immediate' })
    await Promise.resolve()
    update(factory, 'element-a', 2, { sharedDelivery: 'immediate' })
    await Promise.resolve()
    factory.endTransaction()

    expect(publications).toHaveLength(2)
    publications.length = 0

    factory.undo()

    expect(publications).toHaveLength(1)
    expect(publications[0]).toEqual(
      expect.objectContaining({
        origin: 'undo',
        deliveries: [
          expect.objectContaining({
            payload: expect.objectContaining({ id: 'element-a', after: 1 })
          }),
          expect.objectContaining({
            payload: expect.objectContaining({ id: 'element-a', after: 0 })
          })
        ]
      })
    )
  })

  it('isolates publication subscribers from commit and from each other', () => {
    const factory = new Factory()
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      new LocalSharedDataChannel()
    )
    const later = vi.fn()
    factory.subscribeToSharedPublication(() => {
      throw new Error('observer failed')
    })
    factory.subscribeToSharedPublication(later)

    factory.startTransaction()
    update(factory, 'element-a', 1)

    expect(() => factory.endTransaction()).not.toThrow()
    expect(later).toHaveBeenCalledTimes(1)
  })

  it('retains the outer publication when a completion observer commits reentrantly', () => {
    const factory = new Factory({ bridgeToReactiveEvents: true })
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      new LocalSharedDataChannel()
    )
    const publications: SharedPublication[] = []
    const committedStatuses: {
      transactionId: number
      changeCount: number
    }[] = []
    factory.subscribeToSharedPublication((publication) =>
      publications.push(publication)
    )
    factory.subscribeToTransactionStatus((status) => {
      if (status.status === 'committed') {
        committedStatuses.push({
          transactionId: status.transactionId,
          changeCount: status.changeCount
        })
      }
    })
    let nested = false
    const completionSubscription = subscribeToUserActionCompleted(() => {
      if (nested) return
      nested = true
      factory.startTransaction()
      update(factory, 'element-nested', 2)
      factory.endTransaction()
    })

    try {
      factory.startTransaction()
      update(factory, 'element-outer', 1)
      factory.endTransaction()
    } finally {
      completionSubscription.unsubscribe()
    }

    expect(publications).toHaveLength(2)
    expect(
      publications.flatMap(({ deliveries }) =>
        deliveries.map(({ payload }) => payload)
      )
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'element-outer', after: 1 }),
        expect.objectContaining({ id: 'element-nested', after: 2 })
      ])
    )
    expect(publications.map(({ transactionId }) => transactionId)).toEqual([
      1, 2
    ])
    expect(committedStatuses).toEqual([
      { transactionId: 1, changeCount: 1 },
      { transactionId: 2, changeCount: 1 }
    ])
  })
})
