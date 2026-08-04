import { describe, expect, it } from 'vitest'
import { EventTypes, TransactionEventTypes } from '@asyra/reactive-events'
import DataTransact from '../data-transact.js'
import { Factory } from '../factory.js'

const createUndoableEvent = () => ({
  type: TransactionEventTypes.UPDATE_TRANSACTION,
  eventName: EventTypes.UPDATE_PROPERTY,
  payload: {
    after: 1,
    before: 0,
    id: 'history-depth'
  },
  options: {
    undoable: true
  }
})

describe('Factory history depth evidence', () => {
  it('reports one read-only depth for the exact local undo stack', () => {
    const transact = new DataTransact()

    expect(transact.getUndoHistoryDepth()).toBe(0)
    transact.start()
    transact.update(createUndoableEvent())
    transact.end()
    expect(transact.getUndoHistoryDepth()).toBe(1)
  })

  it('delegates the same scalar through the Factory owner', () => {
    const factory = new Factory()

    expect(factory.getUndoHistoryDepth()).toBe(0)
    factory.startTransaction()
    factory.updateTransaction(createUndoableEvent())
    factory.endTransaction()
    expect(factory.getUndoHistoryDepth()).toBe(1)
  })
})
