import { describe, expect, it, vi } from 'vitest'
import {
  EventTypes,
  TransactionEventTypes,
  subscribeToUserActionCompleted,
  type AllEvent,
  type UpdateTransactionEvent
} from '@asyra/reactive-events'
import {
  PROPS_ACTIONS,
  SCENE_TREE_ACTIONS,
  SharedDataChannelNames
} from '@asyra/utils'
import {
  Factory,
  LocalSharedDataChannel,
  TransactionRollbackError,
  type SharedDataChannel,
  type SharedDeliveryBatch,
  type SharedPublication
} from '..'

const update = (
  factory: Factory,
  id: string,
  after: number,
  options: {
    sharedDelivery?: 'transaction-end' | 'immediate'
  } = {}
) => {
  return factory.updateTransaction(createUpdateEvent(id, after, options))
}

const createUpdateEvent = (
  id: string,
  after: number,
  options: {
    sharedDelivery?: 'transaction-end' | 'immediate'
  } = {},
  canonicalEvidence?: UpdateTransactionEvent['canonicalEvidence']
): Parameters<Factory['updateTransaction']>[0] => ({
  type: TransactionEventTypes.UPDATE_TRANSACTION,
  eventName: EventTypes.UPDATE_PROPERTY,
  payload: { id, before: after - 1, after },
  options: {
    shared: SharedDataChannelNames.SCENE_TREE,
    ...options
  },
  canonicalEvidence
})

const createHarness = () => {
  const factory = new Factory()
  const channel = new LocalSharedDataChannel()
  factory.registerSharedDataChannel(SharedDataChannelNames.SCENE_TREE, channel)
  const projected: unknown[] = []
  const projectedBatches: (readonly unknown[])[] = []
  factory.observeSharedDataChannel(
    SharedDataChannelNames.SCENE_TREE,
    (change) => projected.push(change)
  )
  factory.observeSharedDataChannelBatch(
    SharedDataChannelNames.SCENE_TREE,
    (batch) => projectedBatches.push(batch)
  )
  const publications: SharedPublication[] = []
  const deliveryBatches: SharedDeliveryBatch[] = []
  factory.subscribeToSharedDeliveryBatch((batch) => deliveryBatches.push(batch))
  factory.subscribeToSharedPublication((publication) =>
    publications.push(publication)
  )
  return {
    factory,
    projected,
    projectedBatches,
    publications,
    deliveryBatches
  }
}

const publicationBatches = (publication: SharedPublication) =>
  publication.slices.flatMap(({ batches }) => batches)

const publicationDeliveries = (publication: SharedPublication) =>
  publicationBatches(publication).flatMap(({ deliveries }) => deliveries)

const requiredAt = <T>(values: readonly T[], index: number): T => {
  const value = values[index]
  if (value === undefined) {
    throw new Error(`Expected value at index ${index}`)
  }
  return value
}

describe('Factory action-level shared publication', () => {
  it('exposes one minimal ordered transport hierarchy with only actual rollback links', () => {
    interface TransportDelivery {
      readonly deliveryId: string
      readonly eventName: string
      readonly orderedIds: readonly string[]
      readonly payload: unknown
      readonly compensatesDeliveryId?: string
    }
    interface TransportBatch {
      readonly batchId: string
      readonly channel: string
      readonly deliveries: readonly TransportDelivery[]
    }
    interface TransportSlice {
      readonly sliceId: string
      readonly orderedIds: readonly string[]
      readonly batches: readonly TransportBatch[]
    }
    interface TransportPublication {
      readonly publicationId: string
      readonly artifactId: string
      readonly transactionId: number
      readonly origin: string
      readonly mode: 'atomic' | 'progressive'
      readonly slices: readonly TransportSlice[]
      readonly compensatesPublicationId?: string
    }
    const asTransportPublication = (
      publication: SharedPublication
    ): TransportPublication => publication as unknown as TransportPublication
    const exactOwnKeys = (
      label: string,
      value: object,
      expected: readonly string[]
    ) => {
      expect(Object.keys(value).sort(), label).toEqual([...expected].sort())
    }
    const expectTransportShape = (
      publication: TransportPublication,
      kind: 'forward' | 'compensation',
      publicationIndex: number
    ) => {
      const isCompensation = kind === 'compensation'
      exactOwnKeys(
        `${kind} publication ${publicationIndex} must expose only the transport contract and an actual correlation`,
        publication,
        [
          'publicationId',
          'artifactId',
          'transactionId',
          'origin',
          'mode',
          'slices',
          ...(isCompensation ? ['compensatesPublicationId'] : [])
        ]
      )
      publication.slices.forEach((slice, sliceIndex) => {
        exactOwnKeys(
          `${kind} slice ${publicationIndex}:${sliceIndex} must own its ordered channel batches`,
          slice,
          ['sliceId', 'orderedIds', 'batches']
        )
        slice.batches.forEach((batch, batchIndex) => {
          exactOwnKeys(
            `${kind} batch ${publicationIndex}:${sliceIndex}:${batchIndex} must expose no local aliases`,
            batch,
            ['batchId', 'channel', 'deliveries']
          )
          batch.deliveries.forEach((delivery, deliveryIndex) => {
            exactOwnKeys(
              `${kind} delivery ${publicationIndex}:${sliceIndex}:${batchIndex}:${deliveryIndex} must expose one remote-apply payload and only an actual correlation`,
              delivery,
              [
                'deliveryId',
                'eventName',
                'orderedIds',
                'payload',
                ...(isCompensation ? ['compensatesDeliveryId'] : [])
              ]
            )
          })
        })
      })
    }

    const { factory, publications } = createHarness()
    factory.registerTransactionReplayHandler(
      EventTypes.UPDATE_PROPERTY,
      () => true
    )

    factory.startTransaction()
    const handle = factory.updateTransactionBatch([
      createUpdateEvent('element-a', 1, {}, { orderedIds: ['element-a'] }),
      createUpdateEvent('element-b', 2, {}, { orderedIds: ['element-b'] })
    ])
    handle?.setDeliverySequence({
      mode: 'progressive',
      slices: [
        { sliceId: 'slice-a', orderedIds: ['element-a'] },
        { sliceId: 'slice-b', orderedIds: ['element-b'] }
      ]
    })
    handle?.deliverSlice('slice-a')
    handle?.deliverSlice('slice-b')

    const forwardPublications = publications.slice().map(asTransportPublication)
    expect(forwardPublications).toHaveLength(2)

    factory.endTransaction({ outcome: 'rollback' })

    const compensationPublications = publications
      .slice(forwardPublications.length)
      .map(asTransportPublication)
    expect(compensationPublications).toHaveLength(2)

    forwardPublications.forEach((publication, publicationIndex) =>
      expectTransportShape(publication, 'forward', publicationIndex)
    )

    expect(
      forwardPublications.flatMap(({ slices }) =>
        slices.map(({ orderedIds }) => orderedIds)
      )
    ).toEqual([['element-a'], ['element-b']])
    expect(
      forwardPublications.flatMap(({ slices }) =>
        slices.flatMap(({ batches }) =>
          batches.flatMap(({ deliveries }) =>
            deliveries.map(({ deliveryId }) => deliveryId)
          )
        )
      )
    ).toEqual(['1:0:forward', '1:1:forward'])

    compensationPublications.forEach((publication, publicationIndex) =>
      expectTransportShape(publication, 'compensation', publicationIndex)
    )

    expect(
      compensationPublications.map(
        ({ compensatesPublicationId }) => compensatesPublicationId
      )
    ).toEqual(
      forwardPublications.map(({ publicationId }) => publicationId).reverse()
    )
    expect(
      compensationPublications.flatMap(({ slices }) =>
        slices.map(({ orderedIds }) => orderedIds)
      )
    ).toEqual([['element-b'], ['element-a']])
    expect(
      compensationPublications.flatMap(({ slices }) =>
        slices.flatMap(({ batches }) =>
          batches.flatMap(({ deliveries }) =>
            deliveries.map(({ compensatesDeliveryId }) => compensatesDeliveryId)
          )
        )
      )
    ).toEqual(['1:1:forward', '1:0:forward'])
  })

  it('emits detached settlement spans for channel delivery and publication', () => {
    const runtimeGlobal = globalThis as typeof globalThis & {
      __asyraBrowserDragPhaseSink?: (name: string, durationMs: number) => void
    }
    const previous = runtimeGlobal.__asyraBrowserDragPhaseSink
    const phaseNames: string[] = []
    runtimeGlobal.__asyraBrowserDragPhaseSink = (name) => phaseNames.push(name)
    const { factory } = createHarness()

    try {
      factory.startTransaction()
      update(factory, 'element-a', 1)
      update(factory, 'element-b', 2)
      factory.endTransaction()
    } finally {
      runtimeGlobal.__asyraBrowserDragPhaseSink = previous
    }

    expect(phaseNames).toEqual(
      expect.arrayContaining([
        'factory:owner-batch-clone',
        'factory:shared-payload-normalize',
        'factory:flush-shared-channels',
        'factory:shared-channel-append',
        'factory:shared-channel-observer',
        'factory:create-shared-publication',
        'factory:notify-shared-publication'
      ])
    )
    expect(phaseNames).not.toContain('factory:shared-channel-boundary-clone')
    expect(phaseNames).not.toContain('factory:shared-sink-boundary-clone')
  })

  it('publishes hierarchy changes as one uninterpreted transaction group', () => {
    const { factory, publications } = createHarness()

    factory.startTransaction()
    factory.updateTransaction({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: EventTypes.MOVE_ELEMENTS,
      payload: {
        action: SCENE_TREE_ACTIONS.MOVE_ELEMENTS,
        eventName: EventTypes.MOVE_ELEMENTS,
        moves: [
          {
            elementId: 'element-a',
            before: { parentId: 'workspace', index: 0 },
            after: { parentId: 'group-a', index: 0 }
          }
        ]
      },
      options: { shared: SharedDataChannelNames.SCENE_TREE }
    })
    factory.updateTransaction({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: EventTypes.CHANGE_SUBTREE,
      payload: {
        action: SCENE_TREE_ACTIONS.REMOVE_SUBTREE,
        undoAction: SCENE_TREE_ACTIONS.RESTORE_SUBTREE,
        eventName: EventTypes.CHANGE_SUBTREE,
        elementId: 'group-b',
        removed: [],
        rootParentChildrenAfter: []
      },
      options: { shared: SharedDataChannelNames.SCENE_TREE }
    })
    factory.endTransaction()

    expect(publications).toHaveLength(1)
    expect(publicationDeliveries(requiredAt(publications, 0))).toEqual([
      expect.objectContaining({
        eventName: EventTypes.MOVE_ELEMENTS,
        payload: expect.objectContaining({
          action: SCENE_TREE_ACTIONS.MOVE_ELEMENTS
        })
      }),
      expect.objectContaining({
        eventName: EventTypes.CHANGE_SUBTREE,
        payload: expect.objectContaining({
          action: SCENE_TREE_ACTIONS.REMOVE_SUBTREE
        })
      })
    ])
  })

  it('batches synchronous immediate deliveries before the outer undo transaction ends', async () => {
    const { factory, projected, publications, deliveryBatches } =
      createHarness()

    factory.startTransaction()
    update(factory, 'element-a', 1, { sharedDelivery: 'immediate' })
    update(factory, 'element-a', 2, { sharedDelivery: 'immediate' })
    update(factory, 'element-b', 3, { sharedDelivery: 'immediate' })

    expect(projected).toHaveLength(3)
    expect(publications).toEqual([])
    await Promise.resolve()

    expect(publications).toHaveLength(1)
    expect(publications[0]).toMatchObject({
      publicationId: '1:publication:1',
      artifactId: '1:artifact',
      transactionId: 1,
      origin: 'action'
    })
    expect(publicationDeliveries(requiredAt(publications, 0))).toEqual([
      expect.objectContaining({
        deliveryId: '1:0:forward',
        payload: expect.objectContaining({ id: 'element-a', after: 1 })
      }),
      expect.objectContaining({
        deliveryId: '1:1:forward',
        payload: expect.objectContaining({ id: 'element-a', after: 2 })
      }),
      expect.objectContaining({
        deliveryId: '1:2:forward',
        payload: expect.objectContaining({ id: 'element-b', after: 3 })
      })
    ])
    expect(publicationBatches(requiredAt(publications, 0))).toHaveLength(3)
    expect(
      publicationBatches(requiredAt(publications, 0)).map((batch) =>
        batch.deliveries.map((delivery) => delivery.deliveryId)
      )
    ).toEqual([['1:0:forward'], ['1:1:forward'], ['1:2:forward']])
    expect(
      publicationBatches(requiredAt(publications, 0)).every(
        (batch) => Object.isFrozen(batch) && Object.isFrozen(batch.deliveries)
      )
    ).toBe(true)

    const settlementCounts = {
      projected: projected.length,
      deliveryBatches: deliveryBatches.length,
      deliveryRecords: deliveryBatches.flatMap(({ deliveries }) => deliveries)
        .length,
      publications: publications.length
    }
    factory.endTransaction()
    expect({
      projected: projected.length,
      deliveryBatches: deliveryBatches.length,
      deliveryRecords: deliveryBatches.flatMap(({ deliveries }) => deliveries)
        .length,
      publications: publications.length
    }).toEqual(settlementCounts)
  })

  it('delivers configured progressive slices from one canonical batch without resending at commit', () => {
    const { factory, projectedBatches, publications } = createHarness()

    factory.startTransaction()
    const handle = factory.updateTransactionBatch([
      createUpdateEvent('element-a', 1, {}, { orderedIds: ['element-a'] }),
      createUpdateEvent('element-b', 2, {}, { orderedIds: ['element-b'] }),
      createUpdateEvent('element-c', 3, {}, { orderedIds: ['element-c'] })
    ])
    handle?.setDeliverySequence({
      mode: 'progressive',
      slices: [
        {
          sliceId: 'slice-a',
          orderedIds: ['element-a', 'element-b']
        },
        { sliceId: 'slice-b', orderedIds: ['element-c'] }
      ]
    })

    handle?.deliverSlice('slice-a')
    expect(
      projectedBatches.map((batch) =>
        batch.map((change) => (change as { id: string }).id)
      )
    ).toEqual([['element-a', 'element-b']])
    expect(publications).toHaveLength(1)

    handle?.deliverSlice('slice-b')
    expect(
      projectedBatches.map((batch) =>
        batch.map((change) => (change as { id: string }).id)
      )
    ).toEqual([['element-a', 'element-b'], ['element-c']])
    expect(publications).toHaveLength(2)

    factory.endTransaction()

    expect(projectedBatches).toHaveLength(2)
    expect(publications).toHaveLength(2)
    expect(
      publications.flatMap(({ slices }) => slices.map(({ sliceId }) => sliceId))
    ).toEqual(['slice-a', 'slice-b'])
    expect(
      (factory.transact as unknown as { undoStack: unknown[] }).undoStack
    ).toHaveLength(1)
  })

  it('projects explicit one-to-many shared records without rerunning the canonical event', () => {
    const { factory, projectedBatches, publications } = createHarness()

    factory.startTransaction()
    const handle = factory.updateTransactionBatch([
      createUpdateEvent(
        'canonical-batch',
        1,
        {},
        {
          orderedIds: ['element-a', 'element-b'],
          sharedRecords: [
            {
              orderedIds: ['element-a'],
              payload: { id: 'element-a', before: 0, after: 1 }
            },
            {
              orderedIds: ['element-a'],
              payload: { id: 'element-a', before: 1, after: 2 }
            },
            {
              orderedIds: ['element-b'],
              payload: { id: 'element-b', before: 0, after: 1 }
            }
          ]
        }
      )
    ])
    handle?.setDeliverySequence({
      mode: 'progressive',
      slices: [
        { sliceId: 'slice-a', orderedIds: ['element-a'] },
        { sliceId: 'slice-b', orderedIds: ['element-b'] }
      ]
    })

    handle?.deliverSlice('slice-a')
    handle?.deliverSlice('slice-b')
    factory.endTransaction()

    expect(projectedBatches).toEqual([
      [
        expect.objectContaining({ id: 'element-a', after: 1 }),
        expect.objectContaining({ id: 'element-a', after: 2 })
      ],
      [expect.objectContaining({ id: 'element-b', after: 1 })]
    ])
    expect(publications).toHaveLength(2)
    const transportDeliveries = publications.flatMap(publicationDeliveries)
    expect(
      transportDeliveries.map(({ orderedIds, payload }) => ({
        orderedIds,
        payload
      }))
    ).toEqual([
      {
        orderedIds: ['element-a'],
        payload: expect.objectContaining({ id: 'element-a', after: 1 })
      },
      {
        orderedIds: ['element-a'],
        payload: expect.objectContaining({ id: 'element-a', after: 2 })
      },
      {
        orderedIds: ['element-b'],
        payload: expect.objectContaining({ id: 'element-b', after: 1 })
      }
    ])
    expect(
      (factory.transact as unknown as { undoStack: unknown[] }).undoStack
    ).toHaveLength(1)
  })

  it('reuses explicit record inverses for one complete Undo and Redo action', () => {
    const { factory, publications } = createHarness()
    factory.registerTransactionReplayHandler(
      EventTypes.UPDATE_PROPERTY,
      (event) => {
        factory.updateTransaction({
          type: TransactionEventTypes.UPDATE_TRANSACTION,
          eventName: event.type,
          payload: (event as AllEvent & { payload: unknown }).payload,
          options: { shared: SharedDataChannelNames.SCENE_TREE }
        })
        return true
      }
    )

    factory.startTransaction()
    const handle = factory.updateTransactionBatch([
      createUpdateEvent(
        'canonical-history',
        1,
        {},
        {
          orderedIds: ['element-a', 'element-b'],
          sharedRecords: [
            {
              orderedIds: ['element-a'],
              payload: { id: 'element-a', before: 0, after: 1 }
            },
            {
              orderedIds: ['element-b'],
              payload: { id: 'element-b', before: 0, after: 2 }
            }
          ]
        }
      )
    ])
    handle?.setDeliverySequence({
      mode: 'progressive',
      slices: [
        { sliceId: 'slice-a', orderedIds: ['element-a'] },
        { sliceId: 'slice-b', orderedIds: ['element-b'] }
      ]
    })
    handle?.deliverSlice('slice-a')
    handle?.deliverSlice('slice-b')
    factory.endTransaction()
    publications.length = 0

    factory.undo()
    expect(
      publications.flatMap(publicationDeliveries).map(({ payload }) => payload)
    ).toEqual([
      expect.objectContaining({ id: 'element-b', after: 0 }),
      expect.objectContaining({ id: 'element-a', after: 0 })
    ])
    expect(
      (factory.transact as unknown as { redoStack: unknown[] }).redoStack
    ).toHaveLength(1)

    publications.length = 0
    factory.redo()
    expect(
      publications.flatMap(publicationDeliveries).map(({ payload }) => payload)
    ).toEqual([
      expect.objectContaining({ id: 'element-a', after: 1 }),
      expect.objectContaining({ id: 'element-b', after: 2 })
    ])
    expect(
      (factory.transact as unknown as { undoStack: unknown[] }).undoStack
    ).toHaveLength(1)
  })

  it.each([
    {
      name: 'canonical ordered ids are empty',
      canonicalEvidence: { orderedIds: [] },
      expected: /at least one canonical ordered id/
    },
    {
      name: 'canonical ordered ids contain a duplicate',
      canonicalEvidence: { orderedIds: ['element-a', 'element-a'] },
      expected: /duplicate canonical ordered id/
    },
    {
      name: 'explicit shared records are empty',
      canonicalEvidence: { orderedIds: ['element-a'], sharedRecords: [] },
      expected: /at least one shared record/
    },
    {
      name: 'one shared record has no ordered ids',
      canonicalEvidence: {
        orderedIds: ['element-a'],
        sharedRecords: [{ orderedIds: [], payload: { id: 'element-a' } }]
      },
      expected: /at least one ordered id/
    },
    {
      name: 'a shared record contains an unknown ordered id',
      canonicalEvidence: {
        orderedIds: ['element-a'],
        sharedRecords: [
          { orderedIds: ['element-b'], payload: { id: 'element-b' } }
        ]
      },
      expected: /unknown canonical ordered id/
    },
    {
      name: 'shared records omit one canonical ordered id',
      canonicalEvidence: {
        orderedIds: ['element-a', 'element-b'],
        sharedRecords: [
          { orderedIds: ['element-a'], payload: { id: 'element-a' } }
        ]
      },
      expected: /cover every canonical ordered id/
    },
    {
      name: 'shared record first occurrences reorder canonical ids',
      canonicalEvidence: {
        orderedIds: ['element-a', 'element-b'],
        sharedRecords: [
          { orderedIds: ['element-b'], payload: { id: 'element-b' } },
          { orderedIds: ['element-a'], payload: { id: 'element-a' } }
        ]
      },
      expected: /preserve canonical ordered id order/
    }
  ])(
    'rejects invalid canonical event evidence when $name',
    ({ canonicalEvidence, expected }) => {
      const { factory } = createHarness()
      factory.startTransaction()

      expect(() =>
        factory.updateTransactionBatch([
          createUpdateEvent('canonical-invalid', 1, {}, canonicalEvidence)
        ])
      ).toThrow(expected)
      factory.endTransaction({ outcome: 'rollback' })
    }
  )

  it('rejects a shared record that spans two formal slices', () => {
    const { factory } = createHarness()
    factory.startTransaction()
    const handle = factory.updateTransactionBatch([
      createUpdateEvent(
        'canonical-spanning-record',
        1,
        {},
        {
          orderedIds: ['element-a', 'element-b'],
          sharedRecords: [
            {
              orderedIds: ['element-a', 'element-b'],
              payload: { id: 'one-semantic-fragment', before: 0, after: 1 }
            }
          ]
        }
      )
    ])
    handle?.setDeliverySequence({
      mode: 'progressive',
      slices: [
        { sliceId: 'slice-a', orderedIds: ['element-a'] },
        { sliceId: 'slice-b', orderedIds: ['element-b'] }
      ]
    })

    expect(() => handle?.deliverSlice('slice-a')).toThrow(
      /shared record .* cannot span delivery slices/
    )
    factory.endTransaction({ outcome: 'rollback' })
  })

  it.each([
    {
      name: 'omits a canonical id',
      slices: [{ sliceId: 'slice-a', orderedIds: ['element-a'] }],
      expected: /not assigned to a progressive delivery slice/
    },
    {
      name: 'adds an unknown canonical id',
      slices: [
        { sliceId: 'slice-a', orderedIds: ['element-a'] },
        { sliceId: 'slice-b', orderedIds: ['element-b'] },
        { sliceId: 'slice-c', orderedIds: ['element-c'] }
      ],
      expected: /cover every canonical id exactly once/
    },
    {
      name: 'reorders canonical ids',
      slices: [
        { sliceId: 'slice-b', orderedIds: ['element-b'] },
        { sliceId: 'slice-a', orderedIds: ['element-a'] }
      ],
      expected: /preserve canonical order/
    },
    {
      name: 'duplicates one canonical id',
      slices: [
        { sliceId: 'slice-a', orderedIds: ['element-a'] },
        { sliceId: 'slice-b', orderedIds: ['element-a', 'element-b'] }
      ],
      expected: /duplicate ordered id/
    },
    {
      name: 'contains an empty formal slice',
      slices: [
        { sliceId: 'slice-a', orderedIds: ['element-a'] },
        { sliceId: 'slice-b', orderedIds: ['element-b'] },
        { sliceId: 'slice-empty', orderedIds: [] }
      ],
      expected: /empty progressive slice/
    }
  ])(
    'rejects a progressive delivery sequence that $name',
    ({ slices, expected }) => {
      const { factory } = createHarness()
      factory.startTransaction()
      const handle = factory.updateTransactionBatch([
        createUpdateEvent(
          'canonical-invalid-sequence',
          1,
          {},
          {
            orderedIds: ['element-a', 'element-b'],
            sharedRecords: [
              {
                orderedIds: ['element-a'],
                payload: { id: 'element-a', before: 0, after: 1 }
              },
              {
                orderedIds: ['element-b'],
                payload: { id: 'element-b', before: 0, after: 1 }
              }
            ]
          }
        )
      ])

      expect(() => {
        handle?.setDeliverySequence({ mode: 'progressive', slices })
        const firstSliceId = slices[0]?.sliceId
        if (firstSliceId) handle?.deliverSlice(firstSliceId)
      }).toThrow(expected)
      factory.endTransaction({ outcome: 'rollback' })
    }
  )

  it.each([
    {
      name: 'out of order',
      deliver: (
        handle: NonNullable<ReturnType<Factory['updateTransactionBatch']>>
      ) => handle.deliverSlice('slice-b'),
      expected: /sequence order: slice-a/
    },
    {
      name: 'more than once',
      deliver: (
        handle: NonNullable<ReturnType<Factory['updateTransactionBatch']>>
      ) => {
        handle.deliverSlice('slice-a')
        handle.deliverSlice('slice-a')
      },
      expected: /sequence order: slice-b/
    }
  ])('rejects delivery of one formal slice $name', ({ deliver, expected }) => {
    const { factory } = createHarness()
    factory.startTransaction()
    const handle = factory.updateTransactionBatch([
      createUpdateEvent('element-a', 1, {}, { orderedIds: ['element-a'] }),
      createUpdateEvent('element-b', 2, {}, { orderedIds: ['element-b'] })
    ])
    handle?.setDeliverySequence({
      mode: 'progressive',
      slices: [
        { sliceId: 'slice-a', orderedIds: ['element-a'] },
        { sliceId: 'slice-b', orderedIds: ['element-b'] }
      ]
    })

    expect(() => {
      if (handle) deliver(handle)
    }).toThrow(expected)
    factory.endTransaction({ outcome: 'rollback' })
  })

  it('indexes formal slice records once before progressive delivery', () => {
    const runtimeGlobal = globalThis as typeof globalThis & {
      __asyraBrowserDragPhaseSink?: (name: string, durationMs: number) => void
    }
    const previous = runtimeGlobal.__asyraBrowserDragPhaseSink
    const phaseNames: string[] = []
    runtimeGlobal.__asyraBrowserDragPhaseSink = (name) => phaseNames.push(name)
    const { factory } = createHarness()
    const orderedIds = Array.from(
      { length: 16 },
      (_, index) => `element-${index}`
    )
    let canonicalOrderScans = 0

    try {
      factory.startTransaction()
      const handle = factory.updateTransactionBatch([
        createUpdateEvent(
          'canonical-index',
          1,
          {},
          {
            orderedIds,
            sharedRecords: orderedIds.map((id, index) => ({
              orderedIds: [id],
              payload: { id, before: 0, after: index + 1 }
            }))
          }
        )
      ])
      const entry = (
        factory.transact as unknown as {
          journal: {
            orderedIds: readonly string[]
          }[]
        }
      ).journal[0]
      if (entry) {
        entry.orderedIds = new Proxy(entry.orderedIds, {
          get(target, property, receiver) {
            if (property === 'forEach') canonicalOrderScans += 1
            return Reflect.get(target, property, receiver)
          }
        })
      }
      handle?.setDeliverySequence({
        mode: 'progressive',
        slices: orderedIds.map((id, index) => ({
          sliceId: `slice-${index}`,
          orderedIds: [id]
        }))
      })
      orderedIds.forEach((_, index) => handle?.deliverSlice(`slice-${index}`))
      factory.endTransaction()
    } finally {
      runtimeGlobal.__asyraBrowserDragPhaseSink = previous
    }

    expect(
      phaseNames.filter(
        (phaseName) => phaseName === 'factory:index-shared-delivery-records'
      )
    ).toHaveLength(1)
    expect(
      phaseNames.filter(
        (phaseName) => phaseName === 'factory:prepare-shared-record-inverses'
      )
    ).toHaveLength(1)
    expect(canonicalOrderScans).toBe(1)
  })

  it('blocks all canonical controls during shared evidence notification without poisoning the outer action', () => {
    const { factory } = createHarness()
    const attempts: string[] = []
    let handle: ReturnType<Factory['updateTransactionBatch']> = null
    let attempted = false
    const attempt = (operation: () => void) => {
      try {
        operation()
        attempts.push('allowed')
      } catch (error) {
        attempts.push(error instanceof Error ? error.message : String(error))
      }
    }
    factory.observeSharedDataChannelBatch(
      SharedDataChannelNames.SCENE_TREE,
      () => {
        if (attempted) return
        attempted = true
        attempt(() => {
          factory.updateTransaction(createUpdateEvent('reentrant-single', 2))
        })
        attempt(() => {
          factory.updateTransactionBatch([
            createUpdateEvent('reentrant-batch', 3)
          ])
        })
        attempt(() => {
          handle?.setDeliverySequence({ mode: 'atomic', slices: [] })
        })
        attempt(() => {
          handle?.deliverSlice('slice-b')
        })
      }
    )
    factory.startTransaction()
    handle = factory.updateTransactionBatch([
      createUpdateEvent(
        'canonical-reentrancy',
        1,
        {},
        {
          orderedIds: ['element-a', 'element-b'],
          sharedRecords: [
            {
              orderedIds: ['element-a'],
              payload: { id: 'element-a', before: 0, after: 1 }
            },
            {
              orderedIds: ['element-b'],
              payload: { id: 'element-b', before: 0, after: 1 }
            }
          ]
        }
      )
    ])
    handle?.setDeliverySequence({
      mode: 'progressive',
      slices: [
        { sliceId: 'slice-a', orderedIds: ['element-a'] },
        { sliceId: 'slice-b', orderedIds: ['element-b'] }
      ]
    })
    handle?.deliverSlice('slice-a')
    handle?.deliverSlice('slice-b')
    factory.endTransaction()

    expect(attempts).toEqual(
      Array(4).fill(
        'Factory shared evidence observers cannot mutate canonical transaction controls'
      )
    )
    expect(factory.getUndoHistoryDepth()).toBe(1)
  })

  it('preserves reverse progressive slice semantics for rollback compensation', () => {
    const { factory, publications } = createHarness()
    const runtimeGlobal = globalThis as typeof globalThis & {
      __asyraBrowserDragPhaseSink?: (name: string, durationMs: number) => void
    }
    const previous = runtimeGlobal.__asyraBrowserDragPhaseSink
    const phaseNames: string[] = []
    factory.registerTransactionReplayHandler(
      EventTypes.UPDATE_PROPERTY,
      () => true
    )

    factory.startTransaction()
    const handle = factory.updateTransactionBatch([
      createUpdateEvent('element-a', 1, {}, { orderedIds: ['element-a'] }),
      createUpdateEvent('element-b', 2, {}, { orderedIds: ['element-b'] })
    ])
    handle?.setDeliverySequence({
      mode: 'progressive',
      slices: [
        { sliceId: 'slice-a', orderedIds: ['element-a'] },
        { sliceId: 'slice-b', orderedIds: ['element-b'] }
      ]
    })
    handle?.deliverSlice('slice-a')
    handle?.deliverSlice('slice-b')
    runtimeGlobal.__asyraBrowserDragPhaseSink = (name) => phaseNames.push(name)
    try {
      factory.endTransaction({ outcome: 'rollback' })
    } finally {
      runtimeGlobal.__asyraBrowserDragPhaseSink = previous
    }

    expect(publications.map(({ origin }) => origin)).toEqual([
      'action',
      'action',
      'rollback-compensation',
      'rollback-compensation'
    ])
    const compensations = publications.slice(2)
    expect(
      compensations.every((publication) => publication.mode === 'progressive')
    ).toBe(true)
    expect(
      compensations.flatMap(({ slices }) =>
        slices.map(({ orderedIds }) => orderedIds)
      )
    ).toEqual([['element-b'], ['element-a']])
    expect(
      compensations.map(
        ({ compensatesPublicationId }) => compensatesPublicationId
      )
    ).toEqual(
      publications
        .slice(0, 2)
        .map(({ publicationId }) => publicationId)
        .reverse()
    )
    expect(phaseNames).not.toContain('factory:index-compensation-records')
  })

  it('preserves one history action when ordinary immediate delivery follows progressive slices', async () => {
    const { factory, publications } = createHarness()
    factory.registerTransactionReplayHandler(
      EventTypes.UPDATE_PROPERTY,
      (event) => {
        factory.updateTransaction({
          type: TransactionEventTypes.UPDATE_TRANSACTION,
          eventName: event.type,
          payload: (event as AllEvent & { payload: unknown }).payload,
          options: { shared: SharedDataChannelNames.SCENE_TREE }
        })
        return true
      }
    )

    factory.startTransaction()
    const handle = factory.updateTransactionBatch([
      createUpdateEvent(
        'composition-a',
        1,
        {},
        { orderedIds: ['composition-a'] }
      ),
      createUpdateEvent(
        'composition-b',
        2,
        {},
        { orderedIds: ['composition-b'] }
      )
    ])
    handle?.setDeliverySequence({
      mode: 'progressive',
      slices: [
        { sliceId: 'composition-a', orderedIds: ['composition-a'] },
        { sliceId: 'composition-b', orderedIds: ['composition-b'] }
      ]
    })
    handle?.deliverSlice('composition-a')
    handle?.deliverSlice('composition-b')
    expect(() =>
      update(factory, 'ordinary-immediate', 3, {
        sharedDelivery: 'immediate'
      })
    ).not.toThrow()
    await Promise.resolve()
    factory.endTransaction()

    expect(
      (factory.transact as unknown as { undoStack: unknown[] }).undoStack
    ).toHaveLength(1)

    publications.length = 0
    let undoFailure: TransactionRollbackError | undefined
    try {
      factory.undo()
    } catch (error) {
      if (error instanceof TransactionRollbackError) {
        undoFailure = error
      } else {
        throw error
      }
    }
    expect(undoFailure?.failures ?? []).toEqual([])
    expect(undoFailure).toBeUndefined()
    expect(
      (factory.transact as unknown as { redoStack: unknown[] }).redoStack
    ).toHaveLength(1)
    expect(
      publications.flatMap((publication) =>
        publicationBatches(publication).map(({ deliveries }) =>
          deliveries.map(({ payload }) => (payload as { id: string }).id)
        )
      )
    ).toEqual([['ordinary-immediate'], ['composition-b'], ['composition-a']])
    publications.length = 0
    expect(() => factory.redo()).not.toThrow()
    expect(
      (factory.transact as unknown as { undoStack: unknown[] }).undoStack
    ).toHaveLength(1)
    expect(
      publications.flatMap((publication) =>
        publicationBatches(publication).map(({ deliveries }) =>
          deliveries.map(({ payload }) => (payload as { id: string }).id)
        )
      )
    ).toEqual([['composition-a'], ['composition-b'], ['ordinary-immediate']])
  })

  it('compensates mixed progressive slices and later immediate delivery in reverse publication order', async () => {
    const { factory, publications, deliveryBatches } = createHarness()
    factory.registerTransactionReplayHandler(
      EventTypes.UPDATE_PROPERTY,
      () => true
    )

    factory.startTransaction()
    const handle = factory.updateTransactionBatch([
      createUpdateEvent(
        'composition-a',
        1,
        {},
        { orderedIds: ['composition-a'] }
      ),
      createUpdateEvent(
        'composition-b',
        2,
        {},
        { orderedIds: ['composition-b'] }
      )
    ])
    handle?.setDeliverySequence({
      mode: 'progressive',
      slices: [
        { sliceId: 'composition-a', orderedIds: ['composition-a'] },
        { sliceId: 'composition-b', orderedIds: ['composition-b'] }
      ]
    })
    handle?.deliverSlice('composition-a')
    handle?.deliverSlice('composition-b')
    update(factory, 'ordinary-immediate', 3, {
      sharedDelivery: 'immediate'
    })
    await Promise.resolve()

    expect(
      deliveryBatches.map(({ deliveries, sharedDelivery }) => ({
        elementIds: deliveries.map(
          ({ payload }) => (payload as { id: string }).id
        ),
        sharedDelivery
      }))
    ).toEqual([
      {
        elementIds: ['composition-a'],
        sharedDelivery: 'transaction-end'
      },
      {
        elementIds: ['composition-b'],
        sharedDelivery: 'transaction-end'
      },
      {
        elementIds: ['ordinary-immediate'],
        sharedDelivery: 'immediate'
      }
    ])

    const forwardPublicationCount = publications.length
    factory.endTransaction({ outcome: 'rollback' })

    const compensations = publications.slice(forwardPublicationCount)
    expect(compensations).toHaveLength(3)
    expect(
      compensations.every(
        (publication) => publication.origin === 'rollback-compensation'
      )
    ).toBe(true)
    expect(
      compensations.map(
        ({ compensatesPublicationId }) => compensatesPublicationId
      )
    ).toEqual(
      publications
        .slice(0, forwardPublicationCount)
        .map(({ publicationId }) => publicationId)
        .reverse()
    )
    expect(
      compensations.flatMap((publication) =>
        publicationBatches(publication).map(({ deliveries }) =>
          deliveries.map(({ payload }) => (payload as { id: string }).id)
        )
      )
    ).toEqual([['ordinary-immediate'], ['composition-b'], ['composition-a']])
    expect(
      (factory.transact as unknown as { undoStack: unknown[] }).undoStack
    ).toEqual([])
  })

  it('rejects ordinary immediate delivery until every sequenced slice has been delivered', () => {
    const { factory, publications } = createHarness()
    factory.registerTransactionReplayHandler(
      EventTypes.UPDATE_PROPERTY,
      () => true
    )

    factory.startTransaction()
    const handle = factory.updateTransactionBatch([
      createUpdateEvent(
        'composition-a',
        1,
        {},
        { orderedIds: ['composition-a'] }
      ),
      createUpdateEvent(
        'composition-b',
        2,
        {},
        { orderedIds: ['composition-b'] }
      )
    ])
    handle?.setDeliverySequence({
      mode: 'progressive',
      slices: [
        { sliceId: 'composition-a', orderedIds: ['composition-a'] },
        { sliceId: 'composition-b', orderedIds: ['composition-b'] }
      ]
    })
    handle?.deliverSlice('composition-a')

    expect(() =>
      update(factory, 'ordinary-immediate', 3, {
        sharedDelivery: 'immediate'
      })
    ).toThrow(
      'Factory mutation immediate delivery requires every progressive slice to be delivered first'
    )
    expect(() => factory.endTransaction()).not.toThrow()

    expect(
      publications.flatMap((publication) =>
        publicationBatches(publication).map(({ deliveries }) =>
          deliveries.map(({ payload }) => (payload as { id: string }).id)
        )
      )
    ).toEqual([['composition-a'], ['composition-a']])
  })

  it('replays formal slices before a later immediate change when the replay handler records no journal entry', () => {
    const { factory, publications } = createHarness()
    factory.registerTransactionReplayHandler(
      EventTypes.UPDATE_PROPERTY,
      () => true
    )

    factory.startTransaction()
    const handle = factory.updateTransactionBatch([
      createUpdateEvent(
        'composition-a',
        1,
        {},
        { orderedIds: ['composition-a'] }
      ),
      createUpdateEvent(
        'composition-b',
        2,
        {},
        { orderedIds: ['composition-b'] }
      )
    ])
    handle?.setDeliverySequence({
      mode: 'progressive',
      slices: [
        { sliceId: 'composition-a', orderedIds: ['composition-a'] },
        { sliceId: 'composition-b', orderedIds: ['composition-b'] }
      ]
    })
    handle?.deliverSlice('composition-a')
    handle?.deliverSlice('composition-b')
    update(factory, 'ordinary-immediate', 3, {
      sharedDelivery: 'immediate'
    })
    factory.endTransaction()

    publications.length = 0
    factory.undo()
    publications.length = 0
    factory.redo()

    expect(
      publications.flatMap((publication) =>
        publicationBatches(publication).map(({ deliveries }) =>
          deliveries.map(({ payload }) => (payload as { id: string }).id)
        )
      )
    ).toEqual([['composition-a'], ['composition-b'], ['ordinary-immediate']])
    expect(publications.map(({ mode }) => mode)).toEqual([
      'progressive',
      'progressive',
      'progressive'
    ])
  })

  it('still rejects a later transaction-end mutation after progressive slice preparation', () => {
    const { factory } = createHarness()
    factory.registerTransactionReplayHandler(
      EventTypes.UPDATE_PROPERTY,
      () => true
    )

    factory.startTransaction()
    const handle = factory.updateTransactionBatch([
      createUpdateEvent(
        'composition-a',
        1,
        {},
        { orderedIds: ['composition-a'] }
      )
    ])
    handle?.setDeliverySequence({
      mode: 'progressive',
      slices: [{ sliceId: 'composition-a', orderedIds: ['composition-a'] }]
    })
    handle?.deliverSlice('composition-a')

    expect(() => update(factory, 'late-transaction-end', 2)).toThrow(
      'cannot change after progressive delivery preparation'
    )
    expect(() => factory.endTransaction({ outcome: 'rollback' })).not.toThrow()
  })

  it('rejects a late progressive sequence after immediate delivery and rolls the action back', () => {
    const { factory, projectedBatches, publications } = createHarness()
    factory.registerTransactionReplayHandler(
      EventTypes.UPDATE_PROPERTY,
      () => true
    )

    factory.startTransaction()
    const handle = factory.updateTransactionBatch([
      createUpdateEvent(
        'already-immediate',
        1,
        { sharedDelivery: 'immediate' },
        { orderedIds: ['already-immediate'] }
      )
    ])
    expect(() =>
      handle?.setDeliverySequence({
        mode: 'progressive',
        slices: [{ sliceId: 'too-late', orderedIds: ['already-immediate'] }]
      })
    ).toThrow('cannot include an already delivered immediate ordered id')
    expect(() => factory.endTransaction()).not.toThrow()

    expect(projectedBatches).toHaveLength(2)
    expect(publications).toEqual([])
  })

  it('publishes compensation for an earlier formal slice when a later slice delivery fails', () => {
    const deliveryFailure = new Error('later formal slice failed')
    const sourceHandlers = new Set<(changes: readonly unknown[]) => void>()
    let appendCount = 0
    const channel: SharedDataChannel = {
      appendBatch: (changes) => {
        appendCount += 1
        if (appendCount === 2) throw deliveryFailure
        ;[...sourceHandlers].forEach((handler) => handler(changes))
      },
      observeBatch: (handler) => {
        sourceHandlers.add(handler)
        return () => sourceHandlers.delete(handler)
      }
    }
    const factory = new Factory()
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      channel
    )
    factory.registerTransactionReplayHandler(
      EventTypes.UPDATE_PROPERTY,
      () => true
    )
    const projectedBatches: (readonly unknown[])[] = []
    const publications: SharedPublication[] = []
    factory.observeSharedDataChannelBatch(
      SharedDataChannelNames.SCENE_TREE,
      (batch) => projectedBatches.push(batch)
    )
    factory.subscribeToSharedPublication((publication) =>
      publications.push(publication)
    )

    factory.startTransaction()
    const handle = factory.updateTransactionBatch([
      createUpdateEvent(
        'slice-success',
        1,
        {},
        { orderedIds: ['slice-success'] }
      ),
      createUpdateEvent(
        'slice-failure',
        2,
        {},
        { orderedIds: ['slice-failure'] }
      )
    ])
    handle?.setDeliverySequence({
      mode: 'progressive',
      slices: [
        { sliceId: 'slice-success', orderedIds: ['slice-success'] },
        { sliceId: 'slice-failure', orderedIds: ['slice-failure'] }
      ]
    })

    expect(() => factory.endTransaction()).toThrow(deliveryFailure)
    expect(
      projectedBatches.map((batch) =>
        batch.map((change) => {
          const payload = change as { id: string; after: number }
          return `${payload.id}:${payload.after}`
        })
      )
    ).toEqual([['slice-success:1'], ['slice-success:0']])
    expect(publications.map(({ origin }) => origin)).toEqual([
      'action',
      'rollback-compensation'
    ])
    expect(
      (factory.transact as unknown as { undoStack: unknown[] }).undoStack
    ).toEqual([])
  })

  it('publishes transaction-end changes only after the outer transaction commits', async () => {
    const { factory, publications } = createHarness()

    factory.startTransaction()
    update(factory, 'element-a', 1)
    update(factory, 'element-b', 2)

    await Promise.resolve()
    expect(publications).toEqual([])

    factory.endTransaction()

    expect(publications).toHaveLength(1)
    expect(publicationDeliveries(requiredAt(publications, 0))).toHaveLength(2)
    expect(publications[0]?.publicationId).toBe('1:publication:1')
  })

  it('discards an immediate batch that rolls back before its publication flush', async () => {
    const { factory, projected, publications } = createHarness()

    factory.startTransaction()
    update(factory, 'element-a', 1, { sharedDelivery: 'immediate' })
    update(factory, 'element-a', 2, { sharedDelivery: 'immediate' })
    factory.endTransaction({ outcome: 'rollback' })
    await Promise.resolve()

    expect(projected).toHaveLength(4)
    expect(publications).toEqual([])
  })

  it('does not publish compensation for an immediate batch that never crossed the Factory publication boundary', async () => {
    const factory = new Factory()
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      new LocalSharedDataChannel()
    )
    const projectedBatches: (readonly unknown[])[] = []
    factory.observeSharedDataChannelBatch(
      SharedDataChannelNames.SCENE_TREE,
      (batch) => projectedBatches.push(batch)
    )

    factory.startTransaction()
    factory.updateTransactionBatch([
      createUpdateEvent('locally-delivered-only', 1, {
        sharedDelivery: 'immediate'
      })
    ])
    await Promise.resolve()

    expect(projectedBatches).toHaveLength(1)
    const laterPublications: SharedPublication[] = []
    factory.subscribeToSharedPublication((publication) =>
      laterPublications.push(publication)
    )
    factory.endTransaction({ outcome: 'rollback' })

    expect(projectedBatches).toHaveLength(2)
    expect(laterPublications).toEqual([])
  })

  it('publishes an unacknowledged immediate batch as the committed remainder', async () => {
    const factory = new Factory()
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      new LocalSharedDataChannel()
    )

    factory.startTransaction()
    factory.updateTransactionBatch([
      createUpdateEvent('unacknowledged-until-commit', 1, {
        sharedDelivery: 'immediate'
      })
    ])
    await Promise.resolve()

    const committedPublications: SharedPublication[] = []
    factory.subscribeToSharedPublication((publication) =>
      committedPublications.push(publication)
    )
    factory.endTransaction()

    expect(committedPublications).toHaveLength(1)
    expect(committedPublications[0]).toEqual(
      expect.objectContaining({
        publicationId: '1:publication:1',
        origin: 'action'
      })
    )
    expect(publicationDeliveries(requiredAt(committedPublications, 0))).toEqual(
      [
        expect.objectContaining({
          payload: expect.objectContaining({
            id: 'unacknowledged-until-commit'
          })
        })
      ]
    )
  })

  it('does not acknowledge an immediate publication when every subscriber rejects it', async () => {
    const factory = new Factory()
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      new LocalSharedDataChannel()
    )
    const unsubscribeRejecting = factory.subscribeToSharedPublication(() => {
      throw new Error('publication handoff failed')
    })

    factory.startTransaction()
    factory.updateTransactionBatch([
      createUpdateEvent('rejected-publication', 1, {
        sharedDelivery: 'immediate'
      })
    ])
    await Promise.resolve()
    unsubscribeRejecting()

    const rollbackPublications: SharedPublication[] = []
    factory.subscribeToSharedPublication((publication) =>
      rollbackPublications.push(publication)
    )
    factory.endTransaction({ outcome: 'rollback' })

    expect(rollbackPublications).toEqual([])
  })

  it('keeps reserved compensation identities local and publishes only actual acknowledged correlations', async () => {
    const factory = new Factory()
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      new LocalSharedDataChannel()
    )
    const deliveredForwardBatches: SharedDeliveryBatch[] = []
    factory.subscribeToSharedDeliveryBatch((batch) => {
      if (batch.kind === 'forward') deliveredForwardBatches.push(batch)
    })
    const acknowledgedPublications: SharedPublication[] = []
    const unsubscribeForward = factory.subscribeToSharedPublication(
      (publication) => acknowledgedPublications.push(publication)
    )

    factory.startTransaction()
    factory.updateTransactionBatch([
      createUpdateEvent('acknowledged', 1, {
        sharedDelivery: 'immediate'
      })
    ])
    await Promise.resolve()

    expect(acknowledgedPublications).toHaveLength(1)
    const forwardPublication = requiredAt(acknowledgedPublications, 0)
    const forwardBatch = deliveredForwardBatches[0]
    const forwardDelivery = forwardBatch?.deliveries[0]
    expect
      .soft(Object.keys(forwardPublication))
      .not.toContain('compensationPublicationId')
    expect.soft(forwardBatch?.compensationBatchId).toEqual(expect.any(String))
    expect
      .soft(forwardDelivery?.compensationDeliveryIds)
      .toEqual([expect.any(String)])

    unsubscribeForward()
    factory.updateTransactionBatch([
      createUpdateEvent('local-only-after-unsubscribe', 2, {
        sharedDelivery: 'immediate'
      })
    ])
    await Promise.resolve()
    expect(deliveredForwardBatches).toHaveLength(2)
    const unacknowledgedBatchId = deliveredForwardBatches[1]?.batchId

    const rollbackPublications: SharedPublication[] = []
    factory.subscribeToSharedPublication((publication) =>
      rollbackPublications.push(publication)
    )
    factory.endTransaction({ outcome: 'rollback' })

    expect.soft(rollbackPublications).toHaveLength(1)
    const compensationPublication = rollbackPublications[0]
    const compensationBatch = compensationPublication
      ? publicationBatches(compensationPublication)[0]
      : undefined
    const compensationDelivery = compensationBatch?.deliveries[0]
    expect
      .soft(compensationPublication?.publicationId)
      .toBe(`${forwardPublication.publicationId}:compensation`)
    expect
      .soft(compensationPublication?.compensatesPublicationId)
      .toBe(forwardPublication.publicationId)
    expect
      .soft(
        compensationPublication
          ? publicationBatches(compensationPublication)
          : []
      )
      .toHaveLength(1)
    expect
      .soft(compensationBatch?.batchId)
      .toBe(forwardBatch?.compensationBatchId)
    expect.soft(compensationBatch?.batchId).not.toBe(unacknowledgedBatchId)
    expect
      .soft(compensationDelivery?.deliveryId)
      .toBe(forwardDelivery?.compensationDeliveryIds?.[0])
    expect
      .soft(compensationDelivery?.compensatesDeliveryId)
      .toBe(forwardDelivery?.deliveryId)

    const commitHarness = createHarness()
    commitHarness.factory.startTransaction()
    commitHarness.factory.updateTransactionBatch([
      createUpdateEvent('commit-once', 1, {
        sharedDelivery: 'immediate'
      })
    ])
    await Promise.resolve()
    expect(commitHarness.publications).toHaveLength(1)
    commitHarness.factory.endTransaction()
    expect(commitHarness.publications).toHaveLength(1)
  })

  it('publishes one linked compensation batch when an immediate action rolls back after flush', async () => {
    const { factory, publications } = createHarness()

    factory.startTransaction()
    update(factory, 'element-a', 1, { sharedDelivery: 'immediate' })
    update(factory, 'element-b', 2, { sharedDelivery: 'immediate' })
    await Promise.resolve()

    expect(publications).toHaveLength(1)
    const forwardPublicationId = publications[0]?.publicationId
    const forwardArtifactId = publications[0]?.artifactId
    const forwardBatchIds = publicationBatches(requiredAt(publications, 0)).map(
      (batch) => batch.batchId
    )
    factory.endTransaction({ outcome: 'rollback' })

    expect(publications).toHaveLength(2)
    expect(publications[1]).toMatchObject({
      publicationId: `${forwardPublicationId}:compensation`,
      artifactId: forwardArtifactId,
      transactionId: 1,
      origin: 'rollback-compensation',
      compensatesPublicationId: forwardPublicationId
    })
    expect(publicationDeliveries(requiredAt(publications, 1))).toEqual([
      expect.objectContaining({
        compensatesDeliveryId: '1:1:forward'
      }),
      expect.objectContaining({
        compensatesDeliveryId: '1:0:forward'
      })
    ])
    expect(publicationBatches(requiredAt(publications, 1))).toHaveLength(2)
    expect(
      publicationBatches(requiredAt(publications, 1)).map(
        (batch) => batch.batchId
      )
    ).not.toEqual(forwardBatchIds)
  })

  it('compensates one atomic forward batch as one reversed batch with its own sequence', async () => {
    const { factory, projectedBatches, publications } = createHarness()

    factory.startTransaction()
    factory.updateTransactionBatch([
      createUpdateEvent('element-a', 1, { sharedDelivery: 'immediate' }),
      createUpdateEvent('element-b', 2, { sharedDelivery: 'immediate' })
    ])
    await Promise.resolve()

    expect(projectedBatches).toHaveLength(1)
    expect(publications).toHaveLength(1)
    expect(publicationBatches(requiredAt(publications, 0))).toHaveLength(1)
    const forwardPublication = requiredAt(publications, 0)
    const forwardBatch = publicationBatches(forwardPublication)[0]

    factory.endTransaction({ outcome: 'rollback' })

    expect(projectedBatches).toHaveLength(2)
    expect(
      projectedBatches.map((batch) =>
        batch.map((change) => (change as { id: string }).id)
      )
    ).toEqual([
      ['element-a', 'element-b'],
      ['element-b', 'element-a']
    ])
    expect(publications).toHaveLength(2)
    expect(publicationBatches(requiredAt(publications, 1))).toHaveLength(1)
    const compensationBatch = requiredAt(
      publicationBatches(requiredAt(publications, 1)),
      0
    )
    expect(compensationBatch?.batchId).not.toBe(forwardBatch?.batchId)
    expect(publications[1]).toMatchObject({
      mode: 'progressive',
      compensatesPublicationId: forwardPublication.publicationId
    })
    expect(publications[1]?.slices).toEqual([
      expect.objectContaining({
        orderedIds: compensationBatch?.deliveries.map(
          ({ deliveryId }) => deliveryId
        )
      })
    ])
  })

  it('schedules one immediate publication task for one element batch', () => {
    const { factory } = createHarness()
    const scheduled: (() => void)[] = []
    vi.stubGlobal('queueMicrotask', (callback: () => void) => {
      scheduled.push(callback)
    })

    try {
      factory.startTransaction()
      factory.updateTransactionBatch(
        Array.from({ length: 100 }, (_, index) =>
          createUpdateEvent(`element-${index}`, index + 1, {
            sharedDelivery: 'immediate'
          })
        )
      )
      expect(scheduled).toHaveLength(1)
      factory.endTransaction({ outcome: 'rollback' })
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('keeps one immediate canonical owner handoff in one publication slice', async () => {
    const { factory, publications } = createHarness()
    factory.registerSharedDataChannel(
      SharedDataChannelNames.PROPS,
      new LocalSharedDataChannel()
    )

    factory.startTransaction()
    factory.updateTransactionBatch([
      {
        ...createUpdateEvent(
          'props-group',
          1,
          { sharedDelivery: 'immediate' },
          { orderedIds: ['group'] }
        ),
        options: {
          shared: SharedDataChannelNames.PROPS,
          sharedDelivery: 'immediate'
        }
      },
      createUpdateEvent(
        'scene-group',
        2,
        { sharedDelivery: 'immediate' },
        { orderedIds: ['group'] }
      )
    ])
    await Promise.resolve()

    expect(publications).toHaveLength(1)
    expect(publications[0]?.slices).toHaveLength(1)
    expect(
      publications[0]?.slices[0]?.batches.map(({ channel }) => channel)
    ).toEqual([SharedDataChannelNames.PROPS, SharedDataChannelNames.SCENE_TREE])
    expect(
      publications[0]?.slices[0]?.batches.flatMap(({ deliveries }) =>
        deliveries.map(({ deliveryId }) => deliveryId)
      )
    ).toEqual(['1:0:forward', '1:1:forward'])

    factory.endTransaction()
    factory.transact.reset()
  })

  it('compensates every flushed progressive publication in global reverse order when the action rolls back', async () => {
    const { factory, projected, publications } = createHarness()

    factory.startTransaction()
    update(factory, 'element-a', 1, { sharedDelivery: 'immediate' })
    await Promise.resolve()
    update(factory, 'element-b', 2, { sharedDelivery: 'immediate' })
    await Promise.resolve()

    expect(publications).toEqual([
      expect.objectContaining({
        origin: 'action'
      }),
      expect.objectContaining({
        origin: 'action'
      })
    ])
    expect(publications.map(publicationDeliveries)).toEqual([
      [expect.objectContaining({ deliveryId: '1:0:forward' })],
      [expect.objectContaining({ deliveryId: '1:1:forward' })]
    ])

    factory.endTransaction({ outcome: 'rollback' })

    expect(publications).toHaveLength(4)
    expect(publications[2]).toMatchObject({
      publicationId: `${publications[1]?.publicationId}:compensation`,
      transactionId: 1,
      origin: 'rollback-compensation',
      compensatesPublicationId: publications[1]?.publicationId
    })
    expect(publicationDeliveries(requiredAt(publications, 2))).toEqual([
      expect.objectContaining({
        deliveryId: '1:1:compensation:0',
        compensatesDeliveryId: '1:1:forward',
        payload: expect.objectContaining({
          id: 'element-b',
          before: 2,
          after: 1
        })
      })
    ])
    expect(publications[3]).toMatchObject({
      publicationId: `${publications[0]?.publicationId}:compensation`,
      transactionId: 1,
      origin: 'rollback-compensation',
      compensatesPublicationId: publications[0]?.publicationId
    })
    expect(publicationDeliveries(requiredAt(publications, 3))).toEqual([
      expect.objectContaining({
        deliveryId: '1:0:compensation:0',
        compensatesDeliveryId: '1:0:forward',
        payload: expect.objectContaining({
          id: 'element-a',
          before: 1,
          after: 0
        })
      })
    ])
    expect(
      projected.map((change) => {
        const payload = change as { id: string; after: number }
        return `${payload.id}:${payload.after}`
      })
    ).toEqual(['element-a:1', 'element-b:2', 'element-b:1', 'element-a:0'])
    expect(
      publications
        .slice(2)
        .map(({ compensatesPublicationId }) => compensatesPublicationId)
    ).toEqual(
      publications
        .slice(0, 2)
        .map(({ publicationId }) => publicationId)
        .reverse()
    )
    expect(
      (factory.transact as unknown as { undoStack: unknown[] }).undoStack
    ).toEqual([])
    expect(
      (factory.transact as unknown as { redoStack: unknown[] }).redoStack
    ).toEqual([])

    factory.undo()
    factory.redo()
    expect(publications).toHaveLength(4)
  })

  it('creates no publication or history record for a zero-mutation action', async () => {
    const { factory, projected, publications } = createHarness()

    factory.startTransaction()
    factory.endTransaction()
    await Promise.resolve()

    expect(projected).toEqual([])
    expect(publications).toEqual([])
    expect(
      (factory.transact as unknown as { undoStack: unknown[] }).undoStack
    ).toEqual([])
    expect(
      (factory.transact as unknown as { redoStack: unknown[] }).redoStack
    ).toEqual([])

    factory.undo()
    factory.redo()
    expect(publications).toEqual([])
  })

  it('publishes one atomic batch for each multi-change action, undo, and redo transition', () => {
    const { factory, publications } = createHarness()
    factory.registerTransactionReplayHandler(
      EventTypes.UPDATE_PROPERTY,
      () => true
    )

    factory.startTransaction()
    update(factory, 'element-a', 1)
    update(factory, 'element-b', 2)
    factory.endTransaction()

    expect(publications).toHaveLength(1)
    expect(
      publicationDeliveries(requiredAt(publications, 0)).map(
        ({ payload }) => (payload as { id: string }).id
      )
    ).toEqual(['element-a', 'element-b'])
    expect(
      (factory.transact as unknown as { undoStack: unknown[] }).undoStack
    ).toHaveLength(1)
    expect(
      (factory.transact as unknown as { redoStack: unknown[] }).redoStack
    ).toHaveLength(0)
    publications.length = 0

    factory.undo()

    expect(publications).toHaveLength(1)
    expect(publications[0]).toEqual(expect.objectContaining({ origin: 'undo' }))
    expect(publicationDeliveries(requiredAt(publications, 0))).toEqual([
      expect.objectContaining({
        payload: expect.objectContaining({ id: 'element-b' })
      }),
      expect.objectContaining({
        payload: expect.objectContaining({ id: 'element-a' })
      })
    ])
    expect(
      (factory.transact as unknown as { undoStack: unknown[] }).undoStack
    ).toHaveLength(0)
    expect(
      (factory.transact as unknown as { redoStack: unknown[] }).redoStack
    ).toHaveLength(1)

    publications.length = 0
    factory.redo()

    expect(publications).toHaveLength(1)
    expect(publications[0]).toEqual(expect.objectContaining({ origin: 'redo' }))
    expect(publicationDeliveries(requiredAt(publications, 0))).toEqual([
      expect.objectContaining({
        payload: expect.objectContaining({
          id: 'element-a',
          after: 1
        })
      }),
      expect.objectContaining({
        payload: expect.objectContaining({
          id: 'element-b',
          after: 2
        })
      })
    ])
    expect(
      (factory.transact as unknown as { undoStack: unknown[] }).undoStack
    ).toHaveLength(1)
    expect(
      (factory.transact as unknown as { redoStack: unknown[] }).redoStack
    ).toHaveLength(0)
  })

  it('publishes exact Props-before-Scene subtree restore evidence in one undo batch', () => {
    const { factory, publications } = createHarness()
    factory.registerSharedDataChannel(
      SharedDataChannelNames.PROPS,
      new LocalSharedDataChannel()
    )
    factory.registerTransactionReplayHandler(
      EventTypes.ADD_PROPERTY,
      () => true
    )
    factory.registerTransactionReplayHandler(
      EventTypes.CHANGE_SUBTREE,
      () => true
    )
    const propertyData = {
      id: 'position-b',
      type: 'position',
      x: 12,
      y: 24
    }
    const rootParentChildrenAfter = ['element-a', 'element-c']

    factory.startTransaction()
    factory.updateTransaction({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: EventTypes.CHANGE_SUBTREE,
      payload: {
        action: SCENE_TREE_ACTIONS.REMOVE_SUBTREE,
        undoAction: SCENE_TREE_ACTIONS.RESTORE_SUBTREE,
        eventName: EventTypes.CHANGE_SUBTREE,
        elementId: 'group-b',
        removed: [
          {
            elementId: 'group-b',
            parentId: 'workspace',
            index: 1,
            data: {
              id: 'group-b',
              type: 'group',
              name: 'Group B',
              parentId: 'workspace',
              visible: true,
              lock: false,
              children: [],
              props: { position: 'position-b' }
            }
          }
        ],
        rootParentChildrenAfter
      },
      options: { shared: SharedDataChannelNames.SCENE_TREE }
    })
    factory.updateTransaction({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: EventTypes.REMOVE_PROPERTY,
      payload: {
        action: PROPS_ACTIONS.REMOVE_PROPERTY,
        undoType: EventTypes.ADD_PROPERTY,
        undoAction: PROPS_ACTIONS.ADD_PROPERTY,
        eventName: EventTypes.REMOVE_PROPERTY,
        data: [propertyData]
      },
      options: { shared: SharedDataChannelNames.PROPS }
    })
    factory.endTransaction()
    publications.length = 0

    propertyData.x = 999
    rootParentChildrenAfter.push('later-runtime-element')
    factory.undo()

    expect(publications).toHaveLength(1)
    expect(publications[0]).toEqual(expect.objectContaining({ origin: 'undo' }))
    const undoBatches = publicationBatches(requiredAt(publications, 0))
    expect(undoBatches.map(({ channel }) => channel)).toEqual([
      SharedDataChannelNames.PROPS,
      SharedDataChannelNames.SCENE_TREE
    ])
    expect(undoBatches.flatMap(({ deliveries }) => deliveries)).toEqual([
      expect.objectContaining({
        eventName: EventTypes.ADD_PROPERTY,
        payload: expect.objectContaining({
          action: PROPS_ACTIONS.ADD_PROPERTY,
          eventName: EventTypes.ADD_PROPERTY,
          data: [
            expect.objectContaining({
              id: 'position-b',
              x: 12,
              y: 24
            })
          ]
        })
      }),
      expect.objectContaining({
        eventName: EventTypes.CHANGE_SUBTREE,
        payload: expect.objectContaining({
          action: SCENE_TREE_ACTIONS.RESTORE_SUBTREE,
          rootParentChildrenAfter: ['element-a', 'element-c']
        })
      })
    ])
  })

  it('replays progressive publications separately while consuming one undo or redo action', async () => {
    const { factory, publications } = createHarness()
    factory.registerTransactionReplayHandler(
      EventTypes.UPDATE_PROPERTY,
      () => true
    )

    factory.startTransaction()
    update(factory, 'element-a', 1, { sharedDelivery: 'immediate' })
    await Promise.resolve()
    update(factory, 'element-a', 2, { sharedDelivery: 'immediate' })
    await Promise.resolve()
    factory.endTransaction()

    expect(publications).toHaveLength(2)
    publications.length = 0

    factory.undo()

    expect(publications).toHaveLength(2)
    expect(publications.every(({ origin }) => origin === 'undo')).toBe(true)
    expect(publications.map(publicationDeliveries)).toEqual([
      [
        expect.objectContaining({
          payload: expect.objectContaining({ id: 'element-a', after: 1 })
        })
      ],
      [
        expect.objectContaining({
          payload: expect.objectContaining({ id: 'element-a', after: 0 })
        })
      ]
    ])

    publications.length = 0
    factory.redo()

    expect(publications).toHaveLength(2)
    expect(publications.every(({ origin }) => origin === 'redo')).toBe(true)
    expect(publications.map(publicationDeliveries)).toEqual([
      [
        expect.objectContaining({
          payload: expect.objectContaining({ id: 'element-a', after: 1 })
        })
      ],
      [
        expect.objectContaining({
          payload: expect.objectContaining({ id: 'element-a', after: 2 })
        })
      ]
    ])
  })

  it('replays one immediate multi-channel owner batch as one publication', async () => {
    const { factory, publications } = createHarness()
    factory.registerSharedDataChannel(
      SharedDataChannelNames.PROPS,
      new LocalSharedDataChannel()
    )
    factory.registerTransactionReplayHandler(
      EventTypes.UPDATE_PROPERTY,
      () => true
    )

    factory.startTransaction()
    factory.updateTransactionBatch([
      createUpdateEvent('element-a', 1, { sharedDelivery: 'immediate' }),
      {
        ...createUpdateEvent('property-a', 1, {
          sharedDelivery: 'immediate'
        }),
        options: {
          shared: SharedDataChannelNames.PROPS,
          sharedDelivery: 'immediate'
        }
      }
    ])
    await Promise.resolve()
    factory.endTransaction()

    expect(publications).toHaveLength(1)
    expect(
      publicationBatches(requiredAt(publications, 0)).map(
        ({ channel }) => channel
      )
    ).toEqual([SharedDataChannelNames.SCENE_TREE, SharedDataChannelNames.PROPS])

    publications.length = 0
    factory.undo()

    expect(publications).toHaveLength(1)
    expect(publications[0]).toEqual(expect.objectContaining({ origin: 'undo' }))
    expect(
      publicationBatches(requiredAt(publications, 0)).map(
        ({ channel }) => channel
      )
    ).toEqual([SharedDataChannelNames.PROPS, SharedDataChannelNames.SCENE_TREE])

    publications.length = 0
    factory.redo()

    expect(publications).toHaveLength(1)
    expect(publications[0]).toEqual(expect.objectContaining({ origin: 'redo' }))
    expect(
      publicationBatches(requiredAt(publications, 0)).map(
        ({ channel }) => channel
      )
    ).toEqual([SharedDataChannelNames.SCENE_TREE, SharedDataChannelNames.PROPS])
  })

  it('preserves replay order when undo crosses transaction-end and immediate deliveries', async () => {
    const { factory, publications } = createHarness()
    factory.registerTransactionReplayHandler(
      EventTypes.UPDATE_PROPERTY,
      () => true
    )

    factory.startTransaction()
    update(factory, 'immediate-first', 1, {
      sharedDelivery: 'immediate'
    })
    update(factory, 'transaction-end-second', 1)
    factory.endTransaction()
    await Promise.resolve()
    publications.length = 0

    factory.undo()

    expect(
      publications
        .flatMap(publicationDeliveries)
        .map(({ payload }) => (payload as { id?: unknown }).id as string)
    ).toEqual(['transaction-end-second', 'immediate-first'])

    publications.length = 0
    factory.redo()

    expect(
      publications
        .flatMap(publicationDeliveries)
        .map(({ payload }) => (payload as { id?: unknown }).id as string)
    ).toEqual(['immediate-first', 'transaction-end-second'])
  })

  it('compensates already-published progressive replay when a later undo batch fails', async () => {
    const { factory, publications } = createHarness()
    let failSecondReplay = true
    let replayCount = 0
    factory.registerTransactionReplayHandler(EventTypes.UPDATE_PROPERTY, () => {
      replayCount += 1
      if (failSecondReplay && replayCount === 2) {
        throw new Error('later progressive replay failed')
      }
      return true
    })

    factory.startTransaction()
    update(factory, 'element-a', 1, { sharedDelivery: 'immediate' })
    await Promise.resolve()
    update(factory, 'element-a', 2, { sharedDelivery: 'immediate' })
    await Promise.resolve()
    factory.endTransaction()
    publications.length = 0

    expect(() => factory.undo()).toThrow('Transaction rollback failed')
    expect(publications).toHaveLength(2)
    expect(publications[0]).toEqual(expect.objectContaining({ origin: 'undo' }))
    expect(publicationDeliveries(requiredAt(publications, 0))).toEqual([
      expect.objectContaining({
        payload: expect.objectContaining({ after: 1 })
      })
    ])
    expect(publications[1]).toEqual(
      expect.objectContaining({
        origin: 'rollback-compensation',
        compensatesPublicationId: publications[0]?.publicationId
      })
    )
    expect(publicationDeliveries(requiredAt(publications, 1))).toEqual([
      expect.objectContaining({
        payload: expect.objectContaining({ after: 2 }),
        compensatesDeliveryId: expect.any(String)
      })
    ])

    failSecondReplay = false
    replayCount = 0
    publications.length = 0
    factory.undo()

    expect(publications).toHaveLength(2)
    expect(publications.every(({ origin }) => origin === 'undo')).toBe(true)
  })

  it('isolates publication subscribers from commit and from each other', () => {
    const factory = new Factory()
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      new LocalSharedDataChannel()
    )
    const later = vi.fn()
    factory.subscribeToSharedPublication(() => {
      throw new Error('observer failed')
    })
    factory.subscribeToSharedPublication(later)

    factory.startTransaction()
    update(factory, 'element-a', 1)

    expect(() => factory.endTransaction()).not.toThrow()
    expect(later).toHaveBeenCalledTimes(1)
  })

  it('isolates nested publication subscriber mutation from later publication and Undo', () => {
    const factory = new Factory()
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      new LocalSharedDataChannel()
    )
    factory.registerTransactionReplayHandler(
      EventTypes.UPDATE_PROPERTY,
      () => true
    )
    const laterPublications: SharedPublication[] = []
    factory.subscribeToSharedPublication((publication) => {
      const payload = publicationDeliveries(publication)[0]?.payload as {
        after: { value: number }
      }
      payload.after.value = 99
    })
    factory.subscribeToSharedPublication((publication) =>
      laterPublications.push(publication)
    )

    factory.startTransaction()
    factory.updateTransaction({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: EventTypes.UPDATE_PROPERTY,
      payload: {
        id: 'nested-publication-mutation',
        before: { value: 0 },
        after: { value: 1 }
      },
      options: { shared: SharedDataChannelNames.SCENE_TREE }
    })
    factory.endTransaction()

    expect(laterPublications).toEqual([
      expect.objectContaining({ origin: 'action' })
    ])
    expect(publicationDeliveries(requiredAt(laterPublications, 0))).toEqual([
      expect.objectContaining({
        payload: expect.objectContaining({
          before: { value: 0 },
          after: { value: 1 }
        })
      })
    ])

    laterPublications.length = 0
    factory.undo()

    expect(laterPublications).toEqual([
      expect.objectContaining({ origin: 'undo' })
    ])
    expect(publicationDeliveries(requiredAt(laterPublications, 0))).toEqual([
      expect.objectContaining({
        payload: expect.objectContaining({
          before: { value: 1 },
          after: { value: 0 }
        })
      })
    ])
  })

  it('retains the outer publication when a completion observer commits reentrantly', () => {
    const factory = new Factory({ bridgeToReactiveEvents: true })
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      new LocalSharedDataChannel()
    )
    const publications: SharedPublication[] = []
    const committedStatuses: {
      transactionId: number
      changeCount: number
    }[] = []
    factory.subscribeToSharedPublication((publication) =>
      publications.push(publication)
    )
    factory.subscribeToTransactionStatus((status) => {
      if (status.status === 'committed') {
        committedStatuses.push({
          transactionId: status.transactionId,
          changeCount: status.changeCount
        })
      }
    })
    let nested = false
    const nestedHandles: NonNullable<
      ReturnType<Factory['updateTransaction']>
    >[] = []
    const completionSubscription = subscribeToUserActionCompleted(() => {
      if (nested) return
      nested = true
      factory.startTransaction()
      const nestedHandle = update(factory, 'element-nested', 2)
      if (nestedHandle) nestedHandles.push(nestedHandle)
      factory.endTransaction()
    })

    let outerHandle: ReturnType<Factory['updateTransaction']> = null
    try {
      factory.startTransaction()
      outerHandle = update(factory, 'element-outer', 1)
      factory.endTransaction()
    } finally {
      completionSubscription.unsubscribe()
    }

    expect(publications).toHaveLength(2)
    expect(
      publications.flatMap(publicationDeliveries).map(({ payload }) => payload)
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'element-outer', after: 1 }),
        expect.objectContaining({ id: 'element-nested', after: 2 })
      ])
    )
    expect(publications.map(({ transactionId }) => transactionId)).toEqual([
      1, 2
    ])
    expect(outerHandle).not.toHaveProperty('artifact')
    expect(nestedHandles[0]).not.toHaveProperty('artifact')
    expect(committedStatuses).toEqual([
      { transactionId: 1, changeCount: 1 },
      { transactionId: 2, changeCount: 1 }
    ])
  })

  it('does not let a projection observer start a reentrant canonical transaction', () => {
    const factory = new Factory()
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      new LocalSharedDataChannel()
    )
    const publications: SharedPublication[] = []
    const committedTransactionIds: number[] = []
    let nestedAttempted = false
    factory.observeSharedDataChannelBatch(
      SharedDataChannelNames.SCENE_TREE,
      () => {
        if (nestedAttempted) return
        nestedAttempted = true
        factory.startTransaction()
        update(factory, 'element-nested', 2)
        factory.endTransaction()
      }
    )
    factory.subscribeToSharedPublication((publication) =>
      publications.push(publication)
    )
    factory.subscribeToTransactionStatus(({ status, transactionId }) => {
      if (status === 'committed') committedTransactionIds.push(transactionId)
    })

    factory.startTransaction()
    update(factory, 'element-outer', 1)
    factory.endTransaction()

    expect(nestedAttempted).toBe(true)
    expect(publications.map(({ transactionId }) => transactionId)).toEqual([1])
    expect(committedTransactionIds).toEqual([1])
    expect(
      publications.flatMap((publication) =>
        publicationDeliveries(publication).map(
          ({ payload }) => (payload as { id: string }).id
        )
      )
    ).toEqual(['element-outer'])
  })

  it('hands off each commit before a completion observer can commit reentrantly', () => {
    const factory = new Factory({ bridgeToReactiveEvents: true })
    const order: string[] = []
    factory.subscribeToCommitCapture(({ transactionId }) => {
      order.push(`capture-${transactionId}`)
    })
    factory.subscribeToTransactionStatus(({ status, transactionId }) => {
      if (status === 'committed') order.push(`status-${transactionId}`)
    })
    let nested = false
    const completionSubscription = subscribeToUserActionCompleted(() => {
      order.push('completion')
      if (nested) return
      nested = true
      factory.startTransaction()
      update(factory, 'element-nested', 2)
      factory.endTransaction()
    })

    try {
      factory.startTransaction()
      update(factory, 'element-outer', 1)
      factory.endTransaction()
    } finally {
      completionSubscription.unsubscribe()
    }

    expect(order).toEqual([
      'capture-1',
      'completion',
      'capture-2',
      'completion',
      'status-1',
      'status-2'
    ])
  })
})
