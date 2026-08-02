import { describe, expect, it } from 'vitest'
import {
  EventTypes,
  TransactionEventTypes,
  type AllEvent,
  type UpdateTransactionEvent
} from '@asyra/reactive-events'
import { SharedDataChannelNames } from '@asyra/utils'
import { Factory, LocalSharedDataChannel, type SharedPublication } from '..'

const createUpdateEvent = (
  id: string,
  options: UpdateTransactionEvent['options'] = {}
): UpdateTransactionEvent => ({
  type: TransactionEventTypes.UPDATE_TRANSACTION,
  eventName: EventTypes.UPDATE_PROPERTY,
  payload: { id, before: 0, after: 1 },
  options
})

describe('Factory journal-backed action history', () => {
  it('records one owner batch as one Undo action and replays the whole action', () => {
    const factory = new Factory()
    const replayed: AllEvent[] = []
    factory.registerTransactionReplayHandler(
      EventTypes.UPDATE_PROPERTY,
      (event) => {
        replayed.push(event)
        return true
      }
    )

    factory.startTransaction()
    factory.updateTransactionBatch([
      createUpdateEvent('element-a'),
      createUpdateEvent('element-b')
    ])
    factory.endTransaction()

    expect(factory.getUndoHistoryDepth()).toBe(1)

    factory.undo()
    expect(
      replayed.map(
        (event) => (event as AllEvent & { payload: { id: string } }).payload.id
      )
    ).toEqual(['element-b', 'element-a'])
    expect(factory.getUndoHistoryDepth()).toBe(0)

    replayed.length = 0
    factory.redo()
    expect(
      replayed.map(
        (event) => (event as AllEvent & { payload: { id: string } }).payload.id
      )
    ).toEqual(['element-a', 'element-b'])
    expect(factory.getUndoHistoryDepth()).toBe(1)
  })

  it('keeps progressive delivery on a delivery-only handle and one history action', () => {
    const factory = new Factory()
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      new LocalSharedDataChannel()
    )
    const publications: SharedPublication[] = []
    factory.subscribeToSharedPublication((publication) =>
      publications.push(publication)
    )

    factory.startTransaction()
    const controller = factory.getActiveStagedDeliveryController()
    const handle = factory.updateTransactionBatch([
      {
        ...createUpdateEvent('element-a', {
          shared: SharedDataChannelNames.SCENE_TREE
        }),
        canonicalEvidence: {
          orderedIds: ['element-a']
        }
      }
    ])

    expect(controller).not.toBeNull()
    expect(handle).not.toBeNull()
    expect(handle).not.toHaveProperty('artifact')

    controller?.setDeliverySequence({
      mode: 'progressive',
      slices: [{ sliceId: 'slice-a', orderedIds: ['element-a'] }]
    })
    controller?.stageSlice('slice-a')
    factory.endTransaction()

    expect(publications).toHaveLength(1)
    expect(publications[0]?.slices[0]?.orderedIds).toEqual(['element-a'])
    expect(factory.getUndoHistoryDepth()).toBe(1)
    expect(factory.getActiveStagedDeliveryController()).toBeNull()
  })

  it('creates no history action for an empty or rolled-back transaction', () => {
    const factory = new Factory()
    factory.registerTransactionReplayHandler(
      EventTypes.UPDATE_PROPERTY,
      () => true
    )

    factory.startTransaction()
    factory.endTransaction()
    expect(factory.getUndoHistoryDepth()).toBe(0)

    factory.startTransaction()
    factory.updateTransaction(createUpdateEvent('rolled-back'))
    factory.endTransaction({ outcome: 'rollback' })
    expect(factory.getUndoHistoryDepth()).toBe(0)
  })

  it('rejects a stale delivery handle after its transaction settles', () => {
    const factory = new Factory()

    factory.startTransaction()
    const handle = factory.updateTransaction(createUpdateEvent('element-a'))
    factory.endTransaction()

    expect(() =>
      handle?.setDeliverySequence({
        mode: 'progressive',
        slices: [{ sliceId: 'slice-a', orderedIds: ['element-a'] }]
      })
    ).toThrow('Factory staged delivery controller is no longer active')
  })

  it('keeps update equivalent to a batch of one', () => {
    const singleFactory = new Factory()
    const batchFactory = new Factory()

    singleFactory.startTransaction()
    singleFactory.updateTransaction(createUpdateEvent('element-a'))
    singleFactory.endTransaction()

    batchFactory.startTransaction()
    batchFactory.updateTransactionBatch([createUpdateEvent('element-a')])
    batchFactory.endTransaction()

    expect(singleFactory.getUndoHistoryDepth()).toBe(1)
    expect(batchFactory.getUndoHistoryDepth()).toBe(1)
  })
})
