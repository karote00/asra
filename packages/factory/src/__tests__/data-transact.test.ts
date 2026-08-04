import { describe, expect, it, vi } from 'vitest'
import {
  acknowledgeTransactionReplayApplied,
  EventTypes,
  TransactionEventTypes,
  runWithTransactionOwner,
  subscribeToSynchronousEvent,
  subscribeToEvents,
  subscribeToUserActionCompleted,
  type AllEvent,
  type UpdateTransactionEvent
} from '@asyra/reactive-events'
import {
  SCENE_TREE_ACTIONS,
  SharedDataChannelNames,
  type HierarchyMove,
  type SubtreeRemovalEntry,
  type TransactionStatusPayload
} from '@asyra/utils'
import DataTransact from '../data-transact.js'
import { SharedDataChannelRegistry } from '../shared-data-channel.js'
import {
  TransactionRollbackError,
  TransactionValidationError
} from '../transaction.js'

interface ObservedPayloadEvent {
  type: string
  payload: unknown
}

interface TestCanonicalUpdateEvent {
  type: EventTypes
  payload: {
    id: string
    before: unknown
    after: unknown
  }
}

const createUpdateEvent = (
  options?: UpdateTransactionEvent['options']
): UpdateTransactionEvent => ({
  type: TransactionEventTypes.UPDATE_TRANSACTION,
  eventName: EventTypes.UPDATE_PROPERTY,
  payload: {
    id: 'test.change',
    before: 0,
    after: 1
  } as unknown as UpdateTransactionEvent['payload'],
  options
})

const orderedBatchOf = (
  ...changes: readonly Record<string, unknown>[]
): unknown[] => changes.map((change) => expect.objectContaining(change))

const runWithOwnedTransact = <T>(
  transact: DataTransact,
  callback: () => T
): T =>
  runWithTransactionOwner(
    {
      startTransaction: () => transact.start(),
      updateTransactionBatch: (events) => transact.updateBatch(events),
      endTransaction: (options) => transact.end(options),
      undo: () => transact.undo(),
      redo: () => transact.redo()
    },
    callback
  )

interface MutatingSharedSinkFixture {
  sink: Pick<SharedDataChannelRegistry, 'pushBatchToSharedChannel'>
  received: (readonly unknown[])[]
  restore?: () => void
}

const createMutatingSharedPush =
  (
    received: (readonly unknown[])[]
  ): SharedDataChannelRegistry['pushBatchToSharedChannel'] =>
  (_name, changes) => {
    received.push(changes)
    Reflect.set((changes[0] as { after: { value: number } }).after, 'value', 99)
    return true
  }

const mutatingSharedSinkFixtures: readonly [
  string,
  () => MutatingSharedSinkFixture
][] = [
  [
    'prototype override',
    () => {
      const received: (readonly unknown[])[] = []
      const sink = new SharedDataChannelRegistry()
      const originalPush =
        SharedDataChannelRegistry.prototype.pushBatchToSharedChannel
      SharedDataChannelRegistry.prototype.pushBatchToSharedChannel =
        createMutatingSharedPush(received)
      return {
        sink,
        received,
        restore: () => {
          SharedDataChannelRegistry.prototype.pushBatchToSharedChannel =
            originalPush
        }
      }
    }
  ],
  [
    'instance override',
    () => {
      const received: (readonly unknown[])[] = []
      const sink = new SharedDataChannelRegistry()
      sink.pushBatchToSharedChannel = createMutatingSharedPush(received)
      return { sink, received }
    }
  ],
  [
    'registry subclass',
    () => {
      const received: (readonly unknown[])[] = []
      const push = createMutatingSharedPush(received)
      class MutatingSharedDataChannelRegistry extends SharedDataChannelRegistry {
        override pushBatchToSharedChannel(
          name: string,
          changes: readonly unknown[]
        ): boolean {
          return Reflect.apply(push, this, [name, changes])
        }
      }
      return {
        sink: new MutatingSharedDataChannelRegistry(),
        received
      }
    }
  ],
  [
    'registry Proxy',
    () => {
      const received: (readonly unknown[])[] = []
      const push = createMutatingSharedPush(received)
      const target = new SharedDataChannelRegistry()
      return {
        sink: new Proxy(target, {
          get: (registry, property, receiver) =>
            property === 'pushBatchToSharedChannel'
              ? push
              : Reflect.get(registry, property, receiver),
          getPrototypeOf: () => {
            throw new Error('prototype inspection blocked')
          }
        }),
        received
      }
    }
  ]
]

describe('DataTransact hierarchy replay', () => {
  it('keeps move and subtree evidence in one undo unit with exact inverse and forward replay', () => {
    const replayed: AllEvent[] = []
    const transact = new DataTransact(undefined, {
      onReplayEvent: (event) => {
        replayed.push(event)
        return true
      }
    })
    const moves: HierarchyMove[] = [
      {
        elementId: 'element-a',
        before: { parentId: 'workspace', index: 1 },
        after: { parentId: 'group-a', index: 0 }
      }
    ]
    const removed: SubtreeRemovalEntry[] = [
      {
        elementId: 'element-b',
        parentId: 'group-b',
        index: 0,
        data: {
          id: 'element-b',
          type: 'rect',
          name: 'Rectangle',
          parentId: 'group-b',
          visible: true,
          lock: false
        }
      },
      {
        elementId: 'group-b',
        parentId: 'workspace',
        index: 2,
        data: {
          id: 'group-b',
          type: 'group',
          name: 'Group',
          parentId: 'workspace',
          visible: true,
          lock: false,
          children: ['element-b']
        }
      }
    ]
    const rootParentChildrenAfter = ['element-a']

    runWithOwnedTransact(transact, () => {
      transact.start()
      transact.update({
        type: TransactionEventTypes.UPDATE_TRANSACTION,
        eventName: EventTypes.MOVE_ELEMENTS,
        payload: {
          action: SCENE_TREE_ACTIONS.MOVE_ELEMENTS,
          eventName: EventTypes.MOVE_ELEMENTS,
          moves
        }
      })
      transact.update({
        type: TransactionEventTypes.UPDATE_TRANSACTION,
        eventName: EventTypes.CHANGE_SUBTREE,
        payload: {
          action: SCENE_TREE_ACTIONS.REMOVE_SUBTREE,
          undoAction: SCENE_TREE_ACTIONS.RESTORE_SUBTREE,
          eventName: EventTypes.CHANGE_SUBTREE,
          elementId: 'group-b',
          removed,
          rootParentChildrenAfter
        }
      })
      transact.end()

      transact.undo()
      transact.redo()
    })

    expect(replayed).toEqual([
      {
        type: EventTypes.CHANGE_SUBTREE,
        payload: expect.objectContaining({
          action: SCENE_TREE_ACTIONS.RESTORE_SUBTREE,
          undoAction: SCENE_TREE_ACTIONS.REMOVE_SUBTREE,
          removed,
          rootParentChildrenAfter
        })
      },
      {
        type: EventTypes.MOVE_ELEMENTS,
        payload: expect.objectContaining({
          moves: [
            {
              elementId: 'element-a',
              before: { parentId: 'group-a', index: 0 },
              after: { parentId: 'workspace', index: 1 }
            }
          ]
        })
      },
      {
        type: EventTypes.MOVE_ELEMENTS,
        payload: expect.objectContaining({ moves })
      },
      {
        type: EventTypes.CHANGE_SUBTREE,
        payload: expect.objectContaining({
          action: SCENE_TREE_ACTIONS.REMOVE_SUBTREE,
          undoAction: SCENE_TREE_ACTIONS.RESTORE_SUBTREE,
          removed,
          rootParentChildrenAfter
        })
      }
    ])
  })
})

describe('DataTransact user action completion', () => {
  it('reports discarded for an empty transaction', () => {
    const statuses: TransactionStatusPayload[] = []
    const transact = new DataTransact(undefined, {
      onStatus: (status) => statuses.push(status)
    })

    transact.start()
    transact.end()

    expect(statuses).toHaveLength(1)
    expect(statuses[0]).toMatchObject({
      status: 'discarded',
      origin: 'action',
      changeCount: 0
    })
  })

  it('reports committed transaction counts after local shared settlement', () => {
    const statuses: TransactionStatusPayload[] = []
    const pushBatchToSharedChannel = vi.fn().mockReturnValue(true)
    const transact = new DataTransact(
      { pushBatchToSharedChannel },
      { onStatus: (status) => statuses.push(status) }
    )

    transact.start()
    transact.update(createUpdateEvent({ shared: 'sceneTree' }))
    transact.update(createUpdateEvent({ undoable: false, rollbackable: true }))
    transact.update(createUpdateEvent({ rollbackable: false }))
    transact.end()

    expect(pushBatchToSharedChannel).toHaveBeenCalledTimes(1)
    expect(statuses[statuses.length - 1]).toMatchObject({
      status: 'committed',
      origin: 'action',
      changeCount: 3,
      undoableChangeCount: 2,
      rollbackableChangeCount: 2,
      nonRollbackableChangeCount: 1
    })
  })

  it('discards pending shared changes and compensates immediate delivery exactly once on rollback', () => {
    const statuses: TransactionStatusPayload[] = []
    const pushBatchToSharedChannel = vi.fn().mockReturnValue(true)
    const transact = new DataTransact(
      { pushBatchToSharedChannel },
      { onStatus: (status) => statuses.push(status) }
    )

    transact.start()
    transact.update(
      createUpdateEvent({
        shared: 'sceneTree',
        sharedDelivery: 'immediate'
      })
    )
    transact.update(createUpdateEvent({ shared: 'props' }))
    transact.end({
      outcome: 'rollback',
      failure: { kind: 'cancelled', message: 'escape' }
    })

    expect(pushBatchToSharedChannel).toHaveBeenCalledTimes(2)
    expect(pushBatchToSharedChannel.mock.calls).toEqual([
      [
        'sceneTree',
        orderedBatchOf({
          before: 0,
          after: 1,
          options: { sharedDelivery: 'immediate' }
        })
      ],
      [
        'sceneTree',
        orderedBatchOf({
          before: 1,
          after: 0,
          options: { sharedDelivery: 'immediate' }
        })
      ]
    ])
    expect(statuses[statuses.length - 1]).toMatchObject({
      status: 'rolled-back',
      failure: { kind: 'cancelled', message: 'escape' }
    })
  })

  it('flushes the mutation-time shared snapshot after caller payload mutation', () => {
    const pushBatchToSharedChannel = vi.fn().mockReturnValue(true)
    const transact = new DataTransact({ pushBatchToSharedChannel })
    const payload = {
      id: 'test.shared-snapshot',
      before: { value: 0 },
      after: { value: 1 }
    }

    transact.start()
    transact.update({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: EventTypes.UPDATE_PROPERTY,
      payload: payload as unknown as UpdateTransactionEvent['payload'],
      options: { shared: SharedDataChannelNames.SCENE_TREE }
    })
    payload.before.value = 40
    payload.after.value = 41
    transact.end()

    expect(pushBatchToSharedChannel).toHaveBeenCalledWith(
      SharedDataChannelNames.SCENE_TREE,
      orderedBatchOf({ before: { value: 0 }, after: { value: 1 } })
    )
  })

  it('materializes accessor payloads in the mutation-time shared snapshot', () => {
    const pushBatchToSharedChannel = vi.fn().mockReturnValue(true)
    const transact = new DataTransact({ pushBatchToSharedChannel })
    let before = 0
    let after = 1
    const payload = {
      id: 'test.accessor-shared-snapshot',
      get before() {
        return { value: before }
      },
      get after() {
        return { value: after }
      }
    }

    transact.start()
    transact.update({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: EventTypes.UPDATE_PROPERTY,
      payload: payload as unknown as UpdateTransactionEvent['payload'],
      options: { shared: SharedDataChannelNames.SCENE_TREE }
    })
    before = 40
    after = 41
    transact.end()

    expect(pushBatchToSharedChannel).toHaveBeenCalledWith(
      SharedDataChannelNames.SCENE_TREE,
      orderedBatchOf({ before: { value: 0 }, after: { value: 1 } })
    )
  })

  it('rolls back a frozen payload through a mutable detached journal clone', () => {
    const transact = new DataTransact()
    const observed: unknown[] = []
    const subscription = subscribeToEvents((event) => {
      if (event.type === EventTypes.UPDATE_PROPERTY) {
        observed.push((event as AllEvent & { payload: unknown }).payload)
      }
    })
    const payload = Object.freeze({
      id: 'test.frozen-rollback-snapshot',
      before: 0,
      after: 1
    })
    observed.length = 0

    transact.start()
    transact.update({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: EventTypes.UPDATE_PROPERTY,
      payload: payload as unknown as UpdateTransactionEvent['payload']
    })

    expect(() => transact.end({ outcome: 'rollback' })).not.toThrow()
    expect(observed).toEqual([
      { id: 'test.frozen-rollback-snapshot', before: 1, after: 0 }
    ])

    subscription.unsubscribe()
  })

  it('compensates the mutation-time immediate snapshot after caller payload mutation', () => {
    const pushBatchToSharedChannel = vi.fn().mockReturnValue(true)
    const transact = new DataTransact({ pushBatchToSharedChannel })
    const rolledBack: unknown[] = []
    const subscription = subscribeToSynchronousEvent<TestCanonicalUpdateEvent>(
      EventTypes.UPDATE_PROPERTY,
      (event) => rolledBack.push(event.payload)
    )
    const payload = {
      id: 'test.immediate-shared-snapshot',
      before: { value: 0 },
      after: { value: 1 }
    }

    try {
      transact.start()
      transact.update({
        type: TransactionEventTypes.UPDATE_TRANSACTION,
        eventName: EventTypes.UPDATE_PROPERTY,
        payload: payload as unknown as UpdateTransactionEvent['payload'],
        options: {
          shared: SharedDataChannelNames.SCENE_TREE,
          sharedDelivery: 'immediate'
        }
      })
      payload.before.value = 40
      payload.after.value = 41
      transact.end({ outcome: 'rollback' })
    } finally {
      subscription.unsubscribe()
    }

    expect(pushBatchToSharedChannel.mock.calls).toEqual([
      [
        SharedDataChannelNames.SCENE_TREE,
        orderedBatchOf({ before: { value: 0 }, after: { value: 1 } })
      ],
      [
        SharedDataChannelNames.SCENE_TREE,
        orderedBatchOf({ before: { value: 1 }, after: { value: 0 } })
      ]
    ])
    expect(rolledBack).toEqual([
      expect.objectContaining({
        before: { value: 1 },
        after: { value: 0 }
      })
    ])
    expect(Object.prototype.hasOwnProperty.call(rolledBack[0], 'options')).toBe(
      false
    )
  })

  it('keeps the owned journal and delivered batch immutable against structural sink mutation', () => {
    const pushBatchToSharedChannel = vi.fn(
      (_name: string, changes: readonly unknown[]) => {
        const payload = changes[0] as {
          after: { value: number }
        }
        Reflect.set(payload.after, 'value', 99)
        return true
      }
    )
    const transact = new DataTransact({ pushBatchToSharedChannel })
    const rolledBack: unknown[] = []
    const subscription = subscribeToSynchronousEvent<TestCanonicalUpdateEvent>(
      EventTypes.UPDATE_PROPERTY,
      (event) => rolledBack.push(event.payload)
    )

    try {
      transact.start()
      transact.update({
        type: TransactionEventTypes.UPDATE_TRANSACTION,
        eventName: EventTypes.UPDATE_PROPERTY,
        payload: {
          id: 'structural-sink-mutation',
          before: { value: 0 },
          after: { value: 1 }
        } as unknown as UpdateTransactionEvent['payload'],
        options: {
          shared: SharedDataChannelNames.SCENE_TREE,
          sharedDelivery: 'immediate'
        }
      })
      transact.end({ outcome: 'rollback' })
    } finally {
      subscription.unsubscribe()
    }

    const deliveredBatch = pushBatchToSharedChannel.mock.calls[0]?.[1] as
      | readonly unknown[]
      | undefined
    expect(deliveredBatch).toHaveLength(1)
    expect(Object.isFrozen(deliveredBatch)).toBe(true)
    expect(
      (
        deliveredBatch?.[0] as {
          after: { value: number }
        }
      ).after.value
    ).toBe(1)
    expect(rolledBack).toEqual([
      expect.objectContaining({
        before: { value: 1 },
        after: { value: 0 }
      })
    ])
  })

  it.each(mutatingSharedSinkFixtures)(
    'keeps the owned journal and delivered batch immutable through a shared sink %s',
    (_name, createFixture) => {
      const { sink, received, restore } = createFixture()
      const transact = new DataTransact(sink)
      const rolledBack: unknown[] = []
      const subscription =
        subscribeToSynchronousEvent<TestCanonicalUpdateEvent>(
          EventTypes.UPDATE_PROPERTY,
          (event) => rolledBack.push(event.payload)
        )

      try {
        transact.start()
        transact.update({
          type: TransactionEventTypes.UPDATE_TRANSACTION,
          eventName: EventTypes.UPDATE_PROPERTY,
          payload: {
            id: 'untrusted-shared-sink-mutation',
            before: { value: 0 },
            after: { value: 1 }
          } as unknown as UpdateTransactionEvent['payload'],
          options: {
            shared: SharedDataChannelNames.SCENE_TREE,
            sharedDelivery: 'immediate'
          }
        })
        transact.end({ outcome: 'rollback' })
      } finally {
        subscription.unsubscribe()
        restore?.()
      }

      expect(received).not.toHaveLength(0)
      expect(Object.isFrozen(received[0])).toBe(true)
      expect(
        (
          received[0]?.[0] as {
            after: { value: number }
          }
        ).after.value
      ).toBe(1)
      expect(rolledBack).toEqual([
        expect.objectContaining({
          before: { value: 1 },
          after: { value: 0 }
        })
      ])
    }
  )

  it('does not compensate an immediate change that was not delivered', () => {
    const pushBatchToSharedChannel = vi.fn().mockReturnValue(false)
    const transact = new DataTransact({ pushBatchToSharedChannel })

    transact.start()
    transact.update(
      createUpdateEvent({
        shared: 'unknown',
        sharedDelivery: 'immediate'
      })
    )
    transact.end({ outcome: 'rollback' })

    expect(pushBatchToSharedChannel).toHaveBeenCalledTimes(1)
  })

  it('retains the canonical journal when immediate shared delivery fails before append', () => {
    const deliveryFailure = new Error('shared append failed')
    const pushBatchToSharedChannel = vi.fn(() => {
      throw deliveryFailure
    })
    const transact = new DataTransact({ pushBatchToSharedChannel })
    const observed: unknown[] = []
    const subscription = subscribeToSynchronousEvent<TestCanonicalUpdateEvent>(
      EventTypes.UPDATE_PROPERTY,
      (event) => observed.push(event.payload)
    )

    transact.start()
    expect(() =>
      transact.update(
        createUpdateEvent({
          shared: 'sceneTree',
          sharedDelivery: 'immediate'
        })
      )
    ).toThrow(deliveryFailure)
    expect(() => transact.end({ outcome: 'rollback' })).not.toThrow()

    expect(observed).toEqual([expect.objectContaining({ before: 1, after: 0 })])
    expect(pushBatchToSharedChannel).toHaveBeenCalledTimes(1)

    subscription.unsubscribe()
  })

  it('marks an immediate delivery failure rollback-only even when the caller catches it', () => {
    const deliveryFailure = new Error('caught immediate append failed')
    const statuses: TransactionStatusPayload[] = []
    const transact = new DataTransact(
      {
        pushBatchToSharedChannel: () => {
          throw deliveryFailure
        }
      },
      {
        onStatus: (status) => statuses.push(status),
        onReplayEvent: () => true
      }
    )

    transact.start()
    expect(() =>
      transact.update(
        createUpdateEvent({
          shared: 'sceneTree',
          sharedDelivery: 'immediate'
        })
      )
    ).toThrow(deliveryFailure)

    expect(() => transact.end()).not.toThrow()
    expect(statuses.at(-1)).toMatchObject({
      status: 'rolled-back',
      failure: { kind: 'explicit', cause: deliveryFailure }
    })
    expect((transact as unknown as { undoStack: unknown[] }).undoStack).toEqual(
      []
    )
  })

  it('rejects an unaccepted batch without removing earlier outer journal entries', () => {
    const statuses: TransactionStatusPayload[] = []
    const replayed: AllEvent[] = []
    const transact = new DataTransact(undefined, {
      onStatus: (status) => statuses.push(status),
      onReplayEvent: (event) => {
        replayed.push(event)
        return true
      }
    })

    transact.start()
    transact.update({
      ...createUpdateEvent(),
      payload: {
        id: 'outer.accepted-before-batch',
        before: 0,
        after: 1
      } as unknown as UpdateTransactionEvent['payload']
    })
    let batchFailure: unknown
    try {
      transact.updateBatch([
        {
          ...createUpdateEvent(),
          payload: {
            id: 'batch.valid-prefix',
            before: 10,
            after: 20
          } as unknown as UpdateTransactionEvent['payload']
        },
        {
          type: TransactionEventTypes.UPDATE_TRANSACTION,
          eventName: 'missing.batch.inverter',
          payload: { id: 'invalid-later-item' }
        }
      ])
    } catch (error) {
      batchFailure = error
    }

    expect(batchFailure).toMatchObject({
      batchAccepted: false,
      message:
        'Reversible transaction event missing.batch.inverter requires an inverter'
    })
    expect(
      (
        transact as unknown as {
          journal: readonly { event: AllEvent & { payload: { id?: string } } }[]
        }
      ).journal.map(({ event }) => event.payload.id)
    ).toEqual(['outer.accepted-before-batch'])

    expect(() => transact.end()).not.toThrow()
    expect(replayed).toEqual([
      expect.objectContaining({
        type: EventTypes.UPDATE_PROPERTY,
        payload: expect.objectContaining({ before: 1, after: 0 })
      })
    ])
    expect(statuses.at(-1)).toMatchObject({ status: 'rolled-back' })
    expect((transact as unknown as { undoStack: unknown[] }).undoStack).toEqual(
      []
    )
  })

  it.each([
    [
      EventTypes.UPDATE_COMPUTED_DATA,
      {
        id: 'computed.full',
        before: { x: 0 },
        after: { x: 1 }
      }
    ],
    [
      EventTypes.UPDATE_COMPUTED_DATA_PATCH,
      {
        id: 'computed.patch',
        patch: {
          values: {
            x: {
              before: 0,
              after: 1
            }
          }
        }
      }
    ]
  ])(
    'rejects local-only %s before recording or delivering a valid canonical prefix',
    (eventName, payload) => {
      const pushBatchToSharedChannel = vi.fn(() => true)
      const transact = new DataTransact({ pushBatchToSharedChannel })
      const nonCanonicalOptions = {
        undoable: false,
        rollbackable: false,
        shared: SharedDataChannelNames.SCENE_TREE,
        sharedDelivery: 'immediate' as const
      }

      transact.start()
      let batchFailure: unknown
      try {
        transact.updateBatch([
          {
            type: TransactionEventTypes.UPDATE_TRANSACTION,
            eventName: EventTypes.UPDATE_PROPERTY,
            payload: {
              id: 'canonical.valid-prefix',
              key: 'x',
              before: 0,
              after: 1
            },
            options: nonCanonicalOptions
          },
          {
            type: TransactionEventTypes.UPDATE_TRANSACTION,
            eventName,
            payload: payload as UpdateTransactionEvent['payload'],
            options: nonCanonicalOptions
          }
        ])
      } catch (error) {
        batchFailure = error
      }

      expect(batchFailure).toMatchObject({
        batchAccepted: false,
        message: `Factory canonical mutation batch cannot contain local-only computed event: ${eventName}`
      })
      expect(
        (transact as unknown as { journal: readonly unknown[] }).journal
      ).toEqual([])
      expect(pushBatchToSharedChannel).not.toHaveBeenCalled()

      expect(() => transact.end()).not.toThrow()
      expect(
        (transact as unknown as { undoStack: readonly unknown[] }).undoStack
      ).toEqual([])
    }
  )

  it('marks a fully accepted immediate batch failure and retains every entry for outer rollback', () => {
    const deliveryFailure = new Error('immediate batch append failed')
    const pushBatchToSharedChannel = vi.fn(() => {
      throw deliveryFailure
    })
    const replayed: AllEvent[] = []
    const transact = new DataTransact(
      { pushBatchToSharedChannel },
      {
        onReplayEvent: (event) => {
          replayed.push(event)
          return true
        }
      }
    )
    const createImmediateEvent = (
      id: string,
      before: number,
      after: number
    ) => ({
      ...createUpdateEvent({
        shared: 'sceneTree',
        sharedDelivery: 'immediate' as const
      }),
      payload: {
        id,
        before,
        after
      } as unknown as UpdateTransactionEvent['payload']
    })

    transact.start()
    let batchFailure: unknown
    try {
      transact.updateBatch([
        createImmediateEvent('batch.first', 0, 1),
        createImmediateEvent('batch.second', 10, 20)
      ])
    } catch (error) {
      batchFailure = error
    }

    expect(batchFailure).toMatchObject({
      batchAccepted: true,
      message: deliveryFailure.message
    })
    expect(
      (
        transact as unknown as {
          journal: readonly { event: AllEvent & { payload: { id?: string } } }[]
        }
      ).journal.map(({ event }) => event.payload.id)
    ).toEqual(['batch.first', 'batch.second'])

    expect(() => transact.end()).not.toThrow()
    expect(
      replayed.map(
        (event) => (event as AllEvent & { payload: { id?: string } }).payload.id
      )
    ).toEqual(['batch.second', 'batch.first'])
    expect(pushBatchToSharedChannel).toHaveBeenCalledTimes(1)
    expect(pushBatchToSharedChannel).toHaveBeenCalledWith(
      'sceneTree',
      orderedBatchOf(
        { id: 'batch.first', before: 0, after: 1 },
        { id: 'batch.second', before: 10, after: 20 }
      )
    )
    expect((transact as unknown as { undoStack: unknown[] }).undoStack).toEqual(
      []
    )
  })

  it('rolls back a commit and compensates earlier transaction-end delivery when a later append fails', () => {
    const deliveryFailure = new Error('transaction-end append failed')
    const undoStackLengths: number[] = []
    const harness: { transact?: DataTransact } = {}
    const pushBatchToSharedChannel = vi
      .fn()
      .mockImplementationOnce(() => {
        undoStackLengths.push(
          (
            harness.transact as unknown as {
              undoStack: unknown[]
            }
          ).undoStack.length
        )
        return true
      })
      .mockImplementationOnce(() => {
        throw deliveryFailure
      })
      .mockReturnValueOnce(true)
    const statuses: TransactionStatusPayload[] = []
    const completion = vi.fn()
    const transact = new DataTransact(
      { pushBatchToSharedChannel },
      {
        onStatus: (status) => statuses.push(status),
        onUserActionCompleted: completion
      }
    )
    harness.transact = transact
    const observed: unknown[] = []
    const subscription = subscribeToSynchronousEvent<TestCanonicalUpdateEvent>(
      EventTypes.UPDATE_PROPERTY,
      (event) => observed.push(event.payload)
    )

    transact.start()
    transact.update(createUpdateEvent({ shared: 'sceneTree' }))
    transact.update({
      ...createUpdateEvent({ shared: 'props' }),
      payload: {
        id: 'test.second-change',
        before: 10,
        after: 20
      } as unknown as UpdateTransactionEvent['payload']
    })

    expect(() => transact.end()).toThrow(deliveryFailure)

    expect(observed).toEqual([
      expect.objectContaining({ before: 20, after: 10 }),
      expect.objectContaining({ before: 1, after: 0 })
    ])
    expect(pushBatchToSharedChannel.mock.calls).toEqual([
      ['sceneTree', orderedBatchOf({ before: 0, after: 1 })],
      ['props', orderedBatchOf({ before: 10, after: 20 })],
      ['sceneTree', orderedBatchOf({ before: 1, after: 0 })]
    ])
    expect(completion).not.toHaveBeenCalled()
    expect(undoStackLengths).toEqual([1])
    expect(
      (transact as unknown as { undoStack: unknown[] }).undoStack
    ).toHaveLength(0)
    expect(
      (transact as unknown as { redoStack: unknown[] }).redoStack
    ).toHaveLength(0)
    expect(statuses[statuses.length - 1]).toMatchObject({
      status: 'rolled-back',
      origin: 'action',
      failure: { kind: 'explicit', cause: deliveryFailure }
    })

    subscription.unsubscribe()
  })

  it('delivers adjacent same-channel transaction-end changes in one ordered batch', () => {
    const pushBatchToSharedChannel = vi.fn().mockReturnValue(true)
    const transact = new DataTransact({ pushBatchToSharedChannel })

    transact.start()
    transact.update(createUpdateEvent({ shared: 'sceneTree' }))
    transact.update({
      ...createUpdateEvent({ shared: 'sceneTree' }),
      payload: {
        id: 'test.second-change',
        before: 10,
        after: 20
      } as unknown as UpdateTransactionEvent['payload']
    })

    expect(() => transact.end()).not.toThrow()
    expect(pushBatchToSharedChannel).toHaveBeenCalledTimes(1)
    expect(pushBatchToSharedChannel).toHaveBeenCalledWith(
      'sceneTree',
      orderedBatchOf(
        { id: 'test.change', before: 0, after: 1 },
        { id: 'test.second-change', before: 10, after: 20 }
      )
    )
    expect(
      (transact as unknown as { undoStack: unknown[] }).undoStack
    ).toHaveLength(1)
  })

  it('rolls back every accepted same-channel entry when its single batch append fails', () => {
    const deliveryFailure = new Error('same-channel batch append failed')
    const pushBatchToSharedChannel = vi.fn(() => {
      throw deliveryFailure
    })
    const replayed: AllEvent[] = []
    const transact = new DataTransact(
      { pushBatchToSharedChannel },
      {
        onReplayEvent: (event) => {
          replayed.push(event)
          return true
        }
      }
    )

    transact.start()
    transact.update(createUpdateEvent({ shared: 'sceneTree' }))
    transact.update({
      ...createUpdateEvent({ shared: 'sceneTree' }),
      payload: {
        id: 'test.second-change',
        before: 10,
        after: 20
      } as unknown as UpdateTransactionEvent['payload']
    })

    expect(() => transact.end()).toThrow(deliveryFailure)
    expect(pushBatchToSharedChannel).toHaveBeenCalledTimes(1)
    expect(pushBatchToSharedChannel).toHaveBeenCalledWith(
      'sceneTree',
      orderedBatchOf(
        { id: 'test.change', before: 0, after: 1 },
        { id: 'test.second-change', before: 10, after: 20 }
      )
    )
    expect(
      replayed.map(
        (event) => (event as AllEvent & { payload: { id?: string } }).payload.id
      )
    ).toEqual(['test.second-change', 'test.change'])
    expect(
      (transact as unknown as { undoStack: unknown[] }).undoStack
    ).toHaveLength(0)
  })

  it('restores runtime and preserves undo history when transaction-end delivery fails during undo', () => {
    const deliveryFailure = new Error('undo append failed')
    const pushBatchToSharedChannel = vi.fn(() => {
      throw deliveryFailure
    })
    const statuses: TransactionStatusPayload[] = []
    const transact = new DataTransact(
      { pushBatchToSharedChannel },
      { onStatus: (status) => statuses.push(status) }
    )
    let value = 1
    const subscription = subscribeToSynchronousEvent<TestCanonicalUpdateEvent>(
      EventTypes.UPDATE_PROPERTY,
      (event) => {
        value = event.payload.after as number
        if (transact.isInUndo() || transact.isInRedo()) {
          transact.update({
            type: TransactionEventTypes.UPDATE_TRANSACTION,
            eventName: EventTypes.UPDATE_PROPERTY,
            payload: event.payload,
            options: { shared: SharedDataChannelNames.SCENE_TREE }
          })
        }
      }
    )

    transact.start()
    transact.update(createUpdateEvent())
    transact.end()
    statuses.length = 0

    expect(() => runWithOwnedTransact(transact, () => transact.undo())).toThrow(
      deliveryFailure
    )

    expect(value).toBe(1)
    expect(
      (transact as unknown as { undoStack: unknown[] }).undoStack
    ).toHaveLength(1)
    expect(
      (transact as unknown as { redoStack: unknown[] }).redoStack
    ).toHaveLength(0)
    expect(statuses[statuses.length - 1]).toMatchObject({
      status: 'rolled-back',
      origin: 'undo',
      failure: { kind: 'explicit', cause: deliveryFailure }
    })

    subscription.unsubscribe()
  })

  it('restores runtime and preserves redo history when transaction-end delivery fails during redo', () => {
    const deliveryFailure = new Error('redo append failed')
    const pushBatchToSharedChannel = vi.fn().mockReturnValueOnce(true)
    const statuses: TransactionStatusPayload[] = []
    const transact = new DataTransact(
      { pushBatchToSharedChannel },
      { onStatus: (status) => statuses.push(status) }
    )
    let value = 1
    const subscription = subscribeToSynchronousEvent<TestCanonicalUpdateEvent>(
      EventTypes.UPDATE_PROPERTY,
      (event) => {
        value = event.payload.after as number
        if (transact.isInUndo() || transact.isInRedo()) {
          transact.update({
            type: TransactionEventTypes.UPDATE_TRANSACTION,
            eventName: EventTypes.UPDATE_PROPERTY,
            payload: event.payload,
            options: { shared: SharedDataChannelNames.SCENE_TREE }
          })
        }
      }
    )

    transact.start()
    transact.update(createUpdateEvent())
    transact.end()
    runWithOwnedTransact(transact, () => transact.undo())
    expect(value).toBe(0)
    pushBatchToSharedChannel.mockImplementation(() => {
      throw deliveryFailure
    })
    statuses.length = 0

    expect(() => runWithOwnedTransact(transact, () => transact.redo())).toThrow(
      deliveryFailure
    )

    expect(value).toBe(0)
    expect(
      (transact as unknown as { undoStack: unknown[] }).undoStack
    ).toHaveLength(0)
    expect(
      (transact as unknown as { redoStack: unknown[] }).redoStack
    ).toHaveLength(1)
    expect(statuses[statuses.length - 1]).toMatchObject({
      status: 'rolled-back',
      origin: 'redo',
      failure: { kind: 'explicit', cause: deliveryFailure }
    })

    subscription.unsubscribe()
  })

  it('runs synchronous transaction validators in registration order', () => {
    const transact = new DataTransact()
    const order: string[] = []

    transact.registerValidator('scene-tree', (context): undefined => {
      order.push(`scene-tree:${context.changeCount}`)
    })
    transact.registerValidator('selection', () => {
      order.push('selection')
      return { valid: true }
    })

    expect(() =>
      transact.registerValidator('scene-tree', () => undefined)
    ).toThrow(/already registered/i)

    transact.start()
    transact.update(createUpdateEvent())
    transact.end()

    expect(order).toEqual(['scene-tree:1', 'selection'])
  })

  it('rolls back a failed validation before history, shared delivery, or completion', () => {
    const pushBatchToSharedChannel = vi.fn().mockReturnValue(true)
    const transact = new DataTransact({ pushBatchToSharedChannel })
    const observed: ObservedPayloadEvent[] = []
    const eventSubscription = subscribeToEvents((event) => {
      if (event.type === EventTypes.UPDATE_PROPERTY) {
        observed.push(event as unknown as ObservedPayloadEvent)
      }
    })
    const completionSubscriber = vi.fn()
    const completionSubscription =
      subscribeToUserActionCompleted(completionSubscriber)
    observed.length = 0
    completionSubscriber.mockClear()
    transact.registerValidator('cross-store', () => ({
      valid: false,
      code: 'dangling-selection',
      message: 'Selection references a missing element'
    }))

    transact.start()
    transact.update(createUpdateEvent({ shared: 'sceneTree' }))

    expect(() => transact.end()).toThrow(TransactionValidationError)
    expect(observed).toHaveLength(1)
    expect(pushBatchToSharedChannel).not.toHaveBeenCalled()
    expect(completionSubscriber).not.toHaveBeenCalled()
    expect(
      (transact as unknown as { undoStack: unknown[] }).undoStack
    ).toHaveLength(0)

    eventSubscription.unsubscribe()
    completionSubscription.unsubscribe()
  })

  it('rejects asynchronous validators and rolls back the requested commit', () => {
    const transact = new DataTransact()
    const observed: ObservedPayloadEvent[] = []
    const subscription = subscribeToEvents((event) => {
      if (event.type === EventTypes.UPDATE_PROPERTY) {
        observed.push(event as unknown as ObservedPayloadEvent)
      }
    })
    observed.length = 0
    transact.registerValidator('async-validator', (() =>
      Promise.resolve({ valid: true })) as never)

    transact.start()
    transact.update(createUpdateEvent())

    expect(() => transact.end()).toThrow(/must be synchronous/i)
    expect(observed).toHaveLength(1)

    subscription.unsubscribe()
  })

  it('observes a rejected asynchronous validator result', async () => {
    const transact = new DataTransact()
    const validatorFailure = new Error('async validation failed')
    const unhandledRejections: unknown[] = []
    const onUnhandledRejection = (reason: unknown) => {
      unhandledRejections.push(reason)
    }
    process.on('unhandledRejection', onUnhandledRejection)
    transact.registerValidator('rejected-async-validator', (() =>
      Promise.reject(validatorFailure)) as never)

    try {
      transact.start()
      transact.update(createUpdateEvent())

      expect(() => transact.end()).toThrow(/must be synchronous/i)
      await new Promise((resolve) => setTimeout(resolve, 0))
      expect(unhandledRejections).toEqual([])
    } finally {
      process.off('unhandledRejection', onUnhandledRejection)
    }
  })

  it('bypasses validators for an explicitly rolled-back transaction', () => {
    const transact = new DataTransact()
    const validator = vi.fn()
    transact.registerValidator('unused', validator)

    transact.start()
    transact.update(createUpdateEvent())
    transact.end({ outcome: 'rollback' })

    expect(validator).not.toHaveBeenCalled()
  })

  it('rolls back multiple changes in reverse order without creating history', () => {
    const transact = new DataTransact()
    const observed: ObservedPayloadEvent[] = []
    const eventSubscription = subscribeToEvents((event) => {
      if (event.type === EventTypes.UPDATE_PROPERTY) {
        observed.push(event as unknown as ObservedPayloadEvent)
      }
    })
    const completionSubscriber = vi.fn()
    const completionSubscription =
      subscribeToUserActionCompleted(completionSubscriber)
    observed.length = 0
    completionSubscriber.mockClear()

    transact.start()
    transact.update({
      ...createUpdateEvent(),
      payload: { id: 'value', before: 0, after: 1 }
    })
    transact.update({
      ...createUpdateEvent(),
      payload: { id: 'value', before: 1, after: 2 }
    })
    transact.end({ outcome: 'rollback' })

    expect(observed.map((event) => event.payload)).toEqual([
      { id: 'value', before: 2, after: 1 },
      { id: 'value', before: 1, after: 0 }
    ])
    expect(completionSubscriber).not.toHaveBeenCalled()
    expect(
      (transact as unknown as { undoStack: unknown[] }).undoStack
    ).toHaveLength(0)
    expect(
      (transact as unknown as { redoStack: unknown[] }).redoStack
    ).toHaveLength(0)

    eventSubscription.unsubscribe()
    completionSubscription.unsubscribe()
  })

  it('keeps one batch event and reverses its change order during rollback', () => {
    const transact = new DataTransact()
    const observed: unknown[] = []
    const subscription = subscribeToEvents((event) => {
      if (event.type === EventTypes.UPDATE_ELEMENT_DATA) {
        observed.push((event as AllEvent & { payload: unknown }).payload)
      }
    })
    observed.length = 0

    transact.start()
    transact.update({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: EventTypes.UPDATE_ELEMENT_DATA,
      payload: {
        action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_DATA,
        eventName: EventTypes.UPDATE_ELEMENT_DATA,
        id: 'element-1',
        changes: [
          { key: 'x', before: 0, after: 10, owner: 'raw' },
          { key: 'y', before: 5, after: 20, owner: 'scene-tree' }
        ]
      }
    })
    transact.end({ outcome: 'rollback' })

    expect(observed).toEqual([
      {
        action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_DATA,
        eventName: EventTypes.UPDATE_ELEMENT_DATA,
        id: 'element-1',
        changes: [
          {
            key: 'y',
            before: 20,
            after: 5,
            owner: 'scene-tree'
          },
          { key: 'x', before: 10, after: 0, owner: 'raw' }
        ]
      }
    ])

    subscription.unsubscribe()
  })

  it('preserves batch metadata for rollback and immediate shared compensation', () => {
    const pushBatchToSharedChannel = vi.fn().mockReturnValue(true)
    const transact = new DataTransact({ pushBatchToSharedChannel })
    const observed: unknown[] = []
    const subscription = subscribeToEvents((event) => {
      if (event.type === EventTypes.UPDATE_ELEMENT_DATA) {
        observed.push((event as AllEvent & { payload: unknown }).payload)
      }
    })
    observed.length = 0

    transact.start()
    transact.update({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: EventTypes.UPDATE_ELEMENT_DATA,
      payload: {
        action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_DATA,
        eventName: EventTypes.UPDATE_ELEMENT_DATA,
        id: 'element-1',
        changes: [
          { key: 'x', before: 0, after: 10, owner: 'raw' },
          { key: 'y', before: 5, after: 20, owner: 'scene-tree' }
        ]
      },
      options: {
        undoable: false,
        shared: SharedDataChannelNames.SCENE_TREE,
        sharedDelivery: 'immediate'
      }
    })
    transact.end({ outcome: 'rollback' })

    expect(observed).toEqual([
      expect.objectContaining({
        action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_DATA,
        eventName: EventTypes.UPDATE_ELEMENT_DATA,
        changes: [
          { key: 'y', before: 20, after: 5, owner: 'scene-tree' },
          { key: 'x', before: 10, after: 0, owner: 'raw' }
        ]
      })
    ])
    expect(pushBatchToSharedChannel.mock.calls).toEqual([
      [
        SharedDataChannelNames.SCENE_TREE,
        orderedBatchOf({
          action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_DATA,
          eventName: EventTypes.UPDATE_ELEMENT_DATA
        })
      ],
      [
        SharedDataChannelNames.SCENE_TREE,
        orderedBatchOf({
          action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_DATA,
          eventName: EventTypes.UPDATE_ELEMENT_DATA,
          changes: [
            { key: 'y', before: 20, after: 5, owner: 'scene-tree' },
            { key: 'x', before: 10, after: 0, owner: 'raw' }
          ]
        })
      ]
    ])

    subscription.unsubscribe()
  })

  it('uses the same batch replay contract for undo and redo', () => {
    const transact = new DataTransact()
    const observed: unknown[] = []
    const subscription = subscribeToEvents((event) => {
      if (event.type === EventTypes.UPDATE_ELEMENT_DATA) {
        observed.push((event as AllEvent & { payload: unknown }).payload)
      }
    })
    observed.length = 0

    transact.start()
    transact.update({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: EventTypes.UPDATE_ELEMENT_DATA,
      payload: {
        action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_DATA,
        eventName: EventTypes.UPDATE_ELEMENT_DATA,
        id: 'element-1',
        changes: [
          { key: 'x', before: 0, after: 10, owner: 'raw' },
          { key: 'y', before: 5, after: 20, owner: 'scene-tree' }
        ]
      }
    })
    transact.end()
    observed.length = 0

    runWithOwnedTransact(transact, () => transact.undo())
    runWithOwnedTransact(transact, () => transact.redo())

    expect(observed).toEqual([
      {
        action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_DATA,
        eventName: EventTypes.UPDATE_ELEMENT_DATA,
        id: 'element-1',
        changes: [
          { key: 'y', before: 20, after: 5, owner: 'scene-tree' },
          { key: 'x', before: 10, after: 0, owner: 'raw' }
        ]
      },
      {
        action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_DATA,
        eventName: EventTypes.UPDATE_ELEMENT_DATA,
        id: 'element-1',
        changes: [
          { key: 'x', before: 0, after: 10, owner: 'raw' },
          { key: 'y', before: 5, after: 20, owner: 'scene-tree' }
        ]
      }
    ])

    subscription.unsubscribe()
  })

  it('keeps UPDATE_ELEMENT_DATA canonical through Undo and Redo', () => {
    const transact = new DataTransact()
    const observed: unknown[] = []
    const subscription = subscribeToSynchronousEvent<{
      type: EventTypes
      payload: unknown
    }>(EventTypes.UPDATE_ELEMENT_DATA, (event) => {
      observed.push(event.payload)
      acknowledgeTransactionReplayApplied()
      return true
    })
    observed.length = 0

    transact.start()
    transact.update({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: EventTypes.UPDATE_ELEMENT_DATA,
      payload: {
        action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_DATA,
        eventName: EventTypes.UPDATE_ELEMENT_DATA,
        id: 'element-raw',
        changes: [
          {
            key: 'name',
            before: 'Before',
            after: 'After'
          },
          {
            key: 'visible',
            before: true,
            after: false
          }
        ]
      }
    })
    transact.end()
    observed.length = 0

    runWithOwnedTransact(transact, () => transact.undo())
    runWithOwnedTransact(transact, () => transact.redo())

    expect(observed).toEqual([
      {
        action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_DATA,
        eventName: EventTypes.UPDATE_ELEMENT_DATA,
        id: 'element-raw',
        changes: [
          {
            key: 'visible',
            before: false,
            after: true
          },
          {
            key: 'name',
            before: 'After',
            after: 'Before'
          }
        ]
      },
      {
        action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_DATA,
        eventName: EventTypes.UPDATE_ELEMENT_DATA,
        id: 'element-raw',
        changes: [
          {
            key: 'name',
            before: 'Before',
            after: 'After'
          },
          {
            key: 'visible',
            before: true,
            after: false
          }
        ]
      }
    ])

    subscription.unsubscribe()
  })

  it('keeps one ordered element batch through Undo and Redo', () => {
    const transact = new DataTransact()
    const observed: { type: string; payload: unknown }[] = []
    const addSubscription = subscribeToSynchronousEvent<{
      type: EventTypes
      payload: unknown
    }>(EventTypes.ADD_ELEMENTS, (event) => {
      observed.push({ type: event.type, payload: event.payload })
      acknowledgeTransactionReplayApplied()
      return true
    })
    const removeSubscription = subscribeToSynchronousEvent<{
      type: EventTypes
      payload: unknown
    }>(EventTypes.REMOVE_ELEMENTS, (event) => {
      observed.push({ type: event.type, payload: event.payload })
      acknowledgeTransactionReplayApplied()
      return true
    })
    const entries = [
      {
        data: {
          id: 'element-batch-1',
          type: 'vector',
          name: 'Vector 1',
          parentId: 'group-1',
          visible: true,
          lock: false,
          props: {}
        },
        parentId: 'group-1',
        index: 0
      },
      {
        data: {
          id: 'element-batch-2',
          type: 'vector',
          name: 'Vector 2',
          parentId: 'group-1',
          visible: true,
          lock: false,
          props: {}
        },
        parentId: 'group-1',
        index: 1
      }
    ]

    transact.start()
    transact.update({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: EventTypes.ADD_ELEMENTS,
      payload: {
        action: SCENE_TREE_ACTIONS.ADD_ELEMENTS,
        eventName: EventTypes.ADD_ELEMENTS,
        undoType: EventTypes.REMOVE_ELEMENTS,
        undoAction: SCENE_TREE_ACTIONS.REMOVE_ELEMENTS,
        entries
      }
    })
    transact.end()
    observed.length = 0

    runWithOwnedTransact(transact, () => transact.undo())
    runWithOwnedTransact(transact, () => transact.redo())

    expect(observed).toEqual([
      {
        type: EventTypes.REMOVE_ELEMENTS,
        payload: {
          action: SCENE_TREE_ACTIONS.REMOVE_ELEMENTS,
          eventName: EventTypes.REMOVE_ELEMENTS,
          undoType: EventTypes.ADD_ELEMENTS,
          undoAction: SCENE_TREE_ACTIONS.ADD_ELEMENTS,
          entries
        }
      },
      {
        type: EventTypes.ADD_ELEMENTS,
        payload: {
          action: SCENE_TREE_ACTIONS.ADD_ELEMENTS,
          eventName: EventTypes.ADD_ELEMENTS,
          undoType: EventTypes.REMOVE_ELEMENTS,
          undoAction: SCENE_TREE_ACTIONS.REMOVE_ELEMENTS,
          entries
        }
      }
    ])

    addSubscription.unsubscribe()
    removeSubscription.unsubscribe()
  })

  it('retains undo and redo replay journals until an existing outer boundary closes', () => {
    const statuses: TransactionStatusPayload[] = []
    const pushBatchToSharedChannel = vi.fn().mockReturnValue(true)
    const transact = new DataTransact(
      { pushBatchToSharedChannel },
      { onStatus: (status) => statuses.push(status) }
    )
    const subscription = subscribeToEvents((event) => {
      if (
        event.type !== EventTypes.UPDATE_PROPERTY ||
        (!transact.isInUndo() && !transact.isInRedo())
      ) {
        return
      }
      transact.update({
        type: TransactionEventTypes.UPDATE_TRANSACTION,
        eventName: EventTypes.UPDATE_PROPERTY,
        payload: (event as AllEvent & { payload: unknown }).payload,
        options: { shared: SharedDataChannelNames.SCENE_TREE }
      })
    })

    transact.start()
    transact.update(createUpdateEvent())
    transact.end()
    pushBatchToSharedChannel.mockClear()
    statuses.length = 0

    transact.start()
    transact.undo()
    expect(
      (transact as unknown as { journal: unknown[] }).journal
    ).toHaveLength(1)
    expect(pushBatchToSharedChannel).not.toHaveBeenCalled()
    transact.end()

    expect(pushBatchToSharedChannel).toHaveBeenLastCalledWith(
      SharedDataChannelNames.SCENE_TREE,
      orderedBatchOf({ before: 1, after: 0 })
    )
    expect(statuses[statuses.length - 1]).toMatchObject({
      status: 'committed',
      origin: 'undo'
    })

    pushBatchToSharedChannel.mockClear()
    statuses.length = 0
    transact.start()
    transact.redo()
    expect(
      (transact as unknown as { journal: unknown[] }).journal
    ).toHaveLength(1)
    transact.end()

    expect(pushBatchToSharedChannel).toHaveBeenLastCalledWith(
      SharedDataChannelNames.SCENE_TREE,
      orderedBatchOf({ before: 0, after: 1 })
    )
    expect(statuses[statuses.length - 1]).toMatchObject({
      status: 'committed',
      origin: 'redo'
    })

    subscription.unsubscribe()
  })

  it('keeps nested undo history available when the outer boundary rolls back', () => {
    const transact = new DataTransact()
    let value = 1
    const subscription = subscribeToSynchronousEvent<TestCanonicalUpdateEvent>(
      EventTypes.UPDATE_PROPERTY,
      (event) => {
        value = event.payload.after as number
        if (transact.isInUndo() || transact.isInRedo()) {
          transact.update({
            type: TransactionEventTypes.UPDATE_TRANSACTION,
            eventName: EventTypes.UPDATE_PROPERTY,
            payload: event.payload
          })
        }
      }
    )

    transact.start()
    transact.update(createUpdateEvent())
    transact.end()

    transact.start()
    transact.undo()
    expect(value).toBe(0)
    transact.end({ outcome: 'rollback' })
    expect(value).toBe(1)

    transact.start()
    transact.undo()
    transact.end()
    expect(value).toBe(0)

    subscription.unsubscribe()
  })

  it('restores nested undo runtime on outer rollback without a replay journal', () => {
    const transact = new DataTransact()
    let value = 1
    const subscription = subscribeToSynchronousEvent<TestCanonicalUpdateEvent>(
      EventTypes.UPDATE_PROPERTY,
      (event) => {
        value = event.payload.after as number
      }
    )

    transact.start()
    transact.update(createUpdateEvent())
    transact.end()

    transact.start()
    transact.undo()
    expect(value).toBe(0)
    expect(
      (transact as unknown as { journal: unknown[] }).journal
    ).toHaveLength(0)
    transact.end({ outcome: 'rollback' })

    expect(value).toBe(1)
    transact.start()
    transact.undo()
    transact.end()
    expect(value).toBe(0)

    subscription.unsubscribe()
  })

  it('does not restore a successful no-op nested undo on outer rollback', () => {
    const transact = new DataTransact()
    let value = 1
    const subscription = subscribeToSynchronousEvent<TestCanonicalUpdateEvent>(
      EventTypes.UPDATE_PROPERTY,
      (event) => {
        const nextValue = event.payload.after as number
        if (Object.is(value, nextValue)) {
          return false
        }
        value = nextValue
        return true
      }
    )

    transact.start()
    transact.update(createUpdateEvent())
    transact.end()

    value = 0
    transact.start()
    transact.update(createUpdateEvent({ undoable: false, rollbackable: false }))
    transact.end()

    transact.start()
    transact.undo()
    expect(value).toBe(0)
    transact.end({ outcome: 'rollback' })

    expect(value).toBe(0)

    subscription.unsubscribe()
  })

  it('rolls back a new action mutation attempted after a nested undo', () => {
    const transact = new DataTransact()
    const values: Record<string, number> = {
      committed: 1,
      later: 0
    }
    const createNamedUpdate = (
      id: string,
      before: number,
      after: number
    ): UpdateTransactionEvent => ({
      ...createUpdateEvent(),
      payload: { id, before, after }
    })
    const subscription = subscribeToSynchronousEvent<TestCanonicalUpdateEvent>(
      EventTypes.UPDATE_PROPERTY,
      (event) => {
        values[event.payload.id] = event.payload.after as number
        if (
          event.payload.id === 'committed' &&
          (transact.isInUndo() || transact.isInRedo())
        ) {
          transact.update({
            type: TransactionEventTypes.UPDATE_TRANSACTION,
            eventName: EventTypes.UPDATE_PROPERTY,
            payload: event.payload
          })
        }
      }
    )

    transact.start()
    transact.update(createNamedUpdate('committed', 0, 1))
    transact.end()

    transact.start()
    transact.undo()
    expect(values).toEqual({ committed: 0, later: 0 })

    values.later = 1
    expect(() => transact.update(createNamedUpdate('later', 0, 1))).toThrow(
      /nested (undo|redo).*new action mutation/i
    )
    transact.end()

    expect(values).toEqual({ committed: 1, later: 0 })
    transact.start()
    transact.undo()
    transact.end()
    expect(values.committed).toBe(0)

    subscription.unsubscribe()
  })

  it('restores every nested undo source when only part of replay is journaled', () => {
    const transact = new DataTransact()
    const values: Record<string, number> = {
      journaled: 1,
      direct: 1
    }
    const createNamedUpdate = (id: string): UpdateTransactionEvent => ({
      ...createUpdateEvent(),
      payload: { id, before: 0, after: 1 }
    })
    const subscription = subscribeToSynchronousEvent<TestCanonicalUpdateEvent>(
      EventTypes.UPDATE_PROPERTY,
      (event) => {
        values[event.payload.id] = event.payload.after as number
        if (
          event.payload.id === 'journaled' &&
          (transact.isInUndo() || transact.isInRedo())
        ) {
          transact.update({
            type: TransactionEventTypes.UPDATE_TRANSACTION,
            eventName: EventTypes.UPDATE_PROPERTY,
            payload: event.payload
          })
        }
      }
    )

    transact.start()
    transact.update(createNamedUpdate('journaled'))
    transact.update(createNamedUpdate('direct'))
    transact.end()

    transact.start()
    transact.undo()
    expect(values).toEqual({ journaled: 0, direct: 0 })
    expect(
      (transact as unknown as { journal: unknown[] }).journal
    ).toHaveLength(1)
    transact.end({ outcome: 'rollback' })

    expect(values).toEqual({ journaled: 1, direct: 1 })

    subscription.unsubscribe()
  })

  it('restores every applied nested replay when a later mixed source fails', () => {
    const transact = new DataTransact()
    const values: Record<string, number> = {
      failing: 1,
      direct: 1,
      journaled: 1
    }
    let failReplay = true
    const createNamedUpdate = (id: string): UpdateTransactionEvent => ({
      ...createUpdateEvent(),
      payload: { id, before: 0, after: 1 }
    })
    const subscription = subscribeToSynchronousEvent<TestCanonicalUpdateEvent>(
      EventTypes.UPDATE_PROPERTY,
      (event) => {
        if (
          event.payload.id === 'failing' &&
          transact.isInUndo() &&
          failReplay
        ) {
          failReplay = false
          throw new Error('nested replay failed')
        }

        values[event.payload.id] = event.payload.after as number
        if (
          event.payload.id === 'journaled' &&
          (transact.isInUndo() || transact.isInRedo())
        ) {
          transact.update({
            type: TransactionEventTypes.UPDATE_TRANSACTION,
            eventName: EventTypes.UPDATE_PROPERTY,
            payload: event.payload
          })
        }
      }
    )

    transact.start()
    transact.update(createNamedUpdate('failing'))
    transact.update(createNamedUpdate('direct'))
    transact.update(createNamedUpdate('journaled'))
    transact.end()

    transact.start()
    expect(() => transact.undo()).toThrow(TransactionRollbackError)
    expect(values).toEqual({ failing: 1, direct: 0, journaled: 0 })
    transact.end()

    expect(values).toEqual({ failing: 1, direct: 1, journaled: 1 })

    failReplay = false
    transact.start()
    transact.undo()
    transact.end()
    expect(values).toEqual({ failing: 0, direct: 0, journaled: 0 })

    subscription.unsubscribe()
  })

  it('restores every applied nested redo when a later mixed source fails', () => {
    const transact = new DataTransact()
    const values: Record<string, number> = {
      journaled: 1,
      direct: 1,
      failing: 1
    }
    let failReplay = false
    const createNamedUpdate = (id: string): UpdateTransactionEvent => ({
      ...createUpdateEvent(),
      payload: { id, before: 0, after: 1 }
    })
    const subscription = subscribeToSynchronousEvent<TestCanonicalUpdateEvent>(
      EventTypes.UPDATE_PROPERTY,
      (event) => {
        if (
          event.payload.id === 'failing' &&
          transact.isInRedo() &&
          failReplay
        ) {
          failReplay = false
          throw new Error('nested redo failed')
        }

        values[event.payload.id] = event.payload.after as number
        if (
          event.payload.id === 'journaled' &&
          (transact.isInUndo() || transact.isInRedo())
        ) {
          transact.update({
            type: TransactionEventTypes.UPDATE_TRANSACTION,
            eventName: EventTypes.UPDATE_PROPERTY,
            payload: event.payload
          })
        }
      }
    )

    transact.start()
    transact.update(createNamedUpdate('journaled'))
    transact.update(createNamedUpdate('direct'))
    transact.update(createNamedUpdate('failing'))
    transact.end()
    transact.start()
    transact.undo()
    transact.end()
    expect(values).toEqual({ journaled: 0, direct: 0, failing: 0 })

    failReplay = true
    transact.start()
    expect(() => transact.redo()).toThrow(TransactionRollbackError)
    expect(values).toEqual({ journaled: 1, direct: 1, failing: 0 })
    transact.end()

    expect(values).toEqual({ journaled: 0, direct: 0, failing: 0 })

    failReplay = false
    transact.start()
    transact.redo()
    transact.end()
    expect(values).toEqual({ journaled: 1, direct: 1, failing: 1 })

    subscription.unsubscribe()
  })

  it('restores nested add undo from its original source direction', () => {
    let elementExists = true
    const transact = new DataTransact(undefined, {
      onReplayEvent: (event) => {
        if (event.type === EventTypes.ADD_ELEMENT) {
          elementExists = true
          return true
        }
        if (event.type === EventTypes.REMOVE_ELEMENT) {
          elementExists = false
          return true
        }
        return false
      }
    })

    transact.start()
    transact.update({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: EventTypes.ADD_ELEMENT,
      payload: {
        action: EventTypes.ADD_ELEMENT,
        undoType: EventTypes.REMOVE_ELEMENT,
        undoAction: EventTypes.REMOVE_ELEMENT,
        data: { id: 'element-1' }
      }
    })
    transact.end()

    transact.start()
    transact.undo()
    expect(elementExists).toBe(false)
    transact.end({ outcome: 'rollback' })

    expect(elementExists).toBe(true)
  })

  it('restores a custom multi-event replay when an owner mutates and then throws', () => {
    const values: Record<string, number> = { first: 1, second: 1 }
    let throwAfterMutation = true
    const transact = new DataTransact(undefined, {
      onReplayEvent: (event) => {
        if (String(event.type) === 'custom.multi') {
          values.first = 1
          values.second = 1
          return true
        }
        if (event.type !== EventTypes.UPDATE_PROPERTY) {
          return false
        }

        const payload = (event as TestCanonicalUpdateEvent).payload
        values[payload.id] = payload.after as number
        acknowledgeTransactionReplayApplied()
        if (
          payload.id === 'second' &&
          transact.isInUndo() &&
          throwAfterMutation
        ) {
          throwAfterMutation = false
          throw new Error('owner failed after mutation')
        }
        return true
      }
    })
    transact.registerInverter('custom.multi', () => [
      {
        type: EventTypes.UPDATE_PROPERTY,
        payload: { id: 'first', key: 'value', before: 1, after: 0 }
      },
      {
        type: EventTypes.UPDATE_PROPERTY,
        payload: { id: 'second', key: 'value', before: 1, after: 0 }
      }
    ])

    transact.start()
    transact.update({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: 'custom.multi',
      payload: { id: 'custom-source' }
    })
    transact.end()

    transact.start()
    expect(() => transact.undo()).toThrow(TransactionRollbackError)
    expect(values).toEqual({ first: 0, second: 0 })
    transact.end()

    expect(values).toEqual({ first: 1, second: 1 })

    transact.start()
    transact.undo()
    transact.end()
    expect(values).toEqual({ first: 0, second: 0 })
  })

  it('rejects a custom replay output without its own inverse before apply', () => {
    let outputApplied = false
    const transact = new DataTransact(undefined, {
      onReplayEvent: (event) => {
        if (String(event.type) === 'custom.output') {
          outputApplied = true
          return true
        }
        return false
      }
    })
    transact.registerInverter('custom.source', () => ({
      type: 'custom.output' as AllEvent['type'],
      payload: { id: 'custom-output' }
    }))

    transact.start()
    transact.update({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: 'custom.source',
      payload: { id: 'custom-source' }
    })
    transact.end()

    transact.start()
    expect(() => transact.undo()).toThrow(TransactionRollbackError)
    expect(outputApplied).toBe(false)
    transact.end()
  })

  it('reports rollback-failed when a nested prepared replay restoration cannot apply', () => {
    const statuses: TransactionStatusPayload[] = []
    const transact = new DataTransact(undefined, {
      onStatus: (status) => statuses.push(status),
      onReplayEvent: (_event, mode) => {
        if (mode === 'undo') {
          acknowledgeTransactionReplayApplied()
          throw new Error('undo apply failed')
        }
        if (mode === 'rollback') {
          throw new Error('restoration apply failed')
        }
        return false
      }
    })

    transact.start()
    transact.update(createUpdateEvent())
    transact.end()

    transact.start()
    expect(() => transact.undo()).toThrow(TransactionRollbackError)
    expect(() => transact.end()).toThrow(TransactionRollbackError)
    expect(statuses[statuses.length - 1]).toMatchObject({
      status: 'rollback-failed',
      error: expect.any(TransactionRollbackError)
    })
  })

  it('does not restore a non-idempotent custom replay that failed before apply', () => {
    let value = 1
    let failBeforeApply = true
    const transact = new DataTransact(undefined, {
      onReplayEvent: (event) => {
        if (String(event.type) !== 'custom.delta') {
          return false
        }
        const delta = (event as AllEvent & { payload: { delta: number } })
          .payload.delta
        if (delta < 0 && failBeforeApply) {
          failBeforeApply = false
          throw new Error('delta failed before apply')
        }
        value += delta
        return true
      }
    })
    transact.registerInverter('custom.delta', (event) => ({
      ...event,
      payload: {
        delta: -(event as AllEvent & { payload: { delta: number } }).payload
          .delta
      }
    }))

    transact.start()
    transact.update({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: 'custom.delta',
      payload: { delta: 1 }
    })
    transact.end()

    transact.start()
    expect(() => transact.undo()).toThrow(TransactionRollbackError)
    expect(value).toBe(1)
    transact.end()

    expect(value).toBe(1)
  })

  it('restores an applied custom replay that throws a primitive value', () => {
    let value = 1
    const primitiveFailure: unknown = 'custom delta failed after apply'
    const transact = new DataTransact(undefined, {
      onReplayEvent: (event, mode) => {
        if (String(event.type) !== 'custom.delta') {
          return false
        }
        const delta = (event as AllEvent & { payload: { delta: number } })
          .payload.delta
        value += delta
        if (mode === 'undo') {
          acknowledgeTransactionReplayApplied()
          throw primitiveFailure
        }
        return true
      }
    })
    transact.registerInverter('custom.delta', (event) => ({
      ...event,
      payload: {
        delta: -(event as AllEvent & { payload: { delta: number } }).payload
          .delta
      }
    }))

    transact.start()
    transact.update({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: 'custom.delta',
      payload: { delta: 1 }
    })
    transact.end()

    transact.start()
    expect(() => transact.undo()).toThrow(TransactionRollbackError)
    expect(value).toBe(0)
    transact.end()

    expect(value).toBe(1)
  })

  it('keeps nested redo history available when the outer boundary rolls back', () => {
    const transact = new DataTransact()
    let value = 1
    const subscription = subscribeToSynchronousEvent<TestCanonicalUpdateEvent>(
      EventTypes.UPDATE_PROPERTY,
      (event) => {
        value = event.payload.after as number
        if (transact.isInUndo() || transact.isInRedo()) {
          transact.update({
            type: TransactionEventTypes.UPDATE_TRANSACTION,
            eventName: EventTypes.UPDATE_PROPERTY,
            payload: event.payload
          })
        }
      }
    )

    transact.start()
    transact.update(createUpdateEvent())
    transact.end()

    transact.start()
    transact.undo()
    transact.end()
    expect(value).toBe(0)

    transact.start()
    transact.redo()
    expect(value).toBe(1)
    transact.end({ outcome: 'rollback' })
    expect(value).toBe(0)

    transact.start()
    transact.redo()
    transact.end()
    expect(value).toBe(1)

    subscription.unsubscribe()
  })

  it('restores nested redo runtime on outer rollback without a replay journal', () => {
    const transact = new DataTransact()
    let value = 1
    const subscription = subscribeToSynchronousEvent<TestCanonicalUpdateEvent>(
      EventTypes.UPDATE_PROPERTY,
      (event) => {
        value = event.payload.after as number
      }
    )

    transact.start()
    transact.update(createUpdateEvent())
    transact.end()
    transact.start()
    transact.undo()
    transact.end()
    expect(value).toBe(0)

    transact.start()
    transact.redo()
    expect(value).toBe(1)
    expect(
      (transact as unknown as { journal: unknown[] }).journal
    ).toHaveLength(0)
    transact.end({ outcome: 'rollback' })

    expect(value).toBe(0)
    transact.start()
    transact.redo()
    transact.end()
    expect(value).toBe(1)

    subscription.unsubscribe()
  })

  it('does not restore a successful no-op nested redo on outer rollback', () => {
    const transact = new DataTransact()
    let value = 1
    const subscription = subscribeToSynchronousEvent<TestCanonicalUpdateEvent>(
      EventTypes.UPDATE_PROPERTY,
      (event) => {
        const nextValue = event.payload.after as number
        if (Object.is(value, nextValue)) {
          return false
        }
        value = nextValue
        return true
      }
    )

    transact.start()
    transact.update(createUpdateEvent())
    transact.end()
    transact.start()
    transact.undo()
    transact.end()
    expect(value).toBe(0)

    value = 1
    transact.start()
    transact.update(createUpdateEvent({ undoable: false, rollbackable: false }))
    transact.end()

    transact.start()
    transact.redo()
    expect(value).toBe(1)
    transact.end({ outcome: 'rollback' })

    expect(value).toBe(1)

    subscription.unsubscribe()
  })

  it('inverts add/remove action metadata during rollback', () => {
    const transact = new DataTransact()
    const observed: AllEvent[] = []
    const subscription = subscribeToEvents((event) => {
      if (event.type === EventTypes.REMOVE_ELEMENT) {
        observed.push(event)
      }
    })
    observed.length = 0

    transact.start()
    transact.update({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: EventTypes.ADD_ELEMENT,
      payload: {
        action: EventTypes.ADD_ELEMENT,
        undoType: EventTypes.REMOVE_ELEMENT,
        undoAction: EventTypes.REMOVE_ELEMENT,
        data: { id: 'element-1' }
      }
    })
    transact.end({ outcome: 'rollback' })

    expect(observed).toHaveLength(1)
    expect(observed[0]).toMatchObject({
      type: EventTypes.REMOVE_ELEMENT,
      payload: { action: EventTypes.REMOVE_ELEMENT }
    })

    subscription.unsubscribe()
  })

  it('rejects an invalid inverter result before history and rolls back an earlier entry', () => {
    const statuses: TransactionStatusPayload[] = []
    const transact = new DataTransact(undefined, {
      onStatus: (status) => statuses.push(status)
    })
    const observed: ObservedPayloadEvent[] = []
    const subscription = subscribeToEvents((event) => {
      if (event.type === EventTypes.UPDATE_PROPERTY) {
        observed.push(event as unknown as ObservedPayloadEvent)
      }
    })
    observed.length = 0
    transact.registerInverter('broken.change', () => {
      throw new Error('broken inverter')
    })

    transact.start()
    transact.update(createUpdateEvent())
    expect(() =>
      transact.update({
        type: TransactionEventTypes.UPDATE_TRANSACTION,
        eventName: 'broken.change',
        payload: { id: 'broken' }
      })
    ).toThrow('broken inverter')

    expect(() => transact.end({ outcome: 'rollback' })).not.toThrow()
    expect(observed).toHaveLength(1)
    expect(statuses[statuses.length - 1]).toMatchObject({
      status: 'rolled-back'
    })
    expect((transact as unknown as { undoStack: unknown[] }).undoStack).toEqual(
      []
    )
    expect(
      (transact as unknown as { isTransacting: number }).isTransacting
    ).toBe(0)

    subscription.unsubscribe()
  })

  it('rejects an invalid custom inverse before history and rolls back an earlier entry', () => {
    const statuses: TransactionStatusPayload[] = []
    const transact = new DataTransact(undefined, {
      onStatus: (status) => statuses.push(status)
    })
    const observed: ObservedPayloadEvent[] = []
    const subscription = subscribeToEvents((event) => {
      if (event.type === EventTypes.UPDATE_PROPERTY) {
        observed.push(event as unknown as ObservedPayloadEvent)
      }
    })
    observed.length = 0
    transact.registerInverter(
      'custom.invalid-output',
      () => undefined as unknown as AllEvent
    )

    transact.start()
    transact.update(createUpdateEvent())
    expect(() =>
      transact.update({
        type: TransactionEventTypes.UPDATE_TRANSACTION,
        eventName: 'custom.invalid-output',
        payload: { id: 'invalid-output' }
      })
    ).toThrow(
      'Transaction inverter custom.invalid-output produced an invalid replay event'
    )
    expect(() => transact.end({ outcome: 'rollback' })).not.toThrow()
    expect(observed).toHaveLength(1)
    expect(
      (transact as unknown as { isTransacting: number }).isTransacting
    ).toBe(0)
    expect(statuses[statuses.length - 1]).toMatchObject({
      status: 'rolled-back'
    })

    subscription.unsubscribe()
  })

  it('surfaces a synchronous state-owner apply failure as rollback-failed', () => {
    const statuses: TransactionStatusPayload[] = []
    const transact = new DataTransact(undefined, {
      onStatus: (status) => statuses.push(status)
    })
    const applyFailure = new Error('state owner apply failed')
    const subscription = subscribeToSynchronousEvent<TestCanonicalUpdateEvent>(
      EventTypes.UPDATE_PROPERTY,
      () => {
        throw applyFailure
      }
    )

    try {
      transact.start()
      transact.update(createUpdateEvent())

      expect(() => transact.end({ outcome: 'rollback' })).toThrow(
        TransactionRollbackError
      )
      expect(
        (transact as unknown as { isTransacting: number }).isTransacting
      ).toBe(0)
      expect(statuses[statuses.length - 1]).toMatchObject({
        status: 'rollback-failed',
        error: expect.any(TransactionRollbackError)
      })
    } finally {
      subscription.unsubscribe()
    }
  })

  it('uses a registered inverter for custom rollbackable mutations', () => {
    const transact = new DataTransact()
    const observed: ObservedPayloadEvent[] = []
    const subscription = subscribeToEvents((event) => {
      if (String(event.type) === 'custom.inverse') {
        observed.push(event as unknown as ObservedPayloadEvent)
      }
    })
    observed.length = 0
    transact.registerInverter('custom.change', (event) => ({
      ...event,
      type: 'custom.inverse' as AllEvent['type']
    }))
    transact.registerInverter('custom.inverse', (event) => ({
      ...event,
      type: 'custom.change' as AllEvent['type']
    }))

    transact.start()
    transact.update({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: 'custom.change',
      payload: { id: 'custom' }
    })
    transact.end({ outcome: 'rollback' })

    expect(observed).toHaveLength(1)

    subscription.unsubscribe()
  })

  it('rejects an irreversible custom inverter output before active rollback apply', () => {
    const statuses: TransactionStatusPayload[] = []
    const transact = new DataTransact(undefined, {
      onStatus: (status) => statuses.push(status)
    })
    const outputObserver = vi.fn()
    const subscription = subscribeToEvents((event) => {
      if (String(event.type) === 'custom.irreversible-output') {
        outputObserver(event)
      }
    })
    transact.registerInverter('custom.source', (event) => ({
      ...event,
      type: 'custom.irreversible-output' as AllEvent['type']
    }))

    transact.start()
    transact.update({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: 'custom.source',
      payload: { id: 'custom.source' }
    })

    expect(() => transact.end({ outcome: 'rollback' })).toThrow(
      TransactionRollbackError
    )
    expect(outputObserver).not.toHaveBeenCalled()
    expect(statuses[statuses.length - 1]).toMatchObject({
      status: 'rollback-failed',
      error: expect.any(TransactionRollbackError)
    })

    subscription.unsubscribe()
  })

  it('rejects an empty output inverter before active rollback apply', () => {
    const statuses: TransactionStatusPayload[] = []
    const outputApplied = vi.fn()
    const transact = new DataTransact(undefined, {
      onStatus: (status) => statuses.push(status),
      onReplayEvent: (event) => {
        if (String(event.type) === 'custom.output') {
          outputApplied(event)
          return true
        }
        return false
      }
    })
    transact.registerInverter('custom.source', (event) => ({
      ...event,
      type: 'custom.output' as AllEvent['type']
    }))
    transact.registerInverter('custom.output', () => [])

    transact.start()
    transact.update({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: 'custom.source',
      payload: { id: 'custom.source' }
    })

    expect(() => transact.end({ outcome: 'rollback' })).toThrow(
      TransactionRollbackError
    )
    expect(outputApplied).not.toHaveBeenCalled()
    expect(statuses[statuses.length - 1]).toMatchObject({
      status: 'rollback-failed',
      error: expect.any(TransactionRollbackError)
    })
  })

  it('preserves symbol and nested undefined values in rollback journal clones', () => {
    const originalToken = Symbol('original')
    const before = { token: originalToken, optional: undefined }
    const after = { token: 'updated', optional: 'present' }
    let value: { token: symbol | string; optional: string | undefined } = after
    const transact = new DataTransact(undefined, {
      onReplayEvent: (event) => {
        if (String(event.type) !== 'custom.clone') {
          return false
        }
        value = (
          event as AllEvent & {
            payload: { after: typeof value }
          }
        ).payload.after
        return true
      }
    })
    transact.registerInverter('custom.clone', (event) => {
      const payload = (
        event as AllEvent & {
          payload: { before: typeof value; after: typeof value }
        }
      ).payload
      return {
        ...event,
        payload: { before: payload.after, after: payload.before }
      }
    })

    transact.start()
    transact.update({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: 'custom.clone',
      payload: { before, after }
    })
    transact.end({ outcome: 'rollback' })

    expect(value.token).toBe(originalToken)
    expect(Object.prototype.hasOwnProperty.call(value, 'optional')).toBe(true)
    expect(value.optional).toBeUndefined()
  })

  it('rejects an empty custom inverse instead of silently completing replay', () => {
    const statuses: TransactionStatusPayload[] = []
    const transact = new DataTransact(undefined, {
      onStatus: (status) => statuses.push(status)
    })
    transact.registerInverter('custom.empty', () => [])

    transact.start()
    expect(() =>
      transact.update({
        type: TransactionEventTypes.UPDATE_TRANSACTION,
        eventName: 'custom.empty',
        payload: { id: 'custom.empty' }
      })
    ).toThrow('Transaction inverter custom.empty produced no replay event')
    expect(() => transact.end({ outcome: 'rollback' })).not.toThrow()
    expect((transact as unknown as { undoStack: unknown[] }).undoStack).toEqual(
      []
    )
    expect(statuses[statuses.length - 1]).toMatchObject({
      status: 'discarded'
    })
  })

  it('rejects a custom rollbackable mutation without an inverse contract', () => {
    const transact = new DataTransact()

    transact.start()

    expect(() =>
      transact.update({
        type: TransactionEventTypes.UPDATE_TRANSACTION,
        eventName: 'custom.change',
        payload: { id: 'custom.change', before: 0, after: 1 }
      })
    ).toThrow(/custom\.change.*inverter/i)
  })

  it('rejects an undoable custom mutation without an inverse contract', () => {
    const transact = new DataTransact()

    transact.start()

    expect(() =>
      transact.update({
        type: TransactionEventTypes.UPDATE_TRANSACTION,
        eventName: 'custom.undo-effect',
        payload: { id: 'custom.undo-effect' },
        options: { rollbackable: false }
      })
    ).toThrow(/custom\.undo-effect.*inverter/i)
  })

  it('allows an explicitly non-rollbackable custom mutation', () => {
    const transact = new DataTransact()

    transact.start()

    expect(() =>
      transact.update({
        type: TransactionEventTypes.UPDATE_TRANSACTION,
        eventName: 'custom.effect',
        payload: { id: 'custom.effect' },
        options: { rollbackable: false, undoable: false }
      })
    ).not.toThrow()
  })

  it('accepts one registered custom inverter and rejects duplicate names', () => {
    const transact = new DataTransact()
    const inverter = vi.fn((event) => event)

    transact.registerInverter('custom.change', inverter)
    expect(() => transact.registerInverter('custom.change', inverter)).toThrow(
      /already registered/i
    )

    transact.start()

    expect(() =>
      transact.update({
        type: TransactionEventTypes.UPDATE_TRANSACTION,
        eventName: 'custom.change',
        payload: { id: 'custom.change' }
      })
    ).not.toThrow()
  })

  it('records rollbackable changes independently from undo history', () => {
    const transact = new DataTransact()

    transact.start()
    transact.update(createUpdateEvent({ undoable: false, rollbackable: true }))

    const journal = (
      transact as unknown as {
        journal: {
          options: { undoable: boolean; rollbackable: boolean }
        }[]
      }
    ).journal

    expect(journal).toHaveLength(1)
    expect(journal[0].options).toMatchObject({
      undoable: false,
      rollbackable: true
    })

    transact.end()

    expect(
      (transact as unknown as { undoStack: unknown[] }).undoStack
    ).toHaveLength(0)
  })

  it('records explicit non-rollbackable changes for transaction status accounting', () => {
    const transact = new DataTransact()

    transact.start()
    transact.update(createUpdateEvent({ rollbackable: false }))

    const journal = (
      transact as unknown as {
        journal: { options: { rollbackable: boolean } }[]
      }
    ).journal

    expect(journal).toHaveLength(1)
    expect(journal[0].options.rollbackable).toBe(false)

    transact.end()
  })

  it('records shared delivery state in mutation order', () => {
    const pushBatchToSharedChannel = vi.fn().mockReturnValue(true)
    const transact = new DataTransact({ pushBatchToSharedChannel })

    transact.start()
    transact.update(
      createUpdateEvent({
        shared: 'sceneTree',
        sharedDelivery: 'immediate'
      })
    )
    transact.update(createUpdateEvent({ shared: 'props' }))

    const journal = (
      transact as unknown as {
        journal: {
          shared?: {
            name: string
            records: { delivered: boolean }[]
          }
        }[]
      }
    ).journal

    expect(journal.map((entry) => entry.shared)).toEqual([
      expect.objectContaining({
        name: 'sceneTree',
        records: [expect.objectContaining({ delivered: true })]
      }),
      expect.objectContaining({
        name: 'props',
        records: [expect.objectContaining({ delivered: false })]
      })
    ])

    transact.end()
  })

  it('publishes one completion payload when a non-empty action is committed', () => {
    const transact = new DataTransact()
    const subscriber = vi.fn()
    const subscription = subscribeToUserActionCompleted(subscriber)
    subscriber.mockClear()

    transact.start()
    transact.update(createUpdateEvent())
    transact.end()

    expect(subscriber).toHaveBeenCalledTimes(1)
    expect(subscriber.mock.calls[0][0].payload).toMatchObject({
      actionId: 1,
      changeCount: 1
    })
    expect(typeof subscriber.mock.calls[0][0].payload.timestamp).toBe('number')

    subscription.unsubscribe()
  })

  it('does not publish completion payload for no-op transactions', () => {
    const transact = new DataTransact()
    const subscriber = vi.fn()
    const subscription = subscribeToUserActionCompleted(subscriber)
    subscriber.mockClear()

    transact.start()
    transact.end()

    expect(subscriber).not.toHaveBeenCalled()

    subscription.unsubscribe()
  })

  it('routes changes to shared channel when options.shared is set', () => {
    const pushBatchToSharedChannel = vi.fn().mockReturnValue(true)
    const transact = new DataTransact({ pushBatchToSharedChannel })

    transact.start()
    transact.update(createUpdateEvent({ shared: 'sceneTree' }))
    transact.end()

    expect(pushBatchToSharedChannel).toHaveBeenCalledTimes(1)
    expect(pushBatchToSharedChannel).toHaveBeenCalledWith(
      'sceneTree',
      orderedBatchOf({ id: 'test.change' })
    )
  })

  it('defers a non-undoable shared change unless immediate delivery is explicit', () => {
    const pushBatchToSharedChannel = vi.fn().mockReturnValue(true)
    const transact = new DataTransact({ pushBatchToSharedChannel })

    transact.start()
    transact.update(createUpdateEvent({ undoable: false, shared: 'sceneTree' }))

    expect(pushBatchToSharedChannel).not.toHaveBeenCalled()
    transact.end()
    expect(pushBatchToSharedChannel).toHaveBeenCalledTimes(1)
  })

  it('projects an explicitly immediate undoable shared change before commit without publishing it twice', () => {
    const pushBatchToSharedChannel = vi.fn().mockReturnValue(true)
    const transact = new DataTransact({ pushBatchToSharedChannel })
    const subscriber = vi.fn()
    const subscription = subscribeToUserActionCompleted(subscriber)
    subscriber.mockClear()

    transact.start()
    transact.update(
      createUpdateEvent({
        shared: 'sceneTree',
        sharedDelivery: 'immediate'
      })
    )

    expect(pushBatchToSharedChannel).toHaveBeenCalledTimes(1)
    expect(pushBatchToSharedChannel).toHaveBeenCalledWith(
      'sceneTree',
      orderedBatchOf({
        id: 'test.change',
        options: { sharedDelivery: 'immediate' }
      })
    )
    expect(subscriber).not.toHaveBeenCalled()

    transact.end()

    expect(pushBatchToSharedChannel).toHaveBeenCalledTimes(1)
    expect(subscriber).toHaveBeenCalledTimes(1)
    expect(subscriber.mock.calls[0][0].payload).toMatchObject({
      changeCount: 1
    })

    subscription.unsubscribe()
  })

  it('forwards effective mutation options to shared channel payloads', () => {
    const pushBatchToSharedChannel = vi.fn().mockReturnValue(true)
    const transact = new DataTransact({ pushBatchToSharedChannel })

    transact.start()
    transact.update(createUpdateEvent({ undoable: false, shared: 'sceneTree' }))
    transact.end()

    expect(pushBatchToSharedChannel).toHaveBeenCalledWith(
      'sceneTree',
      orderedBatchOf({
        id: 'test.change',
        options: { undoable: false }
      })
    )
    const [deliveredChange] = pushBatchToSharedChannel.mock.calls[0][1]
    expect(
      (deliveredChange as { options: Record<string, unknown> }).options
    ).not.toHaveProperty('shared')
  })

  it('keeps transaction local when options.shared is omitted', () => {
    const pushBatchToSharedChannel = vi.fn()
    const transact = new DataTransact({ pushBatchToSharedChannel })

    transact.start()
    transact.update(createUpdateEvent())
    transact.end()

    expect(pushBatchToSharedChannel).not.toHaveBeenCalled()
  })

  it('keeps transaction local when shared channel is unknown', () => {
    let historyDuringDelivery: unknown
    const pushBatchToSharedChannel = vi.fn(() => {
      historyDuringDelivery = (
        transact as unknown as {
          undoStack: readonly unknown[]
        }
      ).undoStack.at(-1)
      return false
    })
    const transact = new DataTransact({ pushBatchToSharedChannel })
    const subscriber = vi.fn()
    const subscription = subscribeToUserActionCompleted(subscriber)
    subscriber.mockClear()

    transact.start()
    transact.update(createUpdateEvent({ shared: 'unknown-channel' }))
    transact.end()

    expect(pushBatchToSharedChannel).toHaveBeenCalledWith(
      'unknown-channel',
      orderedBatchOf({ id: 'test.change' })
    )
    expect(subscriber).toHaveBeenCalledTimes(1)
    expect(historyDuringDelivery).toBe(
      (
        transact as unknown as {
          undoStack: readonly unknown[]
        }
      ).undoStack.at(-1)
    )

    subscription.unsubscribe()
  })
})
