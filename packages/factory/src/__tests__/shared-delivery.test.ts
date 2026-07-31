import { describe, expect, it, vi } from 'vitest'
import { EventTypes, TransactionEventTypes } from '@asyra/reactive-events'
import { SharedDataChannelNames } from '@asyra/utils'
import {
  Factory,
  LocalSharedDataChannel,
  type SharedDataChannel,
  type SharedDeliveryBatch
} from '..'

const update = (
  factory: Factory,
  options: {
    sharedDelivery?: 'transaction-end' | 'immediate'
  } = {}
) => {
  factory.updateTransaction({
    type: TransactionEventTypes.UPDATE_TRANSACTION,
    eventName: EventTypes.UPDATE_PROPERTY,
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
  const deliveryBatches: SharedDeliveryBatch[] = []
  factory.subscribeToSharedDeliveryBatch((batch) => deliveryBatches.push(batch))
  return { factory, deliveryBatches, projected }
}

describe('Factory local shared delivery contract', () => {
  it('delegates single append and observe through one immutable batch-of-one path', () => {
    const channel = new LocalSharedDataChannel()
    const appendBatch = vi.spyOn(channel, 'appendBatch')
    const observeBatch = vi.spyOn(channel, 'observeBatch')
    const laterBatches: (readonly unknown[])[] = []
    const singleChanges: unknown[] = []
    channel.observeBatch((batch) => {
      ;(
        batch[0] as {
          nested: { value: number }
        }
      ).nested.value = 99
    })
    channel.observeBatch((batch) => laterBatches.push(batch))
    channel.observe((change) => singleChanges.push(change))

    const source = { id: 'batch-of-one', nested: { value: 1 } }
    channel.append(source)
    source.nested.value = 2

    expect(appendBatch).toHaveBeenCalledTimes(1)
    expect(observeBatch).toHaveBeenCalledTimes(3)
    expect(laterBatches).toHaveLength(1)
    expect(laterBatches[0]).toHaveLength(1)
    expect(singleChanges).toHaveLength(1)
    expect(singleChanges[0]).toBe(laterBatches[0]?.[0])
    expect(laterBatches[0]?.[0]).toEqual({
      id: 'batch-of-one',
      nested: { value: 1 }
    })
    expect(Object.isFrozen(laterBatches[0])).toBe(true)
    expect(Object.isFrozen(laterBatches[0]?.[0])).toBe(true)
    expect(
      Object.isFrozen(
        (laterBatches[0]?.[0] as { nested: { value: number } }).nested
      )
    ).toBe(true)
  })

  it('delivers one ordered built-in batch to an observer snapshot', () => {
    const channel = new LocalSharedDataChannel()
    const firstBatches: (readonly unknown[])[] = []
    const secondObserver = vi.fn()
    const lateObserver = vi.fn()
    let disposeSecond: () => void = () => undefined
    channel.observeBatch((batch) => {
      firstBatches.push(batch)
      disposeSecond()
      channel.observeBatch(lateObserver)
    })
    disposeSecond = channel.observeBatch(secondObserver)
    const source: [
      { id: string; nested: { value: number } },
      { id: string; nested: { value: number } }
    ] = [
      { id: 'first', nested: { value: 1 } },
      { id: 'second', nested: { value: 2 } }
    ]

    channel.appendBatch(source)
    source[0].nested.value = 99

    expect(secondObserver).toHaveBeenCalledTimes(1)
    expect(lateObserver).not.toHaveBeenCalled()
    expect(secondObserver.mock.calls[0]?.[0]).toBe(firstBatches[0])
    expect(firstBatches[0]).toEqual([
      { id: 'first', nested: { value: 1 } },
      { id: 'second', nested: { value: 2 } }
    ])
    expect(Object.isFrozen(firstBatches[0])).toBe(true)
    expect(Object.isFrozen(firstBatches[0]?.[0])).toBe(true)
    expect(
      Object.isFrozen(
        (firstBatches[0]?.[0] as { nested: { value: number } }).nested
      )
    ).toBe(true)

    channel.appendBatch([{ id: 'next' }])

    expect(secondObserver).toHaveBeenCalledTimes(1)
    expect(lateObserver).toHaveBeenCalledTimes(1)
  })

  it.each([
    [
      'appendBatch',
      {
        observeBatch: () => () => undefined
      }
    ],
    [
      'observeBatch',
      {
        appendBatch: () => undefined
      }
    ]
  ])(
    'rejects registration when a custom channel omits required %s',
    (missingMethod, incompleteChannel) => {
      const factory = new Factory()

      expect(() =>
        factory.registerSharedDataChannel(
          SharedDataChannelNames.SCENE_TREE,
          incompleteChannel as unknown as SharedDataChannel
        )
      ).toThrow(new RegExp(missingMethod))
      expect(
        factory.hasSharedDataChannel(SharedDataChannelNames.SCENE_TREE)
      ).toBe(false)
    }
  )

  it('uses one exact custom batch shape without legacy flags or capability probes', () => {
    const sourceHandlers = new Set<(changes: readonly unknown[]) => void>()
    const appendBatch = vi.fn((changes: readonly unknown[]) => {
      ;[...sourceHandlers].forEach((handler) => handler(changes))
    })
    const target = {
      appendBatch,
      observeBatch: (handler: (changes: readonly unknown[]) => void) => {
        sourceHandlers.add(handler)
        return () => sourceHandlers.delete(handler)
      }
    }
    const channel = new Proxy(target, {
      get: (batchChannel, property, receiver) => {
        if (
          property === 'append' ||
          property === 'observe' ||
          property === 'batchAppendIsAtomic'
        ) {
          throw new Error(`legacy capability probe: ${String(property)}`)
        }
        return Reflect.get(batchChannel, property, receiver)
      },
      getPrototypeOf: () => {
        throw new Error('prototype inspection is forbidden')
      }
    }) as SharedDataChannel
    const factory = new Factory()
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      channel
    )
    const firstBatches: (readonly unknown[])[] = []
    const laterBatches: (readonly unknown[])[] = []
    factory.observeSharedDataChannelBatch(
      SharedDataChannelNames.SCENE_TREE,
      (batch) => {
        firstBatches.push(batch)
        ;(
          batch[0] as {
            after: { value: number }
          }
        ).after.value = 99
      }
    )
    factory.observeSharedDataChannelBatch(
      SharedDataChannelNames.SCENE_TREE,
      (batch) => laterBatches.push(batch)
    )

    factory.startTransaction()
    factory.updateTransaction({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: EventTypes.UPDATE_PROPERTY,
      payload: {
        id: 'custom-native-batch-a',
        before: { value: 0 },
        after: { value: 1 }
      },
      options: { shared: SharedDataChannelNames.SCENE_TREE }
    })
    factory.updateTransaction({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: EventTypes.UPDATE_PROPERTY,
      payload: {
        id: 'custom-native-batch-b',
        before: { value: 1 },
        after: { value: 2 }
      },
      options: { shared: SharedDataChannelNames.SCENE_TREE }
    })
    factory.endTransaction()

    expect(appendBatch).toHaveBeenCalledTimes(1)
    expect(appendBatch.mock.calls[0]?.[0]).toHaveLength(2)
    expect(firstBatches).toHaveLength(1)
    expect(laterBatches).toHaveLength(1)
    expect(firstBatches[0]).toBe(laterBatches[0])
    expect(
      laterBatches[0]?.map((change) => (change as { id: string }).id)
    ).toEqual(['custom-native-batch-a', 'custom-native-batch-b'])
    expect(laterBatches[0]?.[0]).toEqual(
      expect.objectContaining({
        before: { value: 0 },
        after: { value: 1 }
      })
    )
    expect(Object.isFrozen(laterBatches[0])).toBe(true)
    expect(Object.isFrozen(laterBatches[0]?.[0])).toBe(true)
  })

  it('fans a custom native batch observer out once with one frozen identity', () => {
    const sourceHandlers = new Set<(changes: readonly unknown[]) => void>()
    const channel = {
      appendBatch: (changes: readonly unknown[]) => {
        ;[...sourceHandlers].forEach((handler) => handler(changes))
      },
      observeBatch: (handler: (changes: readonly unknown[]) => void) => {
        sourceHandlers.add(handler)
        return () => sourceHandlers.delete(handler)
      }
    } as SharedDataChannel
    const factory = new Factory()
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      channel
    )
    const firstBatches: (readonly unknown[])[] = []
    const laterBatches: (readonly unknown[])[] = []
    factory.observeSharedDataChannelBatch(
      SharedDataChannelNames.SCENE_TREE,
      (batch) => {
        firstBatches.push(batch)
        ;(
          batch[0] as {
            after: { value: number }
          }
        ).after.value = 99
      }
    )
    factory.observeSharedDataChannelBatch(
      SharedDataChannelNames.SCENE_TREE,
      (batch) => laterBatches.push(batch)
    )

    expect(sourceHandlers.size).toBe(1)
    factory.startTransaction()
    factory.updateTransaction({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: EventTypes.UPDATE_PROPERTY,
      payload: {
        id: 'custom-native-batch-fanout',
        before: { value: 0 },
        after: { value: 1 }
      },
      options: { shared: SharedDataChannelNames.SCENE_TREE }
    })
    factory.endTransaction()

    expect(firstBatches).toHaveLength(1)
    expect(laterBatches).toHaveLength(1)
    expect(firstBatches[0]).toBe(laterBatches[0])
    expect(laterBatches[0]?.[0]).toEqual(
      expect.objectContaining({
        before: { value: 0 },
        after: { value: 1 }
      })
    )
    expect(Object.isFrozen(laterBatches[0])).toBe(true)
    expect(Object.isFrozen(laterBatches[0]?.[0])).toBe(true)
  })

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
    const { factory, deliveryBatches, projected } = createHarness()

    factory.startTransaction()
    update(factory)
    expect(projected).toEqual([])
    expect(deliveryBatches).toEqual([])
    factory.endTransaction()

    expect(projected).toHaveLength(1)
    expect(deliveryBatches).toHaveLength(1)
    expect(deliveryBatches.flatMap((batch) => batch.deliveries)).toEqual([
      expect.objectContaining({
        deliveryId: '1:0:forward',
        artifactId: '1:artifact',
        batchId: '1:artifact:batch:1',
        transactionId: 1,
        origin: 'action',
        kind: 'forward',
        channel: SharedDataChannelNames.SCENE_TREE,
        eventName: EventTypes.UPDATE_PROPERTY,
        payload: expect.objectContaining({
          id: 'shared-delivery',
          before: 0,
          after: 1
        }),
        recordId: '1:0:record:0',
        record: expect.objectContaining({
          recordId: '1:0:record:0',
          occurrence: 0,
          orderedIds: [],
          payload: expect.objectContaining({
            id: 'shared-delivery',
            before: 0,
            after: 1
          })
        }),
        sharedDelivery: 'transaction-end'
      })
    ])
  })

  it('discards a transaction-end delivery when rollback happens before flush', () => {
    const { factory, deliveryBatches, projected } = createHarness()

    factory.startTransaction()
    update(factory)
    factory.endTransaction({ outcome: 'rollback' })

    expect(projected).toEqual([])
    expect(deliveryBatches).toEqual([])
  })

  it('publishes one linked compensation for an immediate delivery', () => {
    const { factory, deliveryBatches, projected } = createHarness()

    factory.startTransaction()
    update(factory, { sharedDelivery: 'immediate' })
    expect(deliveryBatches).toHaveLength(1)
    expect(deliveryBatches.flatMap((batch) => batch.deliveries)).toHaveLength(1)
    factory.endTransaction({ outcome: 'rollback' })

    expect(projected).toEqual([
      expect.objectContaining({ before: 0, after: 1 }),
      expect.objectContaining({ before: 1, after: 0 })
    ])
    expect(deliveryBatches).toHaveLength(2)
    expect(deliveryBatches.flatMap((batch) => batch.deliveries)).toEqual([
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

  it('compensates a remote immediate projection without local evidence side effects', () => {
    const { factory, projected } = createHarness()
    const failure = new Error('remote action failed after immediate projection')
    const deliveryBatch = vi.fn()
    const publication = vi.fn()
    factory.subscribeToSharedDeliveryBatch(deliveryBatch)
    factory.subscribeToSharedPublication(publication)
    factory.registerTransactionReplayHandler(
      EventTypes.UPDATE_PROPERTY,
      () => true
    )

    expect(() =>
      factory.runRemoteTransaction(() => {
        update(factory, { sharedDelivery: 'immediate' })
        throw failure
      })
    ).toThrow(failure)

    expect(projected).toEqual([
      expect.objectContaining({ before: 0, after: 1 }),
      expect.objectContaining({ before: 1, after: 0 })
    ])
    expect(deliveryBatch).not.toHaveBeenCalled()
    expect(publication).not.toHaveBeenCalled()
    expect(
      (factory.transact as unknown as { undoStack: unknown[] }).undoStack
    ).toEqual([])
    expect(
      (factory.transact as unknown as { redoStack: unknown[] }).redoStack
    ).toEqual([])
  })

  it('publishes compensation on the inverse event route', () => {
    const { factory, deliveryBatches } = createHarness()

    factory.startTransaction()
    factory.updateTransaction({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: EventTypes.ADD_ELEMENT,
      payload: {
        id: 'temporary-element',
        undoType: EventTypes.REMOVE_ELEMENT
      },
      options: {
        shared: SharedDataChannelNames.SCENE_TREE,
        sharedDelivery: 'immediate'
      }
    })
    factory.endTransaction({ outcome: 'rollback' })

    expect(deliveryBatches.flatMap((batch) => batch.deliveries)).toEqual([
      expect.objectContaining({
        kind: 'forward',
        eventName: EventTypes.ADD_ELEMENT
      }),
      expect.objectContaining({
        kind: 'compensation',
        eventName: EventTypes.REMOVE_ELEMENT,
        compensatesDeliveryId: '1:0:forward'
      })
    ])
  })

  it('publishes committed undo and redo replay as inverse and forward deliveries', () => {
    const { factory, deliveryBatches, projected } = createHarness()
    factory.registerTransactionReplayHandler(
      EventTypes.UPDATE_PROPERTY,
      () => true
    )
    factory.startTransaction()
    update(factory)
    factory.endTransaction()
    deliveryBatches.length = 0
    projected.length = 0

    factory.undo()

    expect(projected).toEqual([
      expect.objectContaining({ before: 1, after: 0 })
    ])
    expect(deliveryBatches).toHaveLength(1)
    expect(deliveryBatches.flatMap((batch) => batch.deliveries)).toEqual([
      expect.objectContaining({
        origin: 'undo',
        kind: 'forward',
        payload: expect.objectContaining({ before: 1, after: 0 }),
        sharedDelivery: 'transaction-end'
      })
    ])

    deliveryBatches.length = 0
    projected.length = 0
    factory.redo()

    expect(projected).toEqual([
      expect.objectContaining({ before: 0, after: 1 })
    ])
    expect(deliveryBatches).toHaveLength(1)
    expect(deliveryBatches.flatMap((batch) => batch.deliveries)).toEqual([
      expect.objectContaining({
        origin: 'redo',
        kind: 'forward',
        payload: expect.objectContaining({ before: 0, after: 1 }),
        sharedDelivery: 'transaction-end'
      })
    ])
  })

  it('restores the source immediate mode when a replay handler leaves delivery unset', () => {
    const { factory, deliveryBatches } = createHarness()
    factory.registerTransactionReplayHandler(
      EventTypes.UPDATE_PROPERTY,
      (event) => {
        factory.updateTransaction({
          type: TransactionEventTypes.UPDATE_TRANSACTION,
          eventName: event.type,
          payload: (event as { payload: unknown }).payload,
          options: {
            undoable: false,
            rollbackable: true,
            shared: SharedDataChannelNames.SCENE_TREE,
            sharedDelivery: undefined
          }
        })
        return true
      }
    )
    factory.startTransaction()
    update(factory, { sharedDelivery: 'immediate' })
    factory.endTransaction()
    deliveryBatches.length = 0

    factory.undo()

    const deliveries = deliveryBatches.flatMap((batch) => batch.deliveries)
    expect(deliveries).toHaveLength(1)
    expect(deliveries[0]).toEqual(
      expect.objectContaining({
        sharedDelivery: 'immediate',
        payload: expect.objectContaining({
          options: {
            undoable: false,
            rollbackable: true,
            sharedDelivery: 'immediate'
          }
        })
      })
    )
  })

  it('omits an unset canonical payload options field from shared delivery', () => {
    const { factory, deliveryBatches } = createHarness()
    factory.startTransaction()
    factory.updateTransaction({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: EventTypes.UPDATE_PROPERTY,
      payload: {
        id: 'shared-delivery',
        before: 0,
        after: 1,
        options: undefined
      },
      options: { shared: SharedDataChannelNames.SCENE_TREE }
    })
    factory.endTransaction()

    const deliveries = deliveryBatches.flatMap((batch) => batch.deliveries)
    expect(deliveries).toHaveLength(1)
    expect(
      Object.prototype.hasOwnProperty.call(deliveries[0]?.payload, 'options')
    ).toBe(false)
  })

  it('omits unset fields from canonical payload mutation options', () => {
    const { factory, deliveryBatches } = createHarness()
    factory.startTransaction()
    factory.updateTransaction({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: EventTypes.UPDATE_PROPERTY,
      payload: {
        id: 'shared-delivery',
        before: 0,
        after: 1,
        options: {
          undoable: false,
          rollbackable: undefined,
          shared: undefined,
          sharedDelivery: undefined
        }
      },
      options: { shared: SharedDataChannelNames.SCENE_TREE }
    })
    factory.endTransaction()

    const deliveries = deliveryBatches.flatMap((batch) => batch.deliveries)
    expect(deliveries).toHaveLength(1)
    expect(deliveries[0]?.payload).toEqual(
      expect.objectContaining({ options: { undoable: false } })
    )
    expect(
      Object.keys(
        (deliveries[0]?.payload as { options?: Record<string, unknown> })
          .options ?? {}
      )
    ).toEqual(['undoable'])
  })

  it('isolates delivery batch subscriber failure from other subscribers and commit', () => {
    const factory = new Factory()
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      new LocalSharedDataChannel()
    )
    const later = vi.fn()
    factory.subscribeToSharedDeliveryBatch(() => {
      throw new Error('observer failed')
    })
    factory.subscribeToSharedDeliveryBatch(later)

    factory.startTransaction()
    update(factory)
    expect(() => factory.endTransaction()).not.toThrow()

    expect(later).toHaveBeenCalledTimes(1)
  })

  it('isolates nested delivery batch subscriber mutation from later delivery and compensation', () => {
    const factory = new Factory()
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      new LocalSharedDataChannel()
    )
    const laterDeliveryBatches: SharedDeliveryBatch[] = []
    factory.subscribeToSharedDeliveryBatch((batch) => {
      const payload = batch.deliveries[0]?.payload as {
        after: { value: number }
      }
      payload.after.value = 99
    })
    factory.subscribeToSharedDeliveryBatch((batch) =>
      laterDeliveryBatches.push(batch)
    )

    factory.startTransaction()
    factory.updateTransaction({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: EventTypes.UPDATE_PROPERTY,
      payload: {
        id: 'nested-shared-delivery',
        before: { value: 0 },
        after: { value: 1 }
      },
      options: {
        shared: SharedDataChannelNames.SCENE_TREE,
        sharedDelivery: 'immediate'
      }
    })
    factory.endTransaction({ outcome: 'rollback' })

    expect(laterDeliveryBatches.flatMap((batch) => batch.deliveries)).toEqual([
      expect.objectContaining({
        kind: 'forward',
        payload: expect.objectContaining({
          before: { value: 0 },
          after: { value: 1 }
        })
      }),
      expect.objectContaining({
        kind: 'compensation',
        payload: expect.objectContaining({
          before: { value: 1 },
          after: { value: 0 }
        })
      })
    ])
  })

  it('keeps Factory-owned delivery and history immutable across a custom batch channel', () => {
    const factory = new Factory()
    const retainedBatches: (readonly unknown[])[] = []
    const channel = {
      appendBatch: (changes: readonly unknown[]) => {
        retainedBatches.push(changes)
      },
      observeBatch: () => () => undefined
    } as SharedDataChannel
    const deliveryBatches: SharedDeliveryBatch[] = []
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      channel
    )
    factory.registerTransactionReplayHandler(
      EventTypes.UPDATE_PROPERTY,
      () => true
    )
    factory.subscribeToSharedDeliveryBatch((batch) =>
      deliveryBatches.push(batch)
    )

    factory.startTransaction()
    factory.updateTransaction({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: EventTypes.UPDATE_PROPERTY,
      payload: {
        id: 'custom-channel-a',
        before: { value: 0 },
        after: { value: 1 }
      },
      options: { shared: SharedDataChannelNames.SCENE_TREE }
    })
    factory.updateTransaction({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: EventTypes.UPDATE_PROPERTY,
      payload: {
        id: 'custom-channel-b',
        before: { value: 10 },
        after: { value: 11 }
      },
      options: { shared: SharedDataChannelNames.SCENE_TREE }
    })
    factory.endTransaction()

    expect(deliveryBatches).toHaveLength(1)
    expect(deliveryBatches.flatMap((batch) => batch.deliveries)).toEqual([
      expect.objectContaining({
        origin: 'action',
        payload: expect.objectContaining({
          id: 'custom-channel-a',
          before: { value: 0 },
          after: { value: 1 }
        })
      }),
      expect.objectContaining({
        origin: 'action',
        payload: expect.objectContaining({
          id: 'custom-channel-b',
          before: { value: 10 },
          after: { value: 11 }
        })
      })
    ])
    expect(retainedBatches).toHaveLength(1)
    expect(retainedBatches[0]).toHaveLength(2)
    const retainedFirst = retainedBatches[0]?.[0] as {
      before: { value: number }
    }
    const retainedSecond = retainedBatches[0]?.[1] as {
      after: { value: number }
    }
    expect(Object.isFrozen(retainedBatches[0])).toBe(true)
    expect(Object.isFrozen(retainedFirst.before)).toBe(true)
    expect(() => {
      retainedFirst.before.value = 88
    }).toThrow(TypeError)
    expect(() => {
      retainedSecond.after.value = 77
    }).toThrow(TypeError)
    deliveryBatches.length = 0
    factory.undo()

    expect(deliveryBatches).toHaveLength(1)
    expect(deliveryBatches.flatMap((batch) => batch.deliveries)).toEqual([
      expect.objectContaining({
        origin: 'undo',
        payload: expect.objectContaining({
          id: 'custom-channel-b',
          before: { value: 11 },
          after: { value: 10 }
        })
      }),
      expect.objectContaining({
        origin: 'undo',
        payload: expect.objectContaining({
          id: 'custom-channel-a',
          before: { value: 1 },
          after: { value: 0 }
        })
      })
    ])

    deliveryBatches.length = 0
    factory.redo()

    expect(deliveryBatches).toHaveLength(1)
    expect(deliveryBatches.flatMap((batch) => batch.deliveries)).toEqual([
      expect.objectContaining({
        origin: 'redo',
        payload: expect.objectContaining({
          id: 'custom-channel-a',
          before: { value: 0 },
          after: { value: 1 }
        })
      }),
      expect.objectContaining({
        origin: 'redo',
        payload: expect.objectContaining({
          id: 'custom-channel-b',
          before: { value: 10 },
          after: { value: 11 }
        })
      })
    ])
  })

  it('keeps built-in batch delivery independent from the scalar prototype convenience', () => {
    const originalAppend = LocalSharedDataChannel.prototype.append
    const scalarAppend = vi.fn((_change: unknown) => {
      throw new Error('Factory internals must not call scalar append')
    })
    LocalSharedDataChannel.prototype.append = function (change) {
      scalarAppend(change)
    }

    try {
      const factory = new Factory()
      factory.registerSharedDataChannel(
        SharedDataChannelNames.SCENE_TREE,
        new LocalSharedDataChannel()
      )

      factory.startTransaction()
      factory.updateTransaction({
        type: TransactionEventTypes.UPDATE_TRANSACTION,
        eventName: EventTypes.UPDATE_PROPERTY,
        payload: {
          id: 'prototype-scalar-convenience',
          before: { value: 0 },
          after: { value: 1 }
        },
        options: { shared: SharedDataChannelNames.SCENE_TREE }
      })

      expect(() => factory.endTransaction()).not.toThrow()
      expect(scalarAppend).not.toHaveBeenCalled()
    } finally {
      LocalSharedDataChannel.prototype.append = originalAppend
    }
  })

  it.each([
    [
      'instance append override',
      () => {
        const channel = new LocalSharedDataChannel()
        channel.append = () => {
          throw new Error('Factory internals must not call scalar append')
        }
        return channel
      }
    ],
    [
      'Local channel subclass',
      () => {
        class MutatingLocalSharedDataChannel extends LocalSharedDataChannel {
          override append(): void {
            throw new Error('Factory internals must not call scalar append')
          }
        }
        return new MutatingLocalSharedDataChannel()
      }
    ]
  ])(
    'keeps Factory batch delivery independent from a %s',
    (_name, createChannel) => {
      const factory = new Factory()
      const deliveryBatches: SharedDeliveryBatch[] = []
      factory.registerSharedDataChannel(
        SharedDataChannelNames.SCENE_TREE,
        createChannel()
      )
      factory.subscribeToSharedDeliveryBatch((batch) =>
        deliveryBatches.push(batch)
      )

      factory.startTransaction()
      factory.updateTransaction({
        type: TransactionEventTypes.UPDATE_TRANSACTION,
        eventName: EventTypes.UPDATE_PROPERTY,
        payload: {
          id: 'non-built-in-local-channel',
          before: { value: 0 },
          after: { value: 1 }
        },
        options: { shared: SharedDataChannelNames.SCENE_TREE }
      })
      expect(() => factory.endTransaction()).not.toThrow()

      expect(deliveryBatches).toHaveLength(1)
      expect(deliveryBatches.flatMap((batch) => batch.deliveries)).toEqual([
        expect.objectContaining({
          payload: expect.objectContaining({
            before: { value: 0 },
            after: { value: 1 }
          })
        })
      ])
    }
  )

  it('uses an exact custom batch Proxy without inspecting its prototype', () => {
    const deliveryBatches: SharedDeliveryBatch[] = []
    const appendBatch = vi.fn()
    const target = {
      appendBatch,
      observeBatch: () => () => undefined
    }
    const channel = new Proxy(target, {
      getPrototypeOf: () => {
        throw new Error('prototype inspection blocked')
      }
    }) as SharedDataChannel
    const factory = new Factory()
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      channel
    )
    factory.subscribeToSharedDeliveryBatch((batch) =>
      deliveryBatches.push(batch)
    )

    factory.startTransaction()
    factory.updateTransaction({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: EventTypes.UPDATE_PROPERTY,
      payload: {
        id: 'proxy-batch-channel',
        before: { value: 0 },
        after: { value: 1 }
      },
      options: { shared: SharedDataChannelNames.SCENE_TREE }
    })

    expect(() => factory.endTransaction()).not.toThrow()
    expect(appendBatch).toHaveBeenCalledOnce()
    expect(deliveryBatches).toHaveLength(1)
    expect(deliveryBatches.flatMap((batch) => batch.deliveries)).toEqual([
      expect.objectContaining({
        payload: expect.objectContaining({
          before: { value: 0 },
          after: { value: 1 }
        })
      })
    ])
  })

  it('rolls back the exact journal when a custom batch channel rejects its input', () => {
    const factory = new Factory()
    const failure = new Error('custom channel appendBatch failed')
    const channel = {
      appendBatch: () => {
        throw failure
      },
      observeBatch: () => () => undefined
    } as SharedDataChannel
    const publications: unknown[] = []
    const replayed: unknown[] = []
    const statuses: { origin: string; status: string }[] = []
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      channel
    )
    factory.registerTransactionReplayHandler(
      EventTypes.UPDATE_PROPERTY,
      (event, mode) => {
        expect(mode).toBe('rollback')
        replayed.push((event as { payload: unknown }).payload)
        return true
      }
    )
    factory.subscribeToSharedPublication((publication) =>
      publications.push(publication)
    )
    factory.subscribeToTransactionStatus((status) => statuses.push(status))

    factory.startTransaction()
    factory.updateTransaction({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: EventTypes.UPDATE_PROPERTY,
      payload: {
        id: 'custom-channel-failure',
        before: { value: 0 },
        after: { value: 1 }
      },
      options: { shared: SharedDataChannelNames.SCENE_TREE }
    })

    expect(() => factory.endTransaction()).toThrow(failure)
    expect(replayed).toEqual([
      expect.objectContaining({
        before: { value: 1 },
        after: { value: 0 }
      })
    ])
    expect(publications).toEqual([])
    expect(statuses.at(-1)).toEqual(
      expect.objectContaining({ origin: 'action', status: 'rolled-back' })
    )
    expect(
      (factory.transact as unknown as { undoStack: unknown[] }).undoStack
    ).toEqual([])
    expect(
      (factory.transact as unknown as { redoStack: unknown[] }).redoStack
    ).toEqual([])
  })

  it('keeps immediate compensation exact through a custom batch channel', () => {
    const factory = new Factory()
    const channel = {
      appendBatch: vi.fn(),
      observeBatch: () => () => undefined
    } as SharedDataChannel
    const deliveryBatches: SharedDeliveryBatch[] = []
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      channel
    )
    factory.registerTransactionReplayHandler(
      EventTypes.UPDATE_PROPERTY,
      () => true
    )
    factory.subscribeToSharedDeliveryBatch((batch) =>
      deliveryBatches.push(batch)
    )

    factory.startTransaction()
    factory.updateTransaction({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: EventTypes.UPDATE_PROPERTY,
      payload: {
        id: 'custom-channel-immediate',
        before: { value: 0 },
        after: { value: 1 }
      },
      options: {
        shared: SharedDataChannelNames.SCENE_TREE,
        sharedDelivery: 'immediate'
      }
    })
    factory.endTransaction({ outcome: 'rollback' })

    expect(deliveryBatches).toHaveLength(2)
    expect(deliveryBatches.flatMap((batch) => batch.deliveries)).toEqual([
      expect.objectContaining({
        kind: 'forward',
        payload: expect.objectContaining({
          before: { value: 0 },
          after: { value: 1 }
        })
      }),
      expect.objectContaining({
        kind: 'compensation',
        payload: expect.objectContaining({
          before: { value: 1 },
          after: { value: 0 }
        })
      })
    ])
    expect(
      (factory.transact as unknown as { undoStack: unknown[] }).undoStack
    ).toEqual([])
  })

  it('keeps remote rollback exact when a custom batch channel rejects', () => {
    const factory = new Factory()
    const failure = new Error('remote custom channel appendBatch failed')
    const channel = {
      appendBatch: () => {
        throw failure
      },
      observeBatch: () => () => undefined
    } as SharedDataChannel
    const publications: unknown[] = []
    const replayed: unknown[] = []
    const statuses: { origin: string; status: string }[] = []
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      channel
    )
    factory.registerTransactionReplayHandler(
      EventTypes.UPDATE_PROPERTY,
      (event, mode) => {
        expect(mode).toBe('rollback')
        replayed.push((event as { payload: unknown }).payload)
        return true
      }
    )
    factory.subscribeToSharedPublication((publication) =>
      publications.push(publication)
    )
    factory.subscribeToTransactionStatus((status) => statuses.push(status))

    expect(() =>
      factory.runRemoteTransaction(() => {
        factory.updateTransaction({
          type: TransactionEventTypes.UPDATE_TRANSACTION,
          eventName: EventTypes.UPDATE_PROPERTY,
          payload: {
            id: 'remote-custom-channel-failure',
            before: { value: 0 },
            after: { value: 1 }
          },
          options: { shared: SharedDataChannelNames.SCENE_TREE }
        })
      })
    ).toThrow(failure)

    expect(replayed).toEqual([
      expect.objectContaining({
        before: { value: 1 },
        after: { value: 0 }
      })
    ])
    expect(publications).toEqual([])
    expect(statuses.at(-1)).toEqual(
      expect.objectContaining({ origin: 'remote', status: 'rolled-back' })
    )
    expect(
      (factory.transact as unknown as { undoStack: unknown[] }).undoStack
    ).toEqual([])
    expect(
      (factory.transact as unknown as { redoStack: unknown[] }).redoStack
    ).toEqual([])
  })

  it('isolates local projection mutation from later observers and collaboration delivery', () => {
    const factory = new Factory()
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      new LocalSharedDataChannel()
    )
    const laterProjection = vi.fn()
    const deliveryBatch = vi.fn()
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
    factory.subscribeToSharedDeliveryBatch(deliveryBatch)

    factory.startTransaction()
    update(factory)
    factory.endTransaction()

    expect(laterProjection).toHaveBeenCalledWith(
      expect.objectContaining({ after: 1 })
    )
    expect(deliveryBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        deliveries: [
          expect.objectContaining({
            payload: expect.objectContaining({ after: 1 })
          })
        ]
      })
    )
  })
})
