import { beforeEach, describe, expect, it, vi } from 'vitest'

const { cloneAndDeepFreezeValueSpy } = vi.hoisted(() => ({
  cloneAndDeepFreezeValueSpy: vi.fn()
}))

vi.mock('../value-clone', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../value-clone')>()
  cloneAndDeepFreezeValueSpy.mockImplementation(actual.cloneAndDeepFreezeValue)
  return {
    ...actual,
    cloneAndDeepFreezeValue: cloneAndDeepFreezeValueSpy
  }
})

import { EventTypes, TransactionEventTypes } from '@asyra/reactive-events'
import DataTransact from '../data-transact'
import {
  LocalSharedDataChannel,
  SharedDataChannelRegistry
} from '../shared-data-channel'

describe('Factory shared payload capture budget', () => {
  beforeEach(() => {
    cloneAndDeepFreezeValueSpy.mockClear()
  })

  it('deep-captures one Factory-owned payload snapshot per canonical mutation', () => {
    const registry = new SharedDataChannelRegistry()
    registry.register('sceneTree', new LocalSharedDataChannel())
    const transact = new DataTransact(registry)

    transact.start()
    const sharedGraph = { value: 1 }
    transact.updateBatch([
      {
        type: TransactionEventTypes.UPDATE_TRANSACTION,
        eventName: EventTypes.UPDATE_PROPERTY,
        payload: {
          id: 'canonical-element',
          before: { value: 0 },
          after: sharedGraph
        },
        options: { shared: 'sceneTree' },
        canonicalEvidence: {
          orderedIds: ['canonical-element'],
          sharedRecords: [
            {
              orderedIds: ['canonical-element'],
              payload: {
                id: 'canonical-element',
                before: { value: 0 },
                after: sharedGraph
              }
            }
          ]
        }
      }
    ])
    transact.end()

    expect(cloneAndDeepFreezeValueSpy).toHaveBeenCalledTimes(1)
  })
})
