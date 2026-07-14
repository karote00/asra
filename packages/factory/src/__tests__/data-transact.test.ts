import { describe, expect, it, vi } from 'vitest'
import {
  EventTypes,
  TransactionEventTypes,
  subscribeToSynchronousEvent,
  subscribeToEvents,
  subscribeToUserActionCompleted,
  type AllEvent,
  type UpdateComputedDataEvent,
  type UpdateTransactionEvent
} from '@asyra/reactive-events'
import {
  SCENE_TREE_ACTIONS,
  SharedDataChannelNames,
  type TransactionStatusPayload
} from '@asyra/utils'
import DataTransact from '../data-transact'
import {
  TransactionRollbackError,
  TransactionValidationError
} from '../transaction'

interface ObservedPayloadEvent {
  type: string
  payload: unknown
}

const createUpdateEvent = (
  options?: UpdateTransactionEvent['options']
): UpdateTransactionEvent => ({
  type: TransactionEventTypes.UPDATE_TRANSACTION,
  eventName: EventTypes.UPDATE_COMPUTED_DATA,
  payload: {
    id: 'test.change',
    before: 0,
    after: 1
  } as unknown as UpdateTransactionEvent['payload'],
  options
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
    const pushToSharedChannel = vi.fn().mockReturnValue(true)
    const transact = new DataTransact(
      { pushToSharedChannel },
      { onStatus: (status) => statuses.push(status) }
    )

    transact.start()
    transact.update(createUpdateEvent({ shared: 'sceneTree' }))
    transact.update(createUpdateEvent({ undoable: false, rollbackable: true }))
    transact.update(createUpdateEvent({ rollbackable: false }))
    transact.end()

    expect(pushToSharedChannel).toHaveBeenCalledTimes(1)
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
    const pushToSharedChannel = vi.fn().mockReturnValue(true)
    const transact = new DataTransact(
      { pushToSharedChannel },
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

    expect(pushToSharedChannel).toHaveBeenCalledTimes(2)
    expect(pushToSharedChannel.mock.calls).toEqual([
      [
        'sceneTree',
        expect.objectContaining({
          before: 0,
          after: 1,
          options: { sharedDelivery: 'immediate' }
        })
      ],
      [
        'sceneTree',
        expect.objectContaining({
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

  it('does not compensate an immediate change that was not delivered', () => {
    const pushToSharedChannel = vi.fn().mockReturnValue(false)
    const transact = new DataTransact({ pushToSharedChannel })

    transact.start()
    transact.update(
      createUpdateEvent({
        shared: 'unknown',
        sharedDelivery: 'immediate'
      })
    )
    transact.end({ outcome: 'rollback' })

    expect(pushToSharedChannel).toHaveBeenCalledTimes(1)
  })

  it('retains the canonical journal when immediate shared delivery fails before append', () => {
    const deliveryFailure = new Error('shared append failed')
    const pushToSharedChannel = vi.fn(() => {
      throw deliveryFailure
    })
    const transact = new DataTransact({ pushToSharedChannel })
    const observed: unknown[] = []
    const subscription = subscribeToSynchronousEvent<UpdateComputedDataEvent>(
      EventTypes.UPDATE_COMPUTED_DATA,
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
    expect(pushToSharedChannel).toHaveBeenCalledTimes(1)

    subscription.unsubscribe()
  })

  it('runs synchronous transaction validators in registration order', () => {
    const transact = new DataTransact()
    const order: string[] = []

    transact.registerValidator('scene-tree', (context) => {
      order.push(`scene-tree:${context.changeCount}`)
      return undefined
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
    const pushToSharedChannel = vi.fn().mockReturnValue(true)
    const transact = new DataTransact({ pushToSharedChannel })
    const observed: ObservedPayloadEvent[] = []
    const eventSubscription = subscribeToEvents((event) => {
      if (event.type === EventTypes.UPDATE_COMPUTED_DATA) {
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
    expect(pushToSharedChannel).not.toHaveBeenCalled()
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
      if (event.type === EventTypes.UPDATE_COMPUTED_DATA) {
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
      if (event.type === EventTypes.UPDATE_COMPUTED_DATA) {
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

  it('expands a batch change in reverse field order during rollback', () => {
    const transact = new DataTransact()
    const observed: unknown[] = []
    const subscription = subscribeToEvents((event) => {
      if (event.type === EventTypes.UPDATE_COMPUTED_DATA) {
        observed.push((event as AllEvent & { payload: unknown }).payload)
      }
    })
    observed.length = 0

    transact.start()
    transact.update({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: EventTypes.UPDATE_COMPUTED_DATA,
      payload: {
        id: 'element-1',
        changes: [
          { key: 'x', before: 0, after: 10 },
          { key: 'y', before: 5, after: 20 }
        ]
      }
    })
    transact.end({ outcome: 'rollback' })

    expect(observed).toEqual([
      { id: 'element-1', key: 'y', before: 20, after: 5 },
      { id: 'element-1', key: 'x', before: 10, after: 0 }
    ])

    subscription.unsubscribe()
  })

  it('uses scalar action metadata for batch rollback and immediate shared compensation', () => {
    const pushToSharedChannel = vi.fn().mockReturnValue(true)
    const transact = new DataTransact({ pushToSharedChannel })
    const observed: unknown[] = []
    const subscription = subscribeToEvents((event) => {
      if (event.type === EventTypes.UPDATE_COMPUTED_DATA) {
        observed.push((event as AllEvent & { payload: unknown }).payload)
      }
    })
    observed.length = 0

    transact.start()
    transact.update({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: EventTypes.UPDATE_COMPUTED_DATA,
      payload: {
        action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_BATCH,
        id: 'element-1',
        changes: [
          { key: 'x', before: 0, after: 10 },
          { key: 'y', before: 5, after: 20 }
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
        action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA,
        key: 'y',
        before: 20,
        after: 5
      }),
      expect.objectContaining({
        action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA,
        key: 'x',
        before: 10,
        after: 0
      })
    ])
    expect(pushToSharedChannel.mock.calls).toEqual([
      [
        SharedDataChannelNames.SCENE_TREE,
        expect.objectContaining({
          action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA_BATCH
        })
      ],
      [
        SharedDataChannelNames.SCENE_TREE,
        expect.objectContaining({
          action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA,
          key: 'y',
          before: 20,
          after: 5
        })
      ],
      [
        SharedDataChannelNames.SCENE_TREE,
        expect.objectContaining({
          action: SCENE_TREE_ACTIONS.UPDATE_ELEMENT_COMPUTED_DATA,
          key: 'x',
          before: 10,
          after: 0
        })
      ]
    ])

    subscription.unsubscribe()
  })

  it('uses the same batch replay contract for undo and redo', () => {
    const transact = new DataTransact()
    const observed: unknown[] = []
    const subscription = subscribeToEvents((event) => {
      if (event.type === EventTypes.UPDATE_COMPUTED_DATA) {
        observed.push((event as AllEvent & { payload: unknown }).payload)
      }
    })
    observed.length = 0

    transact.start()
    transact.update({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: EventTypes.UPDATE_COMPUTED_DATA,
      payload: {
        id: 'element-1',
        changes: [
          { key: 'x', before: 0, after: 10 },
          { key: 'y', before: 5, after: 20 }
        ]
      }
    })
    transact.end()
    observed.length = 0

    transact.undo()
    transact.redo()

    expect(observed).toEqual([
      { id: 'element-1', key: 'y', before: 20, after: 5 },
      { id: 'element-1', key: 'x', before: 10, after: 0 },
      { id: 'element-1', key: 'x', before: 0, after: 10 },
      { id: 'element-1', key: 'y', before: 5, after: 20 }
    ])

    subscription.unsubscribe()
  })

  it('retains undo and redo replay journals until an existing outer boundary closes', () => {
    const statuses: TransactionStatusPayload[] = []
    const pushToSharedChannel = vi.fn().mockReturnValue(true)
    const transact = new DataTransact(
      { pushToSharedChannel },
      { onStatus: (status) => statuses.push(status) }
    )
    const subscription = subscribeToEvents((event) => {
      if (
        event.type !== EventTypes.UPDATE_COMPUTED_DATA ||
        (!transact.isInUndo() && !transact.isInRedo())
      ) {
        return
      }
      transact.update({
        type: TransactionEventTypes.UPDATE_TRANSACTION,
        eventName: EventTypes.UPDATE_COMPUTED_DATA,
        payload: (event as AllEvent & { payload: unknown }).payload,
        options: { shared: SharedDataChannelNames.SCENE_TREE }
      })
    })

    transact.start()
    transact.update(createUpdateEvent())
    transact.end()
    pushToSharedChannel.mockClear()
    statuses.length = 0

    transact.start()
    transact.undo()
    expect(
      (transact as unknown as { journal: unknown[] }).journal
    ).toHaveLength(1)
    expect(pushToSharedChannel).not.toHaveBeenCalled()
    transact.end()

    expect(pushToSharedChannel).toHaveBeenLastCalledWith(
      SharedDataChannelNames.SCENE_TREE,
      expect.objectContaining({ before: 1, after: 0 })
    )
    expect(statuses[statuses.length - 1]).toMatchObject({
      status: 'committed',
      origin: 'undo'
    })

    pushToSharedChannel.mockClear()
    statuses.length = 0
    transact.start()
    transact.redo()
    expect(
      (transact as unknown as { journal: unknown[] }).journal
    ).toHaveLength(1)
    transact.end()

    expect(pushToSharedChannel).toHaveBeenLastCalledWith(
      SharedDataChannelNames.SCENE_TREE,
      expect.objectContaining({ before: 0, after: 1 })
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
    const subscription = subscribeToSynchronousEvent<UpdateComputedDataEvent>(
      EventTypes.UPDATE_COMPUTED_DATA,
      (event) => {
        value = event.payload.after as number
        if (transact.isInUndo() || transact.isInRedo()) {
          transact.update({
            type: TransactionEventTypes.UPDATE_TRANSACTION,
            eventName: EventTypes.UPDATE_COMPUTED_DATA,
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

  it('keeps nested redo history available when the outer boundary rolls back', () => {
    const transact = new DataTransact()
    let value = 1
    const subscription = subscribeToSynchronousEvent<UpdateComputedDataEvent>(
      EventTypes.UPDATE_COMPUTED_DATA,
      (event) => {
        value = event.payload.after as number
        if (transact.isInUndo() || transact.isInRedo()) {
          transact.update({
            type: TransactionEventTypes.UPDATE_TRANSACTION,
            eventName: EventTypes.UPDATE_COMPUTED_DATA,
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

  it('continues rollback after an inverter failure and surfaces one rollback error', () => {
    const statuses: TransactionStatusPayload[] = []
    const transact = new DataTransact(undefined, {
      onStatus: (status) => statuses.push(status)
    })
    const observed: ObservedPayloadEvent[] = []
    const subscription = subscribeToEvents((event) => {
      if (event.type === EventTypes.UPDATE_COMPUTED_DATA) {
        observed.push(event as unknown as ObservedPayloadEvent)
      }
    })
    observed.length = 0
    transact.registerInverter('broken.change', () => {
      throw new Error('broken inverter')
    })

    transact.start()
    transact.update(createUpdateEvent())
    transact.update({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: 'broken.change',
      payload: { id: 'broken' }
    })

    expect(() => transact.end({ outcome: 'rollback' })).toThrow(
      TransactionRollbackError
    )
    expect(observed).toHaveLength(1)
    expect(
      (transact as unknown as { isTransacting: number }).isTransacting
    ).toBe(0)
    expect(statuses[statuses.length - 1]).toMatchObject({
      status: 'rollback-failed',
      error: expect.any(TransactionRollbackError)
    })

    subscription.unsubscribe()
  })

  it('surfaces a synchronous state-owner apply failure as rollback-failed', () => {
    const statuses: TransactionStatusPayload[] = []
    const transact = new DataTransact(undefined, {
      onStatus: (status) => statuses.push(status)
    })
    const applyFailure = new Error('state owner apply failed')
    const subscription = subscribeToSynchronousEvent<UpdateComputedDataEvent>(
      EventTypes.UPDATE_COMPUTED_DATA,
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

  it('allows an explicitly non-rollbackable custom mutation', () => {
    const transact = new DataTransact()

    transact.start()

    expect(() =>
      transact.update({
        type: TransactionEventTypes.UPDATE_TRANSACTION,
        eventName: 'custom.effect',
        payload: { id: 'custom.effect' },
        options: { rollbackable: false }
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
    const pushToSharedChannel = vi.fn().mockReturnValue(true)
    const transact = new DataTransact({ pushToSharedChannel })

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
          shared?: { name: string; delivered: boolean }
        }[]
      }
    ).journal

    expect(journal.map((entry) => entry.shared)).toEqual([
      expect.objectContaining({ name: 'sceneTree', delivered: true }),
      expect.objectContaining({ name: 'props', delivered: false })
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
    const pushToSharedChannel = vi.fn().mockReturnValue(true)
    const transact = new DataTransact({ pushToSharedChannel })

    transact.start()
    transact.update(createUpdateEvent({ shared: 'sceneTree' }))
    transact.end()

    expect(pushToSharedChannel).toHaveBeenCalledTimes(1)
    expect(pushToSharedChannel).toHaveBeenCalledWith(
      'sceneTree',
      expect.objectContaining({ id: 'test.change' })
    )
  })

  it('projects an explicitly immediate undoable shared change before commit without publishing it twice', () => {
    const pushToSharedChannel = vi.fn().mockReturnValue(true)
    const transact = new DataTransact({ pushToSharedChannel })
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

    expect(pushToSharedChannel).toHaveBeenCalledTimes(1)
    expect(pushToSharedChannel).toHaveBeenCalledWith(
      'sceneTree',
      expect.objectContaining({
        id: 'test.change',
        options: { sharedDelivery: 'immediate' }
      })
    )
    expect(subscriber).not.toHaveBeenCalled()

    transact.end()

    expect(pushToSharedChannel).toHaveBeenCalledTimes(1)
    expect(subscriber).toHaveBeenCalledTimes(1)
    expect(subscriber.mock.calls[0][0].payload).toMatchObject({
      changeCount: 1
    })

    subscription.unsubscribe()
  })

  it('forwards effective mutation options to shared channel payloads', () => {
    const pushToSharedChannel = vi.fn().mockReturnValue(true)
    const transact = new DataTransact({ pushToSharedChannel })

    transact.start()
    transact.update(createUpdateEvent({ undoable: false, shared: 'sceneTree' }))
    transact.end()

    expect(pushToSharedChannel).toHaveBeenCalledWith(
      'sceneTree',
      expect.objectContaining({
        id: 'test.change',
        options: { undoable: false }
      })
    )
    expect(pushToSharedChannel.mock.calls[0][1].options).not.toHaveProperty(
      'shared'
    )
  })

  it('keeps transaction local when options.shared is omitted', () => {
    const pushToSharedChannel = vi.fn()
    const transact = new DataTransact({ pushToSharedChannel })

    transact.start()
    transact.update(createUpdateEvent())
    transact.end()

    expect(pushToSharedChannel).not.toHaveBeenCalled()
  })

  it('keeps transaction local when shared channel is unknown', () => {
    const pushToSharedChannel = vi.fn().mockReturnValue(false)
    const transact = new DataTransact({ pushToSharedChannel })
    const subscriber = vi.fn()
    const subscription = subscribeToUserActionCompleted(subscriber)
    subscriber.mockClear()

    transact.start()
    transact.update(createUpdateEvent({ shared: 'unknown-channel' }))
    transact.end()

    expect(pushToSharedChannel).toHaveBeenCalledWith(
      'unknown-channel',
      expect.objectContaining({ id: 'test.change' })
    )
    expect(subscriber).toHaveBeenCalledTimes(1)

    subscription.unsubscribe()
  })
})
