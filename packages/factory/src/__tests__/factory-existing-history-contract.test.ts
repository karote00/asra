import { describe, expect, it } from 'vitest'
import { EventTypes, TransactionEventTypes } from '@asyra/reactive-events'
import * as factoryApi from '..'
import { Factory } from '../factory.js'

describe('Factory existing action history contract', () => {
  it('does not expose a parallel mutation artifact or applied-result API', () => {
    expect(factoryApi).not.toHaveProperty('subscribeToMutationBatchArtifact')
    expect(factoryApi).not.toHaveProperty(
      'subscribeToMutationBatchArtifactStatus'
    )
    expect(factoryApi).not.toHaveProperty('getActiveStagedArtifactController')

    const factory = new Factory()
    factory.startTransaction()
    const deliveryHandle = factory.updateTransactionBatch([
      {
        type: TransactionEventTypes.UPDATE_TRANSACTION,
        eventName: EventTypes.UPDATE_PROPERTY,
        payload: {
          id: 'element-1',
          before: 0,
          after: 1
        }
      }
    ])

    expect(deliveryHandle).not.toBeNull()
    expect(deliveryHandle).not.toHaveProperty('artifact')

    factory.endTransaction()
    expect(factory.getUndoHistoryDepth()).toBe(1)
  })
})
