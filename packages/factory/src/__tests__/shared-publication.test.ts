import { describe, expect, it, vi } from 'vitest'
import {
  EventTypes,
  TransactionEventTypes,
  subscribeToUserActionCompleted
} from '@asyra/reactive-events'
import {
  PROPS_ACTIONS,
  SCENE_TREE_ACTIONS,
  SharedDataChannelNames
} from '@asyra/utils'
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
  it('emits detached settlement spans for channel delivery and publication', () => {
    const runtimeGlobal = globalThis as typeof globalThis & {
      __asyraBrowserDragPhaseSink?: (name: string, durationMs: number) => void
    }
    const previous = runtimeGlobal.__asyraBrowserDragPhaseSink
    const phaseNames: string[] = []
    runtimeGlobal.__asyraBrowserDragPhaseSink = (name) => phaseNames.push(name)
    const { factory } = createHarness()

    try {
      factory.startTransaction()
      update(factory, 'element-a', 1)
      update(factory, 'element-b', 2)
      factory.endTransaction()
    } finally {
      runtimeGlobal.__asyraBrowserDragPhaseSink = previous
    }

    expect(phaseNames).toEqual(
      expect.arrayContaining([
        'factory:journal-payload-clone',
        'factory:shared-payload-normalize',
        'factory:flush-shared-channels',
        'factory:shared-channel-append',
        'factory:shared-channel-observer',
        'factory:create-shared-publication',
        'factory:notify-shared-publication'
      ])
    )
    expect(phaseNames).not.toContain('factory:shared-channel-boundary-clone')
    expect(phaseNames).not.toContain('factory:shared-sink-boundary-clone')
  })

  it('publishes hierarchy changes as one uninterpreted transaction group', () => {
    const { factory, publications } = createHarness()

    factory.startTransaction()
    factory.updateTransaction({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: EventTypes.MOVE_ELEMENTS,
      payload: {
        action: SCENE_TREE_ACTIONS.MOVE_ELEMENTS,
        eventName: EventTypes.MOVE_ELEMENTS,
        moves: [
          {
            elementId: 'element-a',
            before: { parentId: 'workspace', index: 0 },
            after: { parentId: 'group-a', index: 0 }
          }
        ]
      },
      options: { shared: SharedDataChannelNames.SCENE_TREE }
    })
    factory.updateTransaction({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: EventTypes.CHANGE_SUBTREE,
      payload: {
        action: SCENE_TREE_ACTIONS.REMOVE_SUBTREE,
        undoAction: SCENE_TREE_ACTIONS.RESTORE_SUBTREE,
        eventName: EventTypes.CHANGE_SUBTREE,
        elementId: 'group-b',
        removed: [],
        rootParentChildrenAfter: []
      },
      options: { shared: SharedDataChannelNames.SCENE_TREE }
    })
    factory.endTransaction()

    expect(publications).toHaveLength(1)
    expect(publications[0]?.deliveries).toEqual([
      expect.objectContaining({
        eventName: EventTypes.MOVE_ELEMENTS,
        payload: expect.objectContaining({
          action: SCENE_TREE_ACTIONS.MOVE_ELEMENTS
        })
      }),
      expect.objectContaining({
        eventName: EventTypes.CHANGE_SUBTREE,
        payload: expect.objectContaining({
          action: SCENE_TREE_ACTIONS.REMOVE_SUBTREE
        })
      })
    ])
  })

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

  it('compensates every flushed progressive publication in global reverse order when the action rolls back', async () => {
    const { factory, projected, publications } = createHarness()

    factory.startTransaction()
    update(factory, 'element-a', 1, { sharedDelivery: 'immediate' })
    await Promise.resolve()
    update(factory, 'element-b', 2, { sharedDelivery: 'immediate' })
    await Promise.resolve()

    expect(publications).toEqual([
      expect.objectContaining({
        origin: 'action',
        deliveries: [expect.objectContaining({ deliveryId: '1:0:forward' })]
      }),
      expect.objectContaining({
        origin: 'action',
        deliveries: [expect.objectContaining({ deliveryId: '1:1:forward' })]
      })
    ])

    factory.endTransaction({ outcome: 'rollback' })

    expect(publications).toHaveLength(3)
    expect(publications[2]).toEqual({
      publicationId: '1:publication:3',
      transactionId: 1,
      origin: 'rollback-compensation',
      deliveries: [
        expect.objectContaining({
          deliveryId: '1:1:compensation:0',
          compensatesDeliveryId: '1:1:forward',
          payload: expect.objectContaining({
            id: 'element-b',
            before: 2,
            after: 1
          })
        }),
        expect.objectContaining({
          deliveryId: '1:0:compensation:0',
          compensatesDeliveryId: '1:0:forward',
          payload: expect.objectContaining({
            id: 'element-a',
            before: 1,
            after: 0
          })
        })
      ]
    })
    expect(
      projected.map((change) => {
        const payload = change as { id: string; after: number }
        return `${payload.id}:${payload.after}`
      })
    ).toEqual(['element-a:1', 'element-b:2', 'element-b:1', 'element-a:0'])
    expect(
      (factory.transact as unknown as { undoStack: unknown[] }).undoStack
    ).toEqual([])
    expect(
      (factory.transact as unknown as { redoStack: unknown[] }).redoStack
    ).toEqual([])

    factory.undo()
    factory.redo()
    expect(publications).toHaveLength(3)
  })

  it('creates no publication or history record for a zero-mutation action', async () => {
    const { factory, projected, publications } = createHarness()

    factory.startTransaction()
    factory.endTransaction()
    await Promise.resolve()

    expect(projected).toEqual([])
    expect(publications).toEqual([])
    expect(
      (factory.transact as unknown as { undoStack: unknown[] }).undoStack
    ).toEqual([])
    expect(
      (factory.transact as unknown as { redoStack: unknown[] }).redoStack
    ).toEqual([])

    factory.undo()
    factory.redo()
    expect(publications).toEqual([])
  })

  it('publishes one atomic batch for each multi-change action, undo, and redo transition', () => {
    const { factory, publications } = createHarness()
    factory.registerTransactionReplayHandler(
      EventTypes.UPDATE_COMPUTED_DATA,
      () => true
    )

    factory.startTransaction()
    update(factory, 'element-a', 1)
    update(factory, 'element-b', 2)
    factory.endTransaction()

    expect(publications).toHaveLength(1)
    expect(
      publications[0]?.deliveries.map(
        ({ payload }) => (payload as { id: string }).id
      )
    ).toEqual(['element-a', 'element-b'])
    expect(
      (factory.transact as unknown as { undoStack: unknown[] }).undoStack
    ).toHaveLength(1)
    expect(
      (factory.transact as unknown as { redoStack: unknown[] }).redoStack
    ).toHaveLength(0)
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
    expect(
      (factory.transact as unknown as { undoStack: unknown[] }).undoStack
    ).toHaveLength(0)
    expect(
      (factory.transact as unknown as { redoStack: unknown[] }).redoStack
    ).toHaveLength(1)

    publications.length = 0
    factory.redo()

    expect(publications).toHaveLength(1)
    expect(publications[0]).toEqual(
      expect.objectContaining({
        origin: 'redo',
        deliveries: [
          expect.objectContaining({
            sharedDelivery: 'transaction-end',
            payload: expect.objectContaining({
              id: 'element-a',
              after: 1
            })
          }),
          expect.objectContaining({
            sharedDelivery: 'transaction-end',
            payload: expect.objectContaining({
              id: 'element-b',
              after: 2
            })
          })
        ]
      })
    )
    expect(
      (factory.transact as unknown as { undoStack: unknown[] }).undoStack
    ).toHaveLength(1)
    expect(
      (factory.transact as unknown as { redoStack: unknown[] }).redoStack
    ).toHaveLength(0)
  })

  it('publishes exact Props-before-Scene subtree restore evidence in one undo batch', () => {
    const { factory, publications } = createHarness()
    factory.registerSharedDataChannel(
      SharedDataChannelNames.PROPS,
      new LocalSharedDataChannel()
    )
    factory.registerTransactionReplayHandler(
      EventTypes.ADD_PROPERTY,
      () => true
    )
    factory.registerTransactionReplayHandler(
      EventTypes.CHANGE_SUBTREE,
      () => true
    )
    const propertyData = {
      id: 'position-b',
      type: 'position',
      x: 12,
      y: 24
    }
    const rootParentChildrenAfter = ['element-a', 'element-c']

    factory.startTransaction()
    factory.updateTransaction({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: EventTypes.CHANGE_SUBTREE,
      payload: {
        action: SCENE_TREE_ACTIONS.REMOVE_SUBTREE,
        undoAction: SCENE_TREE_ACTIONS.RESTORE_SUBTREE,
        eventName: EventTypes.CHANGE_SUBTREE,
        elementId: 'group-b',
        removed: [
          {
            elementId: 'group-b',
            parentId: 'workspace',
            index: 1,
            data: {
              id: 'group-b',
              type: 'group',
              name: 'Group B',
              parentId: 'workspace',
              visible: true,
              lock: false,
              children: [],
              props: { position: 'position-b' }
            }
          }
        ],
        rootParentChildrenAfter
      },
      options: { shared: SharedDataChannelNames.SCENE_TREE }
    })
    factory.updateTransaction({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: EventTypes.REMOVE_PROPERTY,
      payload: {
        action: PROPS_ACTIONS.REMOVE_PROPERTY,
        undoType: EventTypes.ADD_PROPERTY,
        undoAction: PROPS_ACTIONS.ADD_PROPERTY,
        eventName: EventTypes.REMOVE_PROPERTY,
        data: [propertyData]
      },
      options: { shared: SharedDataChannelNames.PROPS }
    })
    factory.endTransaction()
    publications.length = 0

    propertyData.x = 999
    rootParentChildrenAfter.push('later-runtime-element')
    factory.undo()

    expect(publications).toHaveLength(1)
    expect(publications[0]).toEqual(
      expect.objectContaining({
        origin: 'undo',
        deliveries: [
          expect.objectContaining({
            channel: SharedDataChannelNames.PROPS,
            eventName: EventTypes.ADD_PROPERTY,
            payload: expect.objectContaining({
              action: PROPS_ACTIONS.ADD_PROPERTY,
              eventName: EventTypes.ADD_PROPERTY,
              data: [
                expect.objectContaining({
                  id: 'position-b',
                  x: 12,
                  y: 24
                })
              ]
            })
          }),
          expect.objectContaining({
            channel: SharedDataChannelNames.SCENE_TREE,
            eventName: EventTypes.CHANGE_SUBTREE,
            payload: expect.objectContaining({
              action: SCENE_TREE_ACTIONS.RESTORE_SUBTREE,
              rootParentChildrenAfter: ['element-a', 'element-c']
            })
          })
        ]
      })
    )
  })

  it('replays progressive publications separately while consuming one undo or redo action', async () => {
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

    expect(publications).toHaveLength(2)
    expect(publications[0]).toEqual(
      expect.objectContaining({
        origin: 'undo',
        deliveries: [
          expect.objectContaining({
            payload: expect.objectContaining({ id: 'element-a', after: 1 })
          })
        ]
      })
    )
    expect(publications[1]).toEqual(
      expect.objectContaining({
        origin: 'undo',
        deliveries: [
          expect.objectContaining({
            payload: expect.objectContaining({ id: 'element-a', after: 0 })
          })
        ]
      })
    )

    publications.length = 0
    factory.redo()

    expect(publications).toHaveLength(2)
    expect(publications[0]).toEqual(
      expect.objectContaining({
        origin: 'redo',
        deliveries: [
          expect.objectContaining({
            payload: expect.objectContaining({ id: 'element-a', after: 1 })
          })
        ]
      })
    )
    expect(publications[1]).toEqual(
      expect.objectContaining({
        origin: 'redo',
        deliveries: [
          expect.objectContaining({
            payload: expect.objectContaining({ id: 'element-a', after: 2 })
          })
        ]
      })
    )
  })

  it('preserves replay order when undo crosses transaction-end and immediate deliveries', async () => {
    const { factory, publications } = createHarness()
    factory.registerTransactionReplayHandler(
      EventTypes.UPDATE_COMPUTED_DATA,
      () => true
    )

    factory.startTransaction()
    update(factory, 'immediate-first', 1, {
      sharedDelivery: 'immediate'
    })
    update(factory, 'transaction-end-second', 1)
    factory.endTransaction()
    await Promise.resolve()
    publications.length = 0

    factory.undo()

    expect(
      publications.flatMap(({ deliveries }) =>
        deliveries.map(
          ({ payload }) => (payload as { id?: unknown }).id as string
        )
      )
    ).toEqual(['transaction-end-second', 'immediate-first'])

    publications.length = 0
    factory.redo()

    expect(
      publications.flatMap(({ deliveries }) =>
        deliveries.map(
          ({ payload }) => (payload as { id?: unknown }).id as string
        )
      )
    ).toEqual(['immediate-first', 'transaction-end-second'])
  })

  it('compensates already-published progressive replay when a later undo batch fails', async () => {
    const { factory, publications } = createHarness()
    let failSecondReplay = true
    let replayCount = 0
    factory.registerTransactionReplayHandler(
      EventTypes.UPDATE_COMPUTED_DATA,
      () => {
        replayCount += 1
        if (failSecondReplay && replayCount === 2) {
          throw new Error('later progressive replay failed')
        }
        return true
      }
    )

    factory.startTransaction()
    update(factory, 'element-a', 1, { sharedDelivery: 'immediate' })
    await Promise.resolve()
    update(factory, 'element-a', 2, { sharedDelivery: 'immediate' })
    await Promise.resolve()
    factory.endTransaction()
    publications.length = 0

    expect(() => factory.undo()).toThrow('Transaction rollback failed')
    expect(publications).toHaveLength(2)
    expect(publications[0]).toEqual(
      expect.objectContaining({
        origin: 'undo',
        deliveries: [
          expect.objectContaining({
            kind: 'forward',
            payload: expect.objectContaining({ after: 1 })
          })
        ]
      })
    )
    expect(publications[1]).toEqual(
      expect.objectContaining({
        origin: 'rollback-compensation',
        deliveries: [
          expect.objectContaining({
            kind: 'compensation',
            payload: expect.objectContaining({ after: 2 })
          })
        ]
      })
    )

    failSecondReplay = false
    replayCount = 0
    publications.length = 0
    factory.undo()

    expect(publications).toHaveLength(2)
    expect(publications.every(({ origin }) => origin === 'undo')).toBe(true)
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

  it('isolates nested publication subscriber mutation from later publication and Undo', () => {
    const factory = new Factory()
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      new LocalSharedDataChannel()
    )
    factory.registerTransactionReplayHandler(
      EventTypes.UPDATE_COMPUTED_DATA,
      () => true
    )
    const laterPublications: SharedPublication[] = []
    factory.subscribeToSharedPublication((publication) => {
      const payload = publication.deliveries[0]?.payload as {
        after: { value: number }
      }
      payload.after.value = 99
    })
    factory.subscribeToSharedPublication((publication) =>
      laterPublications.push(publication)
    )

    factory.startTransaction()
    factory.updateTransaction({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: EventTypes.UPDATE_COMPUTED_DATA,
      payload: {
        id: 'nested-publication-mutation',
        before: { value: 0 },
        after: { value: 1 }
      },
      options: { shared: SharedDataChannelNames.SCENE_TREE }
    })
    factory.endTransaction()

    expect(laterPublications).toEqual([
      expect.objectContaining({
        origin: 'action',
        deliveries: [
          expect.objectContaining({
            payload: expect.objectContaining({
              before: { value: 0 },
              after: { value: 1 }
            })
          })
        ]
      })
    ])

    laterPublications.length = 0
    factory.undo()

    expect(laterPublications).toEqual([
      expect.objectContaining({
        origin: 'undo',
        deliveries: [
          expect.objectContaining({
            payload: expect.objectContaining({
              before: { value: 1 },
              after: { value: 0 }
            })
          })
        ]
      })
    ])
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

  it('hands off each commit before a completion observer can commit reentrantly', () => {
    const factory = new Factory({ bridgeToReactiveEvents: true })
    const order: string[] = []
    factory.subscribeToCommitCapture(({ transactionId }) => {
      order.push(`capture-${transactionId}`)
    })
    factory.subscribeToTransactionStatus(({ status, transactionId }) => {
      if (status === 'committed') order.push(`status-${transactionId}`)
    })
    let nested = false
    const completionSubscription = subscribeToUserActionCompleted(() => {
      order.push('completion')
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

    expect(order).toEqual([
      'capture-1',
      'completion',
      'capture-2',
      'completion',
      'status-1',
      'status-2'
    ])
  })
})
