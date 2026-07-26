import { beforeEach, describe, expect, it, vi } from 'vitest'

const { cloneValueSpy } = vi.hoisted(() => ({
  cloneValueSpy: vi.fn()
}))

vi.mock('../value-clone', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../value-clone')>()
  cloneValueSpy.mockImplementation(actual.cloneValue)
  return {
    ...actual,
    cloneValue: cloneValueSpy
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
    cloneValueSpy.mockClear()
  })

  it('deep-captures one Factory-owned payload snapshot per canonical mutation', () => {
    const registry = new SharedDataChannelRegistry()
    registry.register('sceneTree', new LocalSharedDataChannel())
    const transact = new DataTransact(registry)

    transact.start()
    transact.update({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: EventTypes.UPDATE_COMPUTED_DATA,
      payload: {
        id: 'canonical-element',
        before: { value: 0 },
        after: { value: 1 }
      },
      options: { shared: 'sceneTree' }
    })
    transact.end()

    expect(cloneValueSpy).toHaveBeenCalledTimes(1)
  })
})
