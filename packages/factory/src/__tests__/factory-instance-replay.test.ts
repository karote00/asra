import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import {
  endTransaction,
  EventTypes,
  startTransaction,
  subscribeToSynchronousEvent,
  TransactionEventTypes,
  type UpdateComputedDataEvent
} from '@asyra/reactive-events'
import type { TransactionStatusPayload } from '@asyra/utils'
import { SharedDataChannelNames } from '@asyra/utils'
import defaultFactory, { Factory } from '../index'

describe('Factory replay instance isolation', () => {
  it('does not route a custom Factory undo through the default owner', () => {
    defaultFactory.transact.reset()
    const customFactory = new Factory()
    const defaultStatuses: TransactionStatusPayload[] = []
    const customStatuses: TransactionStatusPayload[] = []
    const disposeDefault = defaultFactory.subscribeToTransactionStatus(
      (status) => defaultStatuses.push(status)
    )
    const disposeCustom = customFactory.subscribeToTransactionStatus((status) =>
      customStatuses.push(status)
    )

    try {
      customFactory.startTransaction()
      customFactory.updateTransaction({
        type: TransactionEventTypes.UPDATE_TRANSACTION,
        eventName: EventTypes.UPDATE_COMPUTED_DATA,
        payload: { id: 'custom', before: 0, after: 1 }
      })
      customFactory.endTransaction()
      defaultStatuses.length = 0
      customStatuses.length = 0

      customFactory.undo()

      expect(defaultStatuses).toEqual([])
      expect(customStatuses).toEqual([
        expect.objectContaining({ origin: 'undo', status: 'committed' })
      ])
    } finally {
      disposeDefault()
      disposeCustom()
      defaultFactory.transact.reset()
      customFactory.transact.reset()
    }
  })

  it('keeps a custom Factory replay boundary independent from an active default boundary', () => {
    defaultFactory.transact.reset()
    const customFactory = new Factory()
    const channel = new Y.Doc().getArray(SharedDataChannelNames.SCENE_TREE)
    customFactory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      channel
    )
    const replaySubscription =
      subscribeToSynchronousEvent<UpdateComputedDataEvent>(
        EventTypes.UPDATE_COMPUTED_DATA,
        (event) => {
          if (!customFactory.isInUndoRedo()) {
            return
          }
          customFactory.updateTransaction({
            type: TransactionEventTypes.UPDATE_TRANSACTION,
            eventName: EventTypes.UPDATE_COMPUTED_DATA,
            payload: event.payload,
            options: {
              shared: SharedDataChannelNames.SCENE_TREE,
              sharedDelivery: 'immediate'
            }
          })
        }
      )

    try {
      customFactory.startTransaction()
      customFactory.updateTransaction({
        type: TransactionEventTypes.UPDATE_TRANSACTION,
        eventName: EventTypes.UPDATE_COMPUTED_DATA,
        payload: { id: 'custom', before: 0, after: 1 }
      })
      customFactory.endTransaction()

      startTransaction()
      customFactory.undo()

      expect(channel.toArray()).toEqual([
        expect.objectContaining({ id: 'custom', before: 1, after: 0 })
      ])
    } finally {
      endTransaction()
      replaySubscription.unsubscribe()
      defaultFactory.transact.reset()
      customFactory.transact.reset()
    }
  })
})
