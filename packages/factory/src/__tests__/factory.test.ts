import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Factory } from '../factory.js'
import { LocalSharedDataChannel } from '../shared-data-channel.js'
import type _DataTransact from '../data-transact.js' // Keep this import for type inference
import {
  type AllEvent,
  EventTypes,
  getTransactionOwner,
  subscribeToEndTransaction,
  subscribeToUserActionCompleted,
  updateTransaction,
  UpdateTransactionEvent,
  TransactionEventTypes
} from '@asyra/reactive-events'
import {
  PROPS_ACTIONS,
  SCENE_TREE_ACTIONS,
  SharedDataChannelNames
} from '@asyra/utils'
import type { TransactionStatusPayload } from '@asyra/utils'

describe('Factory', () => {
  let factory: Factory

  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetAllMocks()
    factory = new Factory()
    // Spy on the methods of the actual DataTransact instance
    vi.spyOn(factory.transact, 'start')
    vi.spyOn(factory.transact, 'update')
    vi.spyOn(factory.transact, 'updateBatch')
    vi.spyOn(factory.transact, 'end')
    vi.spyOn(factory.transact, 'undo')
    vi.spyOn(factory.transact, 'redo')
  })

  it('should call DataTransact.start when startTransaction is called', () => {
    factory.startTransaction()
    expect(factory.transact.start).toHaveBeenCalledTimes(1)
  })

  it('delegates the public scalar update through Factory batch-of-one', () => {
    const mockEvent: UpdateTransactionEvent = {
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: 'test-event',
      payload: { changes: [] }
    }
    const updateBatch = vi.spyOn(factory, 'updateTransactionBatch')

    factory.updateTransaction(mockEvent)

    expect(updateBatch).toHaveBeenCalledOnce()
    expect(updateBatch).toHaveBeenCalledWith([mockEvent])
  })

  it('exposes the canonical batch handoff on the owning transaction owner', () => {
    const updateBatch = vi.fn()
    factory.transact.updateBatch = updateBatch
    const owner = factory.getTransactionOwner()
    const events: readonly UpdateTransactionEvent[] = [
      {
        type: TransactionEventTypes.UPDATE_TRANSACTION,
        eventName: EventTypes.UPDATE_PROPERTY,
        payload: { id: 'batch-owner', before: 0, after: 1 }
      }
    ]

    expect(typeof owner.updateTransactionBatch).toBe('function')
    expect('updateTransaction' in owner).toBe(false)
    owner.updateTransactionBatch(events)
    expect(updateBatch).toHaveBeenCalledOnce()
    expect(updateBatch).toHaveBeenCalledWith(events)
  })

  it('does not expose a scalar shared-delivery subscription route', () => {
    expect('subscribeToSharedDelivery' in factory).toBe(false)
  })

  it('should call DataTransact.end when endTransaction is called', () => {
    factory.endTransaction()
    expect(factory.transact.end).toHaveBeenCalledTimes(1)
  })

  it('routes remote state-owner updates to this Factory and forces rollbackability', () => {
    const statuses: {
      origin: string
      status: string
      rollbackableChangeCount: number
    }[] = []
    factory.subscribeToTransactionStatus((status) => statuses.push(status))

    factory.runRemoteTransaction(() => {
      updateTransaction({
        type: EventTypes.UPDATE_TRANSACTION,
        eventName: EventTypes.UPDATE_PROPERTY,
        payload: { id: 'remote', before: 0, after: 1 },
        options: { undoable: true, rollbackable: false }
      })
    })

    expect(factory.transact.updateBatch).toHaveBeenCalledTimes(1)
    expect(factory.transact.updateBatch).toHaveBeenCalledWith([
      expect.objectContaining({
        eventName: EventTypes.UPDATE_PROPERTY
      })
    ])
    expect(statuses).toEqual([
      expect.objectContaining({
        origin: 'remote',
        status: 'committed',
        rollbackableChangeCount: 1
      })
    ])
  })

  it('preserves the canonical batch handoff inside a remote transaction without local side effects', () => {
    const updateBatch = vi.spyOn(factory.transact, 'updateBatch')
    const publications = vi.fn()
    const captures = vi.fn()
    const statuses: TransactionStatusPayload[] = []
    factory.subscribeToSharedPublication(publications)
    factory.subscribeToCommitCapture(captures)
    factory.subscribeToTransactionStatus((status) => statuses.push(status))
    const events: readonly UpdateTransactionEvent[] = [
      {
        type: TransactionEventTypes.UPDATE_TRANSACTION,
        eventName: EventTypes.UPDATE_PROPERTY,
        payload: { id: 'remote-batch-owner', before: 0, after: 1 }
      }
    ]

    factory.runRemoteTransaction(() => {
      const owner = getTransactionOwner() as ReturnType<
        Factory['getTransactionOwner']
      > | null
      expect(typeof owner?.updateTransactionBatch).toBe('function')
      owner?.updateTransactionBatch(events)
    })

    expect(updateBatch).toHaveBeenCalledOnce()
    expect(updateBatch).toHaveBeenCalledWith(events)
    expect(publications).not.toHaveBeenCalled()
    expect(captures).not.toHaveBeenCalled()
    expect(statuses).toEqual([
      expect.objectContaining({
        origin: 'remote',
        status: 'committed',
        undoableChangeCount: 0
      })
    ])
  })

  it('settles Props before Scene without undo history or outbound publication', () => {
    const projections: string[] = []
    const publications: unknown[] = []
    const statuses: unknown[] = []
    const propsChannel = new LocalSharedDataChannel()
    const sceneChannel = new LocalSharedDataChannel()
    factory.registerSharedDataChannel(
      SharedDataChannelNames.PROPS,
      propsChannel
    )
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      sceneChannel
    )
    propsChannel.observe(() => projections.push('props'))
    sceneChannel.observe(() => projections.push('scene'))
    factory.subscribeToSharedPublication((value) => publications.push(value))
    factory.subscribeToTransactionStatus((value) => statuses.push(value))
    const replay = vi.fn(() => true)
    factory.registerTransactionReplayHandler(EventTypes.REMOVE_PROPERTY, replay)
    factory.registerTransactionReplayHandler(EventTypes.CHANGE_SUBTREE, replay)

    factory.runRemoteTransaction(() => {
      updateTransaction({
        type: EventTypes.UPDATE_TRANSACTION,
        eventName: EventTypes.ADD_PROPERTY,
        payload: {
          action: PROPS_ACTIONS.ADD_PROPERTY,
          undoType: EventTypes.REMOVE_PROPERTY,
          undoAction: PROPS_ACTIONS.REMOVE_PROPERTY,
          eventName: EventTypes.ADD_PROPERTY,
          data: [{ id: 'position-group-a', type: 'position' }]
        },
        options: {
          shared: SharedDataChannelNames.PROPS,
          undoable: true,
          rollbackable: false
        }
      })
      updateTransaction({
        type: EventTypes.UPDATE_TRANSACTION,
        eventName: EventTypes.CHANGE_SUBTREE,
        payload: {
          action: SCENE_TREE_ACTIONS.RESTORE_SUBTREE,
          undoAction: SCENE_TREE_ACTIONS.REMOVE_SUBTREE,
          eventName: EventTypes.CHANGE_SUBTREE,
          elementId: 'group-a',
          removed: [
            {
              elementId: 'group-a',
              parentId: 'workspace-a',
              index: 0,
              data: {
                id: 'group-a',
                type: 'group',
                parentId: 'workspace-a',
                children: []
              }
            }
          ],
          rootParentChildrenAfter: []
        },
        options: {
          shared: SharedDataChannelNames.SCENE_TREE,
          undoable: true,
          rollbackable: false
        }
      })
    })

    expect(projections).toEqual(['props', 'scene'])
    expect(publications).toEqual([])
    expect(statuses).toEqual([
      expect.objectContaining({
        origin: 'remote',
        status: 'committed',
        undoableChangeCount: 0,
        rollbackableChangeCount: 2
      })
    ])

    factory.undo()
    expect(replay).not.toHaveBeenCalled()
    expect(publications).toEqual([])
  })

  it('rolls back both restored owners when remote settlement fails', () => {
    let propsActive = false
    let sceneActive = false
    const rollbackOrder: string[] = []
    const projections: string[] = []
    const publications: unknown[] = []
    const propsChannel = new LocalSharedDataChannel()
    const sceneChannel = new LocalSharedDataChannel()
    factory.registerSharedDataChannel(
      SharedDataChannelNames.PROPS,
      propsChannel
    )
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      sceneChannel
    )
    propsChannel.observe(() => projections.push('props'))
    sceneChannel.observe(() => projections.push('scene'))
    factory.subscribeToSharedPublication((value) => publications.push(value))
    factory.registerTransactionReplayHandler(
      EventTypes.REMOVE_PROPERTY,
      (_event, mode) => {
        expect(mode).toBe('rollback')
        propsActive = false
        rollbackOrder.push('props')
        return true
      }
    )
    factory.registerTransactionReplayHandler(
      EventTypes.CHANGE_SUBTREE,
      (event, mode) => {
        expect(mode).toBe('rollback')
        expect((event as { payload: unknown }).payload).toEqual(
          expect.objectContaining({
            action: SCENE_TREE_ACTIONS.REMOVE_SUBTREE
          })
        )
        sceneActive = false
        rollbackOrder.push('scene')
        return true
      }
    )

    expect(() =>
      factory.runRemoteTransaction(() => {
        propsActive = true
        updateTransaction({
          type: EventTypes.UPDATE_TRANSACTION,
          eventName: EventTypes.ADD_PROPERTY,
          payload: {
            action: PROPS_ACTIONS.ADD_PROPERTY,
            undoType: EventTypes.REMOVE_PROPERTY,
            undoAction: PROPS_ACTIONS.REMOVE_PROPERTY,
            eventName: EventTypes.ADD_PROPERTY,
            data: [{ id: 'position-group-a', type: 'position' }]
          },
          options: { shared: SharedDataChannelNames.PROPS }
        })
        sceneActive = true
        updateTransaction({
          type: EventTypes.UPDATE_TRANSACTION,
          eventName: EventTypes.CHANGE_SUBTREE,
          payload: {
            action: SCENE_TREE_ACTIONS.RESTORE_SUBTREE,
            undoAction: SCENE_TREE_ACTIONS.REMOVE_SUBTREE,
            eventName: EventTypes.CHANGE_SUBTREE,
            elementId: 'group-a',
            removed: [
              {
                elementId: 'group-a',
                parentId: 'workspace-a',
                index: 0,
                data: {
                  id: 'group-a',
                  type: 'group',
                  parentId: 'workspace-a',
                  children: []
                }
              }
            ],
            rootParentChildrenAfter: []
          },
          options: { shared: SharedDataChannelNames.SCENE_TREE }
        })
        throw new Error('remote restore settlement failed')
      })
    ).toThrow('remote restore settlement failed')

    expect({ propsActive, sceneActive }).toEqual({
      propsActive: false,
      sceneActive: false
    })
    expect(rollbackOrder).toEqual(['scene', 'props'])
    expect(projections).toEqual([])
    expect(publications).toEqual([])
  })

  it('publishes the remote transaction end after shared projections settle', () => {
    const projection = new LocalSharedDataChannel()
    const order: string[] = []
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      projection
    )
    const disposeProjection = projection.observe(() => order.push('projection'))
    const endSubscription = subscribeToEndTransaction(() => order.push('end'))
    order.length = 0

    try {
      factory.runRemoteTransaction(() => {
        updateTransaction({
          type: EventTypes.UPDATE_TRANSACTION,
          eventName: EventTypes.UPDATE_PROPERTY,
          payload: { id: 'remote', before: 0, after: 1 },
          options: { shared: SharedDataChannelNames.SCENE_TREE }
        })
      })

      expect(order).toEqual(['projection', 'end'])
    } finally {
      endSubscription.unsubscribe()
      disposeProjection()
    }
  })

  it('forwards one remote event unchanged without state-owner payload interpretation', () => {
    const appliedEvents: unknown[] = []
    const event = {
      type: 'factory.test.remote-opaque-event',
      payload: {
        id: 'remote-element',
        changes: [
          { owner: 'custom', key: 'x', before: 0, after: 1 },
          { owner: 'custom', key: 'x', before: 1, after: 2 },
          { owner: 'custom', key: 'x', before: 2, after: 1 }
        ]
      }
    } as unknown as AllEvent

    const applied = factory.runRemoteTransaction(() =>
      factory.applyRemoteEvent(event, (forwardEvent) => {
        appliedEvents.push(forwardEvent)
        return true
      })
    )

    expect(applied).toBe(true)
    expect(appliedEvents).toEqual([event])
    expect(appliedEvents[0]).not.toBe(event)
    expect((appliedEvents[0] as { payload: unknown }).payload).not.toBe(
      (event as unknown as { payload: unknown }).payload
    )
  })

  it('reports the state owner result for the one forwarded remote event', () => {
    const event = {
      type: 'factory.test.remote-owner-result',
      payload: {
        id: 'remote-element',
        changes: [
          { owner: 'custom', key: 'x', before: 0, after: 1 },
          { owner: 'custom', key: 'y', before: 0, after: 1 }
        ]
      }
    } as unknown as AllEvent

    const noOp = factory.runRemoteTransaction(() =>
      factory.applyRemoteEvent(event, () => false)
    )
    const applied = factory.runRemoteTransaction(() =>
      factory.applyRemoteEvent(event, () => true)
    )

    expect(noOp).toBe(false)
    expect(applied).toBe(true)
  })

  it('should call DataTransact.undo when undo is called', () => {
    factory.undo()
    expect(factory.transact.undo).toHaveBeenCalledTimes(1)
  })

  it('should call DataTransact.redo when redo is called', () => {
    factory.redo()
    expect(factory.transact.redo).toHaveBeenCalledTimes(1)
  })

  it('keeps transaction status subscriptions isolated per Factory instance', () => {
    const first = new Factory()
    const second = new Factory()
    const firstStatus = vi.fn()
    const secondStatus = vi.fn()
    const disposeFirst = first.subscribeToTransactionStatus(firstStatus)
    const disposeSecond = second.subscribeToTransactionStatus(secondStatus)

    first.startTransaction()
    first.updateTransaction({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: EventTypes.UPDATE_PROPERTY,
      payload: { id: 'first', before: 0, after: 1 }
    })
    first.endTransaction()

    expect(firstStatus).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'committed' })
    )
    expect(secondStatus).not.toHaveBeenCalled()

    disposeFirst()
    disposeSecond()
  })

  it('isolates commit-capture subscribers and runs them before public status observers', () => {
    const order: string[] = []
    factory.subscribeToCommitCapture((payload) => {
      order.push('capture-failed-observer')
      ;(
        payload as TransactionStatusPayload & { transactionId: number }
      ).transactionId = 999
    })
    factory.subscribeToCommitCapture(({ transactionId }) => {
      order.push(`capture-later-observer-${transactionId}`)
    })
    factory.subscribeToTransactionStatus(({ status }) => {
      if (status === 'committed') order.push('public-status')
    })

    factory.startTransaction()
    factory.updateTransaction({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: EventTypes.UPDATE_PROPERTY,
      payload: { id: 'capture-order', before: 0, after: 1 }
    })

    expect(() => factory.endTransaction()).not.toThrow()
    expect(order).toEqual([
      'capture-failed-observer',
      'capture-later-observer-1',
      'public-status'
    ])
  })

  it('isolates transaction status listener failures from canonical commit', () => {
    const laterStatus = vi.fn()
    factory.subscribeToTransactionStatus(() => {
      throw new Error('diagnostic listener failed')
    })
    factory.subscribeToTransactionStatus(laterStatus)

    factory.startTransaction()
    factory.updateTransaction({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: EventTypes.UPDATE_PROPERTY,
      payload: { id: 'value', before: 0, after: 1 }
    })

    expect(() => factory.endTransaction()).not.toThrow()
    expect(laterStatus).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'committed' })
    )
  })

  it('reports undo and redo commits on the owning Factory instance', () => {
    const isolatedFactory = new Factory()
    const statuses: { origin: string; status: string }[] = []
    const dispose = isolatedFactory.subscribeToTransactionStatus((status) => {
      statuses.push(status)
    })

    isolatedFactory.startTransaction()
    isolatedFactory.updateTransaction({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: EventTypes.UPDATE_PROPERTY,
      payload: { id: 'value', before: 0, after: 1 }
    })
    isolatedFactory.endTransaction()
    statuses.length = 0

    isolatedFactory.undo()
    isolatedFactory.redo()

    expect(statuses).toEqual([
      expect.objectContaining({ origin: 'undo', status: 'committed' }),
      expect.objectContaining({ origin: 'redo', status: 'committed' })
    ])

    dispose()
  })

  it('hands action, undo, and redo commits to capture subscribers', () => {
    const origins: string[] = []
    factory.subscribeToCommitCapture(({ origin }) => origins.push(origin))

    factory.startTransaction()
    factory.updateTransaction({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: EventTypes.UPDATE_PROPERTY,
      payload: { id: 'capture-replay', before: 0, after: 1 }
    })
    factory.endTransaction()
    factory.undo()
    factory.redo()

    expect(origins).toEqual(['action', 'undo', 'redo'])
  })

  it('does not hand remote commits to client persistence capture subscribers', () => {
    const capture = vi.fn()
    factory.subscribeToCommitCapture(capture)

    factory.runRemoteTransaction(() => {
      factory.updateTransaction({
        type: TransactionEventTypes.UPDATE_TRANSACTION,
        eventName: EventTypes.UPDATE_PROPERTY,
        payload: { id: 'remote-capture-bypass', before: 0, after: 1 }
      })
    })

    expect(capture).not.toHaveBeenCalled()
  })

  it('does not bridge custom Factory completion to the global event bus', () => {
    const customFactory = new Factory()
    const subscriber = vi.fn()
    const subscription = subscribeToUserActionCompleted(subscriber)
    subscriber.mockClear()

    customFactory.startTransaction()
    customFactory.updateTransaction({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: EventTypes.UPDATE_PROPERTY,
      payload: { id: 'custom', before: 0, after: 1 }
    })
    customFactory.endTransaction()

    expect(subscriber).not.toHaveBeenCalled()

    subscription.unsubscribe()
  })

  it('does not register shared data channels implicitly', () => {
    expect(
      factory.hasSharedDataChannel(SharedDataChannelNames.SCENE_TREE)
    ).toBe(false)
    expect(factory.hasSharedDataChannel(SharedDataChannelNames.SELECTION)).toBe(
      false
    )
    expect(factory.hasSharedDataChannel(SharedDataChannelNames.PROPS)).toBe(
      false
    )
  })

  it('notifies channel observers when shared transaction changes are appended', () => {
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      factory.createLocalSharedDataChannel()
    )

    const handler = vi.fn()
    const dispose = factory.observeSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      handler
    )
    const sharedEvent: UpdateTransactionEvent = {
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: EventTypes.UPDATE_PROPERTY,
      payload: { id: 'test-event', before: 0, after: 1 },
      options: { shared: SharedDataChannelNames.SCENE_TREE }
    }

    factory.startTransaction()
    factory.updateTransaction(sharedEvent)
    factory.endTransaction()

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'test-event' })
    )

    dispose()
  })

  it('defers non-undoable shared channel observers without explicit immediate delivery', () => {
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      factory.createLocalSharedDataChannel()
    )

    const handler = vi.fn()
    const dispose = factory.observeSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      handler
    )

    factory.startTransaction()
    factory.updateTransaction({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: EventTypes.UPDATE_PROPERTY,
      payload: {
        id: 'non-undoable-test-event',
        before: 0,
        after: 1
      },
      options: {
        undoable: false,
        shared: SharedDataChannelNames.SCENE_TREE
      }
    })

    expect(handler).not.toHaveBeenCalled()

    factory.endTransaction()

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'non-undoable-test-event' })
    )

    dispose()
  })

  it('delivers each committed journal snapshot once and in order to every observer', () => {
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      factory.createLocalSharedDataChannel()
    )

    interface OrderedChange {
      id: string
      owner: 'shape' | 'stroke'
      before: number
      after: number
      evidence: { sequence: number }
    }
    const firstObserverChanges: OrderedChange[] = []
    const secondObserverChanges: OrderedChange[] = []
    const disposeFirst = factory.observeSharedDataChannel<OrderedChange>(
      SharedDataChannelNames.SCENE_TREE,
      (change) => firstObserverChanges.push(change)
    )
    const disposeSecond = factory.observeSharedDataChannel<OrderedChange>(
      SharedDataChannelNames.SCENE_TREE,
      (change) => secondObserverChanges.push(change)
    )

    factory.startTransaction()
    ;[1, 2, 3].forEach((sequence) => {
      const payload = {
        action: PROPS_ACTIONS.UPDATE_PROPERTY,
        id: 'ordered-element',
        owner: sequence % 2 === 0 ? ('shape' as const) : ('stroke' as const),
        key: 'x',
        before: sequence - 1,
        after: sequence,
        evidence: { sequence }
      }
      factory.updateTransaction({
        type: TransactionEventTypes.UPDATE_TRANSACTION,
        eventName: EventTypes.UPDATE_PROPERTY,
        payload,
        options: { shared: SharedDataChannelNames.SCENE_TREE }
      })
      payload.after = 100 + sequence
      payload.evidence.sequence = 100 + sequence
    })

    expect(firstObserverChanges).toEqual([])
    expect(secondObserverChanges).toEqual([])

    factory.endTransaction()

    const expectedChanges = [1, 2, 3].map((sequence) =>
      expect.objectContaining({
        id: 'ordered-element',
        owner: sequence % 2 === 0 ? 'shape' : 'stroke',
        before: sequence - 1,
        after: sequence,
        evidence: { sequence }
      })
    )
    expect(firstObserverChanges).toEqual(expectedChanges)
    expect(secondObserverChanges).toEqual(expectedChanges)

    factory.startTransaction()
    factory.updateTransaction({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: EventTypes.UPDATE_PROPERTY,
      payload: {
        action: PROPS_ACTIONS.UPDATE_PROPERTY,
        id: 'rolled-back-element',
        owner: 'stroke',
        key: 'x',
        before: 0,
        after: 1
      },
      options: { shared: SharedDataChannelNames.SCENE_TREE }
    })
    factory.endTransaction({ outcome: 'rollback' })

    expect(firstObserverChanges).toHaveLength(3)
    expect(secondObserverChanges).toHaveLength(3)

    disposeFirst()
    disposeSecond()
  })

  it('commits undo before notifying shared channel observers', () => {
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      factory.createLocalSharedDataChannel()
    )

    const undoStackLengths: number[] = []
    const dispose = factory.observeSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      () => {
        undoStackLengths.push(
          (
            factory.transact as unknown as {
              undoStack: unknown[]
            }
          ).undoStack.length
        )
      }
    )

    factory.startTransaction()
    factory.updateTransaction({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: EventTypes.UPDATE_PROPERTY,
      payload: { id: 'test-event', before: 0, after: 1 },
      options: { shared: SharedDataChannelNames.SCENE_TREE }
    })
    expect(undoStackLengths).toEqual([])

    factory.endTransaction()

    expect(undoStackLengths).toEqual([1])

    dispose()
  })

  it('isolates shared channel observer failures from later observers', () => {
    const channel = new LocalSharedDataChannel()
    const laterObserver = vi.fn()
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      channel
    )
    factory.observeSharedDataChannel(SharedDataChannelNames.SCENE_TREE, () => {
      throw new Error('shared observer failed')
    })
    factory.observeSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      laterObserver
    )

    factory.startTransaction()
    expect(() =>
      factory.updateTransaction({
        type: TransactionEventTypes.UPDATE_TRANSACTION,
        eventName: EventTypes.UPDATE_PROPERTY,
        payload: { id: 'observer-safe', before: 0, after: 1 },
        options: {
          shared: SharedDataChannelNames.SCENE_TREE,
          sharedDelivery: 'immediate'
        }
      })
    ).not.toThrow()
    factory.endTransaction()

    expect(laterObserver).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'observer-safe' })
    )
  })

  it('compensates an immediate append when a local projection observer throws', () => {
    const channel = new LocalSharedDataChannel()
    const changes: unknown[] = []
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      channel
    )
    channel.observe(() => {
      throw new Error('raw Yjs observer failed')
    })
    channel.observe((change) => changes.push(change))

    factory.startTransaction()
    expect(() =>
      factory.updateTransaction({
        type: TransactionEventTypes.UPDATE_TRANSACTION,
        eventName: EventTypes.UPDATE_PROPERTY,
        payload: { id: 'compensated', before: 0, after: 1 },
        options: {
          shared: SharedDataChannelNames.SCENE_TREE,
          sharedDelivery: 'immediate'
        }
      })
    ).not.toThrow()
    expect(() => factory.endTransaction({ outcome: 'rollback' })).not.toThrow()

    expect(changes).toEqual([
      expect.objectContaining({ id: 'compensated', before: 0, after: 1 }),
      expect.objectContaining({ id: 'compensated', before: 1, after: 0 })
    ])
  })
})
