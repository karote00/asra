import { describe, expect, it, vi } from 'vitest'
import {
  EventTypes,
  TransactionEventTypes,
  type AllEvent
} from '@asyra/reactive-events'
import { SharedDataChannelNames } from '@asyra/utils'
import {
  Factory,
  LocalSharedDataChannel,
  type FactoryMutationBatchArtifact,
  type SharedDeliveryBatch,
  type SharedPublication
} from '..'

const update = (
  factory: Factory,
  id: string,
  before: number,
  after: number,
  sharedDelivery: 'transaction-end' | 'immediate' = 'transaction-end'
) => {
  factory.updateTransaction({
    type: TransactionEventTypes.UPDATE_TRANSACTION,
    eventName: EventTypes.UPDATE_COMPUTED_DATA,
    payload: { id, before, after },
    options: {
      shared: SharedDataChannelNames.SCENE_TREE,
      sharedDelivery
    }
  })
}

const createUpdateEvent = (
  id: string,
  before: number,
  after: number
): Parameters<Factory['updateTransaction']>[0] => ({
  type: TransactionEventTypes.UPDATE_TRANSACTION,
  eventName: EventTypes.UPDATE_COMPUTED_DATA,
  payload: { id, before, after }
})

const expectDeeplyFrozen = (
  value: unknown,
  seen = new WeakSet<object>()
): void => {
  if (value === null || typeof value !== 'object' || seen.has(value)) {
    return
  }
  seen.add(value)
  expect(Object.isFrozen(value)).toBe(true)
  Reflect.ownKeys(value).forEach((key) => {
    expectDeeplyFrozen(Reflect.get(value, key), seen)
  })
}

const payloadOf = (event: AllEvent | undefined): unknown =>
  (event as (AllEvent & { payload: unknown }) | undefined)?.payload

describe('Factory immutable mutation batch artifact', () => {
  it('emits one deeply frozen artifact for one committed non-empty outer action', () => {
    const factory = new Factory()
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      new LocalSharedDataChannel()
    )
    const firstArtifacts: FactoryMutationBatchArtifact[] = []
    const laterArtifacts: FactoryMutationBatchArtifact[] = []
    const observedBatches: (readonly unknown[])[] = []
    const deliveryBatches: SharedDeliveryBatch[] = []
    const publications: SharedPublication[] = []
    factory.subscribeToMutationBatchArtifact((artifact) => {
      firstArtifacts.push(artifact)
      const firstChange = artifact.changes[0]
      if (!firstChange) return
      ;(
        payloadOf(firstChange.event) as {
          after: number
        }
      ).after = 99
    })
    factory.subscribeToMutationBatchArtifact((artifact) =>
      laterArtifacts.push(artifact)
    )
    factory.observeSharedDataChannelBatch(
      SharedDataChannelNames.SCENE_TREE,
      (batch) => observedBatches.push(batch)
    )
    factory.subscribeToSharedDeliveryBatch((batch) =>
      deliveryBatches.push(batch)
    )
    factory.subscribeToSharedPublication((publication) =>
      publications.push(publication)
    )

    factory.startTransaction()
    factory.startTransaction()
    const handle = factory.updateTransactionBatch(
      [
        {
          ...createUpdateEvent('element-a', 0, 1),
          options: { shared: SharedDataChannelNames.SCENE_TREE }
        },
        {
          ...createUpdateEvent('element-b', 1, 2),
          options: { shared: SharedDataChannelNames.SCENE_TREE }
        }
      ],
      [{ orderedIds: ['element-a'] }, { orderedIds: ['element-b'] }]
    )
    expect(handle).not.toBeNull()
    expect(handle?.artifact).toBeNull()
    handle?.setDeliveryPlan({
      mode: 'progressive',
      slices: [
        { sliceId: 'slice-a', orderedIds: ['element-a'] },
        { sliceId: 'slice-b', orderedIds: ['element-b'] }
      ]
    })
    factory.endTransaction()
    expect(firstArtifacts).toEqual([])
    factory.endTransaction()

    expect(firstArtifacts).toHaveLength(1)
    expect(laterArtifacts).toHaveLength(1)
    const artifact = firstArtifacts[0]
    expect(artifact).toBe(laterArtifacts[0])
    expect(handle?.artifact).toBe(artifact)
    expect(() =>
      handle?.setDeliveryPlan({ mode: 'atomic', slices: [] })
    ).toThrow('Factory mutation batch delivery handle is no longer active')
    expect(artifact).toMatchObject({
      artifactId: '1:artifact',
      transactionId: 1,
      origin: 'action',
      orderedChangeIds: ['1:change:0', '1:change:1'],
      deliveryPlan: {
        mode: 'progressive',
        slices: [
          { sliceId: 'slice-a', orderedIds: ['element-a'] },
          { sliceId: 'slice-b', orderedIds: ['element-b'] }
        ]
      }
    })
    expect(
      artifact?.changes.map((change) => ({
        id: (payloadOf(change.event) as { id: string }).id,
        inverse: change.inverseEvents.map(payloadOf)
      }))
    ).toEqual([
      {
        id: 'element-a',
        inverse: [expect.objectContaining({ before: 1, after: 0 })]
      },
      {
        id: 'element-b',
        inverse: [expect.objectContaining({ before: 2, after: 1 })]
      }
    ])
    expect(artifact?.inverses.map(payloadOf)).toEqual([
      expect.objectContaining({ id: 'element-b', before: 2, after: 1 }),
      expect.objectContaining({ id: 'element-a', before: 1, after: 0 })
    ])
    expect(observedBatches).toHaveLength(2)
    expect(deliveryBatches).toHaveLength(2)
    expect(publications).toHaveLength(2)
    artifact?.batches.forEach((batch, index) => {
      expect(publications[index]?.batches[0]).toBe(batch)
      expect(deliveryBatches[index]).toBe(batch)
      expect(observedBatches[index]?.[0]).toBe(batch.deliveries[0]?.payload)
    })
    expect(
      (
        payloadOf(laterArtifacts[0]?.changes[0]?.event) as {
          after: number
        }
      ).after
    ).toBe(1)
    expectDeeplyFrozen(artifact)
    expectDeeplyFrozen(publications[0])
    expectDeeplyFrozen(publications[1])
  })

  it('keeps the original artifact as the one complete Undo and Redo history action', () => {
    const factory = new Factory()
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      new LocalSharedDataChannel()
    )
    const values = new Map([
      ['element-a', 0],
      ['element-b', 0]
    ])
    const artifacts: FactoryMutationBatchArtifact[] = []
    factory.subscribeToMutationBatchArtifact((artifact) =>
      artifacts.push(artifact)
    )
    factory.registerTransactionReplayHandler(
      EventTypes.UPDATE_COMPUTED_DATA,
      (event) => {
        const payload = (
          event as AllEvent & {
            payload: { id: string; before: number; after: number }
          }
        ).payload
        values.set(payload.id, payload.after)
        factory.updateTransaction({
          type: TransactionEventTypes.UPDATE_TRANSACTION,
          eventName: EventTypes.UPDATE_COMPUTED_DATA,
          payload,
          options: { shared: SharedDataChannelNames.SCENE_TREE }
        })
        return true
      }
    )

    factory.startTransaction()
    update(factory, 'element-a', 0, 1)
    values.set('element-a', 1)
    update(factory, 'element-b', 0, 2)
    values.set('element-b', 2)
    factory.endTransaction()

    const originalArtifact = artifacts[0]
    expect(
      (
        factory.transact as unknown as {
          undoStack: FactoryMutationBatchArtifact[]
        }
      ).undoStack
    ).toEqual([originalArtifact])

    factory.undo()
    expect(Object.fromEntries(values)).toEqual({
      'element-a': 0,
      'element-b': 0
    })
    expect(
      (
        factory.transact as unknown as {
          redoStack: FactoryMutationBatchArtifact[]
        }
      ).redoStack
    ).toEqual([originalArtifact])

    factory.redo()
    expect(Object.fromEntries(values)).toEqual({
      'element-a': 1,
      'element-b': 2
    })
    expect(
      (
        factory.transact as unknown as {
          undoStack: FactoryMutationBatchArtifact[]
        }
      ).undoStack
    ).toEqual([originalArtifact])
    expect(artifacts.map((artifact) => artifact.origin)).toEqual([
      'action',
      'undo',
      'redo'
    ])
  })

  it('emits no committed artifact for no-change or failed transactions', () => {
    const factory = new Factory()
    const artifacts = vi.fn()
    factory.subscribeToMutationBatchArtifact(artifacts)

    factory.startTransaction()
    factory.endTransaction()

    factory.startTransaction()
    factory.updateTransaction({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: EventTypes.UPDATE_COMPUTED_DATA,
      payload: { id: 'rolled-back', before: 0, after: 1 }
    })
    factory.endTransaction({ outcome: 'rollback' })

    expect(artifacts).not.toHaveBeenCalled()
  })

  it('keeps the single update API exactly equivalent to batch-of-one', () => {
    const singleFactory = new Factory()
    const batchFactory = new Factory()
    const singleArtifacts: FactoryMutationBatchArtifact[] = []
    const batchArtifacts: FactoryMutationBatchArtifact[] = []
    singleFactory.subscribeToMutationBatchArtifact((artifact) =>
      singleArtifacts.push(artifact)
    )
    batchFactory.subscribeToMutationBatchArtifact((artifact) =>
      batchArtifacts.push(artifact)
    )
    const event = createUpdateEvent('batch-of-one', 0, 1)

    singleFactory.startTransaction()
    singleFactory.updateTransaction(event)
    singleFactory.endTransaction()

    batchFactory.startTransaction()
    batchFactory.updateTransactionBatch([event])
    batchFactory.endTransaction()

    expect(
      singleArtifacts[0]?.changes.map(({ event: change, inverseEvents }) => ({
        event: change,
        inverseEvents
      }))
    ).toEqual(
      batchArtifacts[0]?.changes.map(({ event: change, inverseEvents }) => ({
        event: change,
        inverseEvents
      }))
    )
    expect(singleArtifacts[0]?.deliveryPlan).toEqual(
      batchArtifacts[0]?.deliveryPlan
    )
  })

  it('shares unchanged frozen subtrees when capturing a built-in inverse', () => {
    const factory = new Factory()
    const artifacts: FactoryMutationBatchArtifact[] = []
    factory.subscribeToMutationBatchArtifact((artifact) =>
      artifacts.push(artifact)
    )
    const callerOwnedData = {
      id: 'large-vector',
      points: Array.from({ length: 256 }, (_, index) => ({
        x: index,
        y: index * 2
      }))
    }

    factory.startTransaction()
    factory.updateTransaction({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: EventTypes.ADD_ELEMENT,
      payload: {
        undoType: EventTypes.REMOVE_ELEMENT,
        eventName: EventTypes.ADD_ELEMENT,
        data: callerOwnedData
      }
    })
    factory.endTransaction()

    const forward = artifacts[0]?.changes[0]?.event as
      | (AllEvent & {
          payload: {
            data: typeof callerOwnedData
          }
        })
      | undefined
    const inverse = artifacts[0]?.changes[0]?.inverseEvents[0] as
      | (AllEvent & {
          payload: {
            data: typeof callerOwnedData
          }
        })
      | undefined
    expect(forward?.payload).not.toBe(inverse?.payload)
    expect(forward?.payload.data).not.toBe(callerOwnedData)
    expect(inverse?.payload.data).toBe(forward?.payload.data)
    expect(Object.isFrozen(inverse?.payload.data)).toBe(true)
  })

  it('keeps custom inverter input and output detached from canonical evidence', () => {
    const factory = new Factory()
    const artifacts: FactoryMutationBatchArtifact[] = []
    let inverterInput: AllEvent | undefined
    let inverterOutput:
      | (AllEvent & { payload: { graph: { values: number[] } } })
      | undefined
    factory.subscribeToMutationBatchArtifact((artifact) =>
      artifacts.push(artifact)
    )
    factory.registerTransactionInverter('custom.forward', (event) => {
      inverterInput = event
      const inputPayload = (
        event as AllEvent & { payload: { graph: { values: number[] } } }
      ).payload
      inputPayload.graph.values[0] = 99
      inverterOutput = {
        type: 'custom.inverse' as AllEvent['type'],
        payload: { graph: { values: [2, 1] } }
      }
      return inverterOutput
    })

    factory.startTransaction()
    factory.updateTransaction({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: 'custom.forward',
      payload: { graph: { values: [1, 2] } }
    })
    factory.endTransaction()

    const forward = artifacts[0]?.changes[0]?.event as
      | (AllEvent & { payload: { graph: { values: number[] } } })
      | undefined
    const inverse = artifacts[0]?.changes[0]?.inverseEvents[0] as
      | (AllEvent & { payload: { graph: { values: number[] } } })
      | undefined
    expect(inverterInput).not.toBe(forward)
    expect(forward?.payload.graph.values).toEqual([1, 2])
    expect(inverse).not.toBe(inverterOutput)
    expect(inverse?.payload.graph.values).toEqual([2, 1])
  })

  it('rejects a stale delivery handle even when reset reuses transaction ids', () => {
    const factory = new Factory()

    factory.startTransaction()
    const staleHandle = factory.updateTransactionBatch([
      createUpdateEvent('stale-handle', 0, 1)
    ])
    factory.endTransaction()
    factory.transact.reset()

    factory.startTransaction()
    const activeHandle = factory.updateTransactionBatch([
      createUpdateEvent('active-handle', 0, 1)
    ])
    expect(staleHandle?.transactionId).toBe(activeHandle?.transactionId)
    expect(() =>
      staleHandle?.setDeliveryPlan({ mode: 'atomic', slices: [] })
    ).toThrow('Factory mutation batch delivery handle is no longer active')
    expect(() =>
      activeHandle?.setDeliveryPlan({ mode: 'atomic', slices: [] })
    ).not.toThrow()
    factory.endTransaction()
  })

  it('flushes a reentrant commit artifact after an outer rollback settles', () => {
    const factory = new Factory()
    const artifacts: FactoryMutationBatchArtifact[] = []
    const nestedHandles: NonNullable<
      ReturnType<Factory['updateTransaction']>
    >[] = []
    let nested = false
    factory.registerTransactionReplayHandler(
      EventTypes.UPDATE_COMPUTED_DATA,
      () => true
    )
    factory.subscribeToMutationBatchArtifact((artifact) =>
      artifacts.push(artifact)
    )
    factory.subscribeToTransactionStatus(({ status }) => {
      if (status !== 'rolled-back' || nested) return
      nested = true
      factory.startTransaction()
      const handle = factory.updateTransaction(
        createUpdateEvent('nested-after-rollback', 0, 1)
      )
      if (handle) nestedHandles.push(handle)
      factory.endTransaction()
    })

    factory.startTransaction()
    factory.updateTransaction(createUpdateEvent('outer-rollback', 0, 1))
    factory.endTransaction({ outcome: 'rollback' })

    expect(artifacts.map(({ transactionId }) => transactionId)).toEqual([2])
    expect(nestedHandles[0]?.artifact).toBe(artifacts[0])
  })

  it.each(['transaction-end', 'immediate'] as const)(
    'does not publish an isolated Undo inverse for an undelivered %s change',
    (sharedDelivery) => {
      const factory = new Factory()
      const channelName = 'not-yet-registered'
      const artifacts: FactoryMutationBatchArtifact[] = []
      factory.subscribeToMutationBatchArtifact((artifact) =>
        artifacts.push(artifact)
      )
      factory.registerTransactionReplayHandler(
        EventTypes.UPDATE_COMPUTED_DATA,
        (event) => {
          factory.updateTransaction({
            type: TransactionEventTypes.UPDATE_TRANSACTION,
            eventName: event.type,
            payload: (event as AllEvent & { payload: unknown }).payload,
            options: { shared: channelName }
          })
          return true
        }
      )

      factory.startTransaction()
      factory.updateTransaction({
        ...createUpdateEvent('undelivered-forward', 0, 1),
        options: { shared: channelName, sharedDelivery }
      })
      factory.endTransaction()

      expect(artifacts).toHaveLength(1)
      expect(artifacts[0]?.changes[0]?.shared?.deliveryIds).toEqual([])

      const projected: unknown[] = []
      factory.registerSharedDataChannel(
        channelName,
        new LocalSharedDataChannel()
      )
      factory.observeSharedDataChannel(channelName, (change) =>
        projected.push(change)
      )
      factory.undo()

      expect(projected).toEqual([])
    }
  )
})
