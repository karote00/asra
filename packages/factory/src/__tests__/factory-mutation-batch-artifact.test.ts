import { describe, expect, it, vi } from 'vitest'
import {
  EventTypes,
  TransactionEventTypes,
  type AllEvent,
  type UpdateTransactionEvent
} from '@asyra/reactive-events'
import { SCENE_TREE_ACTIONS, SharedDataChannelNames } from '@asyra/utils'
import {
  Factory,
  LocalSharedDataChannel,
  type FactoryMutationBatchArtifact,
  type FactoryMutationBatchArtifactStatus,
  type SharedDeliveryBatch,
  type SharedPublication
} from '..'
import { deepFreezeValue } from '../value-clone'

const update = (
  factory: Factory,
  id: string,
  before: number,
  after: number,
  sharedDelivery: 'transaction-end' | 'immediate' = 'transaction-end'
) => {
  factory.updateTransaction({
    type: TransactionEventTypes.UPDATE_TRANSACTION,
    eventName: EventTypes.UPDATE_PROPERTY,
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
  after: number,
  canonicalEvidence?: UpdateTransactionEvent['canonicalEvidence']
): Parameters<Factory['updateTransaction']>[0] => ({
  type: TransactionEventTypes.UPDATE_TRANSACTION,
  eventName: EventTypes.UPDATE_PROPERTY,
  payload: { id, before, after },
  canonicalEvidence
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
  it('reuses one already-immutable owner batch at the artifact boundary', () => {
    const factory = new Factory()
    const artifacts: FactoryMutationBatchArtifact[] = []
    factory.subscribeToMutationBatchArtifact((artifact) =>
      artifacts.push(artifact)
    )
    const payload = {
      id: 'immutable-owner-evidence',
      before: { width: 1 },
      after: { width: 2 }
    }
    const event = {
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: EventTypes.UPDATE_PROPERTY,
      payload
    }
    const events = deepFreezeValue([event])

    factory.startTransaction()
    factory.updateTransactionBatch(events)
    factory.endTransaction()

    expect(artifacts).toHaveLength(1)
    expect(payloadOf(artifacts[0]?.changes[0]?.event)).toBe(payload)
  })

  it('combines whole canonical owner batches into one history artifact', () => {
    const factory = new Factory()
    factory.registerSharedDataChannel(
      SharedDataChannelNames.PROPS,
      new LocalSharedDataChannel()
    )
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      new LocalSharedDataChannel()
    )
    const artifacts: FactoryMutationBatchArtifact[] = []
    const propsProjection: unknown[][] = []
    const sceneProjection: unknown[][] = []
    factory.subscribeToMutationBatchArtifact((artifact) =>
      artifacts.push(artifact)
    )
    factory.observeSharedDataChannelBatch(
      SharedDataChannelNames.PROPS,
      (changes) => propsProjection.push([...changes])
    )
    factory.observeSharedDataChannelBatch(
      SharedDataChannelNames.SCENE_TREE,
      (changes) => sceneProjection.push([...changes])
    )

    factory.startTransaction()
    factory.updateTransactionBatch([
      {
        type: TransactionEventTypes.UPDATE_TRANSACTION,
        eventName: EventTypes.UPDATE_PROPERTY,
        payload: {
          id: 'stroke-a',
          before: { width: 1 },
          after: { width: 2 }
        },
        options: { shared: SharedDataChannelNames.PROPS }
      }
    ])
    factory.updateTransactionBatch([
      {
        type: TransactionEventTypes.UPDATE_TRANSACTION,
        eventName: EventTypes.ADD_ELEMENT,
        payload: {
          id: 'element-a',
          undoType: EventTypes.REMOVE_ELEMENT,
          data: { id: 'element-a', type: 'vector' }
        },
        options: { shared: SharedDataChannelNames.SCENE_TREE }
      }
    ])
    factory.endTransaction()

    expect(artifacts).toHaveLength(1)
    expect(artifacts[0]?.changes.map(({ event }) => event.type)).toEqual([
      EventTypes.UPDATE_PROPERTY,
      EventTypes.ADD_ELEMENT
    ])
    expect(
      (
        factory.transact as unknown as {
          undoStack: FactoryMutationBatchArtifact[]
        }
      ).undoStack
    ).toEqual([artifacts[0]])
    expect(propsProjection).toHaveLength(1)
    expect(sceneProjection).toHaveLength(1)
    expect(sceneProjection[0]).toEqual([
      expect.objectContaining({ id: 'element-a' })
    ])
  })

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
    const handle = factory.updateTransactionBatch([
      {
        ...createUpdateEvent('element-a', 0, 1),
        options: { shared: SharedDataChannelNames.SCENE_TREE },
        canonicalEvidence: { orderedIds: ['element-a'] }
      },
      {
        ...createUpdateEvent('element-b', 1, 2),
        options: { shared: SharedDataChannelNames.SCENE_TREE },
        canonicalEvidence: { orderedIds: ['element-b'] }
      }
    ])
    expect(handle).not.toBeNull()
    expect(handle?.artifact).toBeNull()
    handle?.setDeliverySequence({
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
      handle?.setDeliverySequence({ mode: 'atomic', slices: [] })
    ).toThrow('Factory staged artifact controller is no longer active')
    expect(artifact).toMatchObject({
      artifactId: '1:artifact',
      transactionId: 1,
      origin: 'action',
      orderedChangeIds: ['1:change:0', '1:change:1'],
      deliverySequence: {
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

  it('emits progressive and committed artifact status through one immutable observer stream', () => {
    const factory = new Factory()
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      new LocalSharedDataChannel()
    )
    const statuses: FactoryMutationBatchArtifactStatus[] = []
    const artifacts: FactoryMutationBatchArtifact[] = []
    factory.subscribeToMutationBatchArtifactStatus((status) => {
      const firstPayload =
        status.status === 'staged'
          ? status.batches[0]?.deliveries[0]?.payload
          : payloadOf(status.artifact.changes[0]?.event)
      if (firstPayload) {
        ;(
          firstPayload as {
            after: number
          }
        ).after = 99
      }
      throw new Error('isolated artifact status observer')
    })
    factory.subscribeToMutationBatchArtifactStatus((status) =>
      statuses.push(status)
    )
    factory.subscribeToMutationBatchArtifact((artifact) =>
      artifacts.push(artifact)
    )

    factory.startTransaction()
    factory.updateTransactionBatch([
      {
        ...createUpdateEvent('element-a', 0, 1),
        options: { shared: SharedDataChannelNames.SCENE_TREE },
        canonicalEvidence: { orderedIds: ['element-a'] }
      },
      {
        ...createUpdateEvent('element-b', 1, 2),
        options: { shared: SharedDataChannelNames.SCENE_TREE },
        canonicalEvidence: { orderedIds: ['element-b'] }
      }
    ])
    const controller = factory.getActiveStagedArtifactController()
    controller?.setDeliverySequence({
      mode: 'progressive',
      slices: [
        { sliceId: 'slice-a', orderedIds: ['element-a'] },
        { sliceId: 'slice-b', orderedIds: ['element-b'] }
      ]
    })
    controller?.stageSlice('slice-a')
    controller?.stageSlice('slice-b')
    factory.endTransaction()

    expect(statuses.map(({ status }) => status)).toEqual([
      'staged',
      'staged',
      'committed'
    ])
    expect(
      statuses.map((status) =>
        status.status === 'staged'
          ? {
              sliceId: status.sliceId,
              orderedIds: status.orderedIds
            }
          : { sliceId: undefined, orderedIds: undefined }
      )
    ).toEqual([
      { sliceId: 'slice-a', orderedIds: ['element-a'] },
      { sliceId: 'slice-b', orderedIds: ['element-b'] },
      { sliceId: undefined, orderedIds: undefined }
    ])
    expect(artifacts).toHaveLength(1)
    const stagedStatuses = statuses.filter(
      (status) => status.status === 'staged'
    )
    const committedStatus = statuses.find(
      (status) => status.status === 'committed'
    )
    expect(
      committedStatus?.status === 'committed'
        ? committedStatus.artifact
        : undefined
    ).toBe(artifacts[0])
    expect(
      stagedStatuses.every(({ batches }) =>
        batches.every((batch) => artifacts[0]?.batches.includes(batch))
      )
    ).toBe(true)
    expect(
      committedStatus?.status === 'committed'
        ? payloadOf(committedStatus.artifact.changes[0]?.event)
        : undefined
    ).toMatchObject({ after: 1 })
    statuses.forEach((status) => expectDeeplyFrozen(status))
  })

  it('owns render-only progressive staging independently from canonical updates and shared publication', () => {
    const factory = new Factory()
    const statuses: FactoryMutationBatchArtifactStatus[] = []
    const publications = vi.fn()
    factory.subscribeToMutationBatchArtifactStatus((status) =>
      statuses.push(status)
    )
    factory.subscribeToSharedPublication(publications)

    expect(factory.getActiveStagedArtifactController()).toBeNull()
    factory.startTransaction()
    const controller = factory.getActiveStagedArtifactController()
    expect(controller).toMatchObject({
      artifactId: '1:artifact',
      transactionId: 1
    })
    expect(Object.keys(controller ?? {}).sort()).toEqual([
      'artifactId',
      'setDeliverySequence',
      'stageSlice',
      'transactionId'
    ])
    factory.updateTransactionBatch([
      createUpdateEvent('local-only-stage', 0, 1, {
        orderedIds: ['local-only-stage']
      })
    ])
    controller?.setDeliverySequence({
      mode: 'progressive',
      slices: [
        {
          sliceId: 'local-slice',
          orderedIds: ['local-only-stage']
        }
      ]
    })
    controller?.stageSlice('local-slice')
    factory.endTransaction()

    expect(statuses.map(({ status }) => status)).toEqual([
      'staged',
      'committed'
    ])
    const stagedStatus = statuses[0]
    expect(
      stagedStatus?.status === 'staged' ? stagedStatus.batches : undefined
    ).toEqual([])
    const committedStatus = statuses.find(
      (status) => status.status === 'committed'
    )
    expect(
      committedStatus?.status === 'committed'
        ? committedStatus.artifact.changes[0]?.orderedIds
        : undefined
    ).toEqual(['local-only-stage'])
    expect(publications).not.toHaveBeenCalled()
    expect(factory.getActiveStagedArtifactController()).toBeNull()
    expect(() => controller?.stageSlice('local-slice')).toThrow(
      'Factory staged artifact controller is no longer active'
    )
  })

  it.each([
    [
      'before canonical evidence is recorded',
      false,
      'Factory mutation delivery sequence must cover every canonical id exactly once'
    ],
    [
      'when its ordered ids do not match canonical evidence',
      true,
      'Factory mutation ordered id is not assigned to a progressive delivery slice: canonical-element'
    ]
  ])(
    'rejects a staged slice %s',
    (_case, recordCanonicalEvidence, expectedError) => {
      const factory = new Factory()
      const stagedStatuses: FactoryMutationBatchArtifactStatus[] = []
      factory.subscribeToMutationBatchArtifactStatus((status) => {
        if (status.status === 'staged') stagedStatuses.push(status)
      })

      factory.startTransaction()
      const controller = factory.getActiveStagedArtifactController()
      if (recordCanonicalEvidence) {
        factory.updateTransactionBatch([
          createUpdateEvent('canonical-element', 0, 1, {
            orderedIds: ['canonical-element']
          })
        ])
      }
      controller?.setDeliverySequence({
        mode: 'progressive',
        slices: [
          {
            sliceId: 'fabricated-slice',
            orderedIds: ['fabricated-element']
          }
        ]
      })

      expect(() => controller?.stageSlice('fabricated-slice')).toThrow(
        expectedError
      )
      expect(stagedStatuses).toEqual([])
      expect(() => factory.endTransaction()).not.toThrow()
    }
  )

  it('emits no artifact status for an empty transaction and only rolled-back status for a reverted action', () => {
    const factory = new Factory()
    const statuses: FactoryMutationBatchArtifactStatus[] = []
    const artifacts = vi.fn()
    factory.subscribeToMutationBatchArtifactStatus((status) =>
      statuses.push(status)
    )
    factory.subscribeToMutationBatchArtifact(artifacts)

    factory.startTransaction()
    factory.endTransaction()
    expect(statuses).toEqual([])

    factory.startTransaction()
    factory.updateTransaction(createUpdateEvent('rolled-back', 0, 1))
    factory.endTransaction({ outcome: 'rollback' })

    expect(statuses.map(({ status }) => status)).toEqual(['rolled-back'])
    const rolledBackStatus = statuses[0]
    expect(
      rolledBackStatus?.status === 'rolled-back'
        ? rolledBackStatus.artifact.changes
        : []
    ).toHaveLength(1)
    expect(artifacts).not.toHaveBeenCalled()
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
      EventTypes.UPDATE_PROPERTY,
      (event) => {
        const payload = (
          event as AllEvent & {
            payload: { id: string; before: number; after: number }
          }
        ).payload
        values.set(payload.id, payload.after)
        factory.updateTransaction({
          type: TransactionEventTypes.UPDATE_TRANSACTION,
          eventName: EventTypes.UPDATE_PROPERTY,
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
      eventName: EventTypes.UPDATE_PROPERTY,
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
    expect(singleArtifacts[0]?.deliverySequence).toEqual(
      batchArtifacts[0]?.deliverySequence
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

  it('derives one canonical inverse for a multi-record framework batch', () => {
    const factory = new Factory()
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      new LocalSharedDataChannel()
    )
    const transact = factory.transact as unknown as {
      createReplayEvents: (
        event: AllEvent,
        direction: 'forward' | 'inverse',
        provenance?: 'detached' | 'factory-owned-journal'
      ) => AllEvent[]
    }
    const createReplayEvents = transact.createReplayEvents.bind(
      factory.transact
    )
    const inverseCalls: AllEvent[] = []
    transact.createReplayEvents = (event, direction, provenance) => {
      if (direction === 'inverse') {
        inverseCalls.push(event)
      }
      return createReplayEvents(event, direction, provenance)
    }
    const entries = [
      { data: { id: 'element-a' }, parentId: 'group', index: 0 },
      { data: { id: 'element-b' }, parentId: 'group', index: 1 }
    ]
    const payload = {
      action: SCENE_TREE_ACTIONS.ADD_ELEMENTS,
      eventName: EventTypes.ADD_ELEMENTS,
      undoType: EventTypes.REMOVE_ELEMENTS,
      undoAction: SCENE_TREE_ACTIONS.REMOVE_ELEMENTS,
      entries
    }

    factory.startTransaction()
    factory.updateTransactionBatch([
      {
        type: TransactionEventTypes.UPDATE_TRANSACTION,
        eventName: EventTypes.ADD_ELEMENTS,
        payload,
        options: { shared: SharedDataChannelNames.SCENE_TREE },
        canonicalEvidence: {
          orderedIds: ['element-a', 'element-b'],
          sharedRecords: entries.map((entry) => ({
            orderedIds: [entry.data.id],
            payload: {
              ...payload,
              entries: [entry]
            }
          }))
        }
      }
    ])
    factory.endTransaction()

    expect(inverseCalls).toHaveLength(1)
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
      staleHandle?.setDeliverySequence({ mode: 'atomic', slices: [] })
    ).toThrow('Factory staged artifact controller is no longer active')
    expect(() =>
      activeHandle?.setDeliverySequence({ mode: 'atomic', slices: [] })
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
      EventTypes.UPDATE_PROPERTY,
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
      const statuses: FactoryMutationBatchArtifactStatus[] = []
      factory.subscribeToMutationBatchArtifact((artifact) =>
        artifacts.push(artifact)
      )
      factory.subscribeToMutationBatchArtifactStatus((status) =>
        statuses.push(status)
      )
      factory.registerTransactionReplayHandler(
        EventTypes.UPDATE_PROPERTY,
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
      const committedStatus = statuses.find(
        (status) => status.status === 'committed'
      )
      expect(
        committedStatus?.status === 'committed'
          ? committedStatus.appliedResult.deliveryIds
          : undefined
      ).toEqual([])

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
