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

describe('Factory shared payload capture budget', () => {
  beforeEach(() => {
    cloneValueSpy.mockClear()
  })

  it('deep-captures one journal snapshot and one shared snapshot per canonical mutation', () => {
    const transact = new DataTransact({
      pushToSharedChannel: vi.fn().mockReturnValue(true)
    })

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

    expect(cloneValueSpy).toHaveBeenCalledTimes(2)
  })
})
