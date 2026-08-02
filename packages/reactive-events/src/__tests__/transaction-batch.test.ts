import { describe, expect, it, vi } from 'vitest'
import {
  EventTypes,
  isDetachedTransactionValue,
  issueDetachedTransactionOwnerBatch,
  runTransaction,
  subscribeToEventBatches,
  subscribeToEvents,
  updateTransaction,
  updateTransactionBatch,
  type UpdateTransactionEvent
} from '..'
import { registerTransactionOwner } from '../transaction-owner'

const createTransactionEvent = (
  eventName: string,
  payload: unknown
): UpdateTransactionEvent => ({
  type: EventTypes.UPDATE_TRANSACTION,
  eventName,
  payload
})

const freezeTransactionValue = <T>(
  value: T,
  seen = new WeakSet<object>()
): T => {
  if (value === null || typeof value !== 'object' || seen.has(value)) {
    return value
  }
  seen.add(value)
  Reflect.ownKeys(value).forEach((key) => {
    freezeTransactionValue(Reflect.get(value, key), seen)
  })
  return Object.freeze(value)
}

const createOwner = (
  updateTransactionBatch: (
    events: readonly UpdateTransactionEvent[]
  ) => void = vi.fn()
) => ({
  startTransaction: vi.fn(),
  updateTransactionBatch,
  endTransaction: vi.fn(),
  undo: vi.fn(),
  redo: vi.fn()
})

describe('transaction batch publishing', () => {
  it('issues one frozen owner container without traversing nested geometry', () => {
    let nestedReadCount = 0
    const geometry = Object.freeze(
      Object.defineProperty({}, 'points', {
        enumerable: true,
        get: () => {
          nestedReadCount += 1
          return Object.freeze([1, 2, 3])
        }
      })
    )
    const payload = Object.freeze({ geometry })
    const event = Object.freeze(
      createTransactionEvent('property.owner-issued', payload)
    )
    const ownerBatch = Object.freeze([event])

    const issued = issueDetachedTransactionOwnerBatch(ownerBatch)

    expect(issued).toBe(ownerBatch)
    expect(isDetachedTransactionValue(issued)).toBe(true)
    expect(nestedReadCount).toBe(0)
  })

  it('rejects a shallow-frozen owner declaration with a mutable payload', () => {
    const event = Object.freeze(
      createTransactionEvent('property.mutable-payload', {
        nested: { value: 1 }
      })
    )

    expect(() =>
      issueDetachedTransactionOwnerBatch(Object.freeze([event]))
    ).toThrow(/frozen event 0 payload/i)
    expect(isDetachedTransactionValue(Object.freeze([event]))).toBe(false)
  })

  it('hands one ordered isolated immutable batch identity to the owner once', () => {
    const ownerUpdate = vi.fn()
    const disposeOwner = registerTransactionOwner(createOwner(ownerUpdate))
    const sourcePayload = {
      property: {
        before: { x: 1 },
        after: { x: 2 }
      }
    }
    const sourceEvents = freezeTransactionValue([
      {
        ...createTransactionEvent('property.first', sourcePayload),
        canonicalEvidence: {
          orderedIds: ['element-a'],
          sharedRecords: [
            {
              orderedIds: ['element-a'],
              payload: { id: 'element-a', nested: { value: 1 } }
            }
          ]
        }
      },
      createTransactionEvent('property.second', {
        values: [1, { nested: 'second' }]
      })
    ])

    try {
      updateTransactionBatch(sourceEvents)

      expect(ownerUpdate).toHaveBeenCalledOnce()
      const delivered = ownerUpdate.mock.calls[0]?.[0] as
        | readonly UpdateTransactionEvent[]
        | undefined
      expect(delivered?.map(({ eventName }) => eventName)).toEqual([
        'property.first',
        'property.second'
      ])
      expect(delivered).not.toBe(sourceEvents)
      expect(delivered?.[0]).not.toBe(sourceEvents[0])
      expect(delivered?.[0]?.payload).not.toBe(sourcePayload)
      expect(Object.isFrozen(delivered)).toBe(true)
      expect(Object.isFrozen(delivered?.[0])).toBe(true)
      expect(
        Object.isFrozen(
          (delivered?.[0]?.payload as typeof sourcePayload).property.after
        )
      ).toBe(true)
      expect(delivered?.[0]?.canonicalEvidence).not.toBe(
        sourceEvents[0]?.canonicalEvidence
      )
      expect(Object.isFrozen(delivered?.[0]?.canonicalEvidence)).toBe(true)
      expect(
        Object.isFrozen(
          delivered?.[0]?.canonicalEvidence?.sharedRecords?.[0]?.payload
        )
      ).toBe(true)
      expect(delivered?.map(({ eventName }) => eventName)).toEqual([
        'property.first',
        'property.second'
      ])
    } finally {
      disposeOwner()
    }
  })

  it('isolates an externally shallow-frozen batch once and reuses its issued identity', () => {
    const ownerUpdate = vi.fn()
    const disposeOwner = registerTransactionOwner(createOwner(ownerUpdate))
    const sourceEvent = createTransactionEvent('property.external', {
      nested: { value: 1 }
    })
    const externalBatch = Object.freeze([sourceEvent])

    try {
      updateTransactionBatch(externalBatch)
      const issuedBatch = ownerUpdate.mock.calls[0]?.[0] as
        | readonly UpdateTransactionEvent[]
        | undefined

      expect(issuedBatch).not.toBe(externalBatch)
      expect(issuedBatch?.[0]).not.toBe(sourceEvent)
      expect(Object.isFrozen(sourceEvent)).toBe(false)
      expect(Object.isFrozen(sourceEvent.payload)).toBe(false)
      expect(Object.isFrozen(issuedBatch)).toBe(true)
      expect(Object.isFrozen(issuedBatch?.[0])).toBe(true)
      expect(Object.isFrozen(issuedBatch?.[0]?.payload)).toBe(true)

      updateTransactionBatch(issuedBatch ?? [])
      expect(ownerUpdate.mock.calls[1]?.[0]).toBe(issuedBatch)
    } finally {
      disposeOwner()
    }
  })

  it('delegates one complete immutable event through one batch-of-one owner call', () => {
    const ownerUpdate = vi.fn()
    const disposeOwner = registerTransactionOwner(createOwner(ownerUpdate))
    const sourceEvent: UpdateTransactionEvent = {
      ...createTransactionEvent('property.scalar', {
        before: { x: 1 },
        after: { x: 2 }
      }),
      canonicalEvidence: {
        orderedIds: ['element-scalar'],
        sharedRecords: [
          {
            orderedIds: ['element-scalar'],
            payload: {
              id: 'element-scalar',
              nested: { value: 1 }
            }
          }
        ]
      }
    }

    try {
      updateTransaction(sourceEvent)

      expect(ownerUpdate).toHaveBeenCalledOnce()
      const delivered = ownerUpdate.mock.calls[0]?.[0] as
        | readonly UpdateTransactionEvent[]
        | undefined
      expect(delivered).toEqual([sourceEvent])
      expect(delivered?.[0]).not.toBe(sourceEvent)
      expect(delivered?.[0]?.canonicalEvidence).not.toBe(
        sourceEvent.canonicalEvidence
      )
      expect(Object.isFrozen(delivered)).toBe(true)
      expect(Object.isFrozen(delivered?.[0])).toBe(true)
      expect(Object.isFrozen(delivered?.[0]?.canonicalEvidence)).toBe(true)
      expect(
        Object.isFrozen(
          delivered?.[0]?.canonicalEvidence?.sharedRecords?.[0]?.payload
        )
      ).toBe(true)
      ;(
        sourceEvent.canonicalEvidence?.sharedRecords?.[0]?.payload as {
          nested: { value: number }
        }
      ).nested.value = 99
      expect(
        (
          delivered?.[0]?.canonicalEvidence?.sharedRecords?.[0]?.payload as {
            nested: { value: number }
          }
        ).nested.value
      ).toBe(1)
    } finally {
      disposeOwner()
    }
  })

  it('publishes each frozen event in order without an owner', () => {
    const observer = vi.fn()
    const batchObserver = vi.fn()
    const subscription = subscribeToEvents(observer)
    const batchSubscription = subscribeToEventBatches(batchObserver)
    observer.mockClear()
    batchObserver.mockClear()
    const source = [
      createTransactionEvent('property.first', { value: 1 }),
      createTransactionEvent('property.second', { value: 2 })
    ]

    try {
      updateTransactionBatch(source)

      expect(observer.mock.calls.map(([event]) => event.eventName)).toEqual([
        'property.first',
        'property.second'
      ])
      expect(
        observer.mock.calls.every(
          ([event]) => Object.isFrozen(event) && Object.isFrozen(event.payload)
        )
      ).toBe(true)
      expect(batchObserver).toHaveBeenCalledOnce()
      expect(batchObserver.mock.calls[0]?.[0]).toEqual(
        observer.mock.calls.map(([event]) => event)
      )
    } finally {
      subscription.unsubscribe()
      batchSubscription.unsubscribe()
    }
  })

  it('isolates later observers from an earlier observer mutation attempt', () => {
    const firstObserver = vi.fn((sourceEvent) => {
      const event = sourceEvent as UpdateTransactionEvent
      try {
        ;(event.payload as { nested: { value: number } }).nested.value = 99
      } catch {
        // A frozen event may throw in strict mode; either way it cannot mutate.
      }
    })
    const laterObserver = vi.fn()
    const firstSubscription = subscribeToEvents(firstObserver)
    const laterSubscription = subscribeToEvents(laterObserver)
    firstObserver.mockClear()
    laterObserver.mockClear()

    try {
      updateTransactionBatch([
        createTransactionEvent('property.isolated', {
          nested: { value: 1 }
        })
      ])

      expect(firstObserver).toHaveBeenCalledOnce()
      expect(
        (
          laterObserver.mock.calls[0]?.[0].payload as {
            nested: { value: number }
          }
        ).nested.value
      ).toBe(1)
    } finally {
      firstSubscription.unsubscribe()
      laterSubscription.unsubscribe()
    }
  })

  it('publishes no observer prefix when the owner rejects the batch', () => {
    const rejection = new Error('canonical owner rejected batch')
    const ownerUpdate = vi.fn(() => {
      throw rejection
    })
    const disposeOwner = registerTransactionOwner(createOwner(ownerUpdate))
    const observer = vi.fn()
    const batchObserver = vi.fn()
    const subscription = subscribeToEvents(observer)
    const batchSubscription = subscribeToEventBatches(batchObserver)
    observer.mockClear()
    batchObserver.mockClear()

    try {
      expect(() =>
        updateTransactionBatch([
          createTransactionEvent('property.first', { value: 1 }),
          createTransactionEvent('property.second', { value: 2 })
        ])
      ).toThrow(rejection)

      expect(ownerUpdate).toHaveBeenCalledOnce()
      expect(
        observer.mock.calls
          .map(([event]) => event)
          .filter(
            ({ type }: { type: string }) =>
              type === EventTypes.UPDATE_TRANSACTION
          )
      ).toEqual([])
      expect(
        batchObserver.mock.calls
          .map(([events]) => events)
          .filter((events) =>
            events.some(
              ({ type }: { type: string }) =>
                type === EventTypes.UPDATE_TRANSACTION
            )
          )
      ).toEqual([])
    } finally {
      subscription.unsubscribe()
      batchSubscription.unsubscribe()
      disposeOwner()
    }
  })

  it('publishes no observer prefix when later owner work rolls back the outer transaction', () => {
    const owner = createOwner()
    const disposeOwner = registerTransactionOwner(owner)
    const observer = vi.fn()
    const batchObserver = vi.fn()
    const subscription = subscribeToEvents(observer)
    const batchSubscription = subscribeToEventBatches(batchObserver)
    observer.mockClear()
    batchObserver.mockClear()
    const failure = new Error('later canonical owner failed')

    try {
      expect(() =>
        runTransaction(() => {
          updateTransactionBatch([
            createTransactionEvent('property.accepted', { value: 1 })
          ])
          updateTransactionBatch([
            createTransactionEvent('scene.rejected', { value: 2 })
          ])
          throw failure
        })
      ).toThrow(failure)

      expect(owner.updateTransactionBatch).toHaveBeenCalledTimes(2)
      expect(owner.endTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: 'rollback' })
      )
      expect(
        observer.mock.calls
          .map(([event]) => event)
          .filter(
            ({ type }: { type: string }) =>
              type === EventTypes.UPDATE_TRANSACTION
          )
      ).toEqual([])
      expect(
        batchObserver.mock.calls
          .map(([events]) => events)
          .filter((events) =>
            events.some(
              ({ type }: { type: string }) =>
                type === EventTypes.UPDATE_TRANSACTION
            )
          )
      ).toEqual([])
    } finally {
      subscription.unsubscribe()
      batchSubscription.unsubscribe()
      disposeOwner()
    }
  })

  it('publishes one ordered observer batch only after the owner commits', () => {
    const order: string[] = []
    const owner = createOwner()
    owner.endTransaction.mockImplementation(() => {
      order.push('owner-commit')
    })
    const disposeOwner = registerTransactionOwner(owner)
    const observedCanonicalBatches: string[][] = []
    const batchSubscription = subscribeToEventBatches((events) => {
      const eventNames = events
        .filter(
          (event): event is UpdateTransactionEvent =>
            event.type === EventTypes.UPDATE_TRANSACTION
        )
        .map(({ eventName }) => eventName)
      if (eventNames.length === 0) {
        return
      }
      order.push('observer-batch')
      observedCanonicalBatches.push(eventNames)
    })

    try {
      runTransaction(() => {
        updateTransactionBatch([
          createTransactionEvent('property.first', { value: 1 })
        ])
        updateTransactionBatch([
          createTransactionEvent('scene.second', { value: 2 })
        ])
      })

      expect(owner.updateTransactionBatch).toHaveBeenCalledTimes(2)
      expect(observedCanonicalBatches).toEqual([
        ['property.first', 'scene.second']
      ])
      expect(order).toEqual(['owner-commit', 'observer-batch'])
    } finally {
      batchSubscription.unsubscribe()
      disposeOwner()
    }
  })

  it('discards pending observer evidence when owner finalization fails', () => {
    const finalizationFailure = new Error('owner finalization failed')
    const owner = createOwner()
    owner.endTransaction.mockImplementation(() => {
      throw finalizationFailure
    })
    const disposeOwner = registerTransactionOwner(owner)
    const observedCanonicalBatches: (readonly UpdateTransactionEvent[])[] = []
    const batchSubscription = subscribeToEventBatches((events) => {
      const canonicalEvents = events.filter(
        (event): event is UpdateTransactionEvent =>
          event.type === EventTypes.UPDATE_TRANSACTION
      )
      if (canonicalEvents.length > 0) {
        observedCanonicalBatches.push(canonicalEvents)
      }
    })

    try {
      expect(() =>
        runTransaction(() => {
          updateTransactionBatch([
            createTransactionEvent('property.pending', { value: 1 })
          ])
        })
      ).toThrow(finalizationFailure)

      expect(observedCanonicalBatches).toEqual([])
    } finally {
      batchSubscription.unsubscribe()
      disposeOwner()
    }
  })
})
