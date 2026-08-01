import { describe, expect, it } from 'vitest'
import {
  EventTypes,
  issueDetachedTransactionOwnerBatch,
  TransactionEventTypes,
  type AllEvent,
  type UpdateTransactionEvent
} from '@asyra/reactive-events'
import { SharedDataChannelNames } from '@asyra/utils'
import {
  Factory,
  LocalSharedDataChannel,
  type FactoryMutationDeliverySequence,
  type SharedDeliveryBatch,
  type SharedPublication
} from '..'

const createUpdateEvent = (
  id: string,
  channel: string = SharedDataChannelNames.SCENE_TREE,
  eventName: string = EventTypes.UPDATE_PROPERTY,
  canonicalEvidence?: UpdateTransactionEvent['canonicalEvidence']
): Parameters<Factory['updateTransaction']>[0] => ({
  type: TransactionEventTypes.UPDATE_TRANSACTION,
  eventName,
  payload: { id, before: 0, after: 1 },
  options: { shared: channel },
  canonicalEvidence
})

const createRecord = (id: string, after = 1) => ({
  orderedIds: [id],
  payload: { id, before: after - 1, after }
})

const payloadId = (value: unknown): string | undefined =>
  (value as { id?: string } | undefined)?.id

describe('Factory batch regression contracts', () => {
  it('delivers duplicate cross-channel canonical ids in slice-major order', () => {
    const factory = new Factory()
    factory.registerSharedDataChannel(
      SharedDataChannelNames.PROPS,
      new LocalSharedDataChannel()
    )
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      new LocalSharedDataChannel()
    )
    const projected: string[] = []
    factory.observeSharedDataChannelBatch(
      SharedDataChannelNames.PROPS,
      (changes) =>
        projected.push(
          ...changes.map((change) => `props:${payloadId(change) ?? 'unknown'}`)
        )
    )
    factory.observeSharedDataChannelBatch(
      SharedDataChannelNames.SCENE_TREE,
      (changes) =>
        projected.push(
          ...changes.map((change) => `scene:${payloadId(change) ?? 'unknown'}`)
        )
    )
    const publications: SharedPublication[] = []
    factory.subscribeToSharedPublication((publication) =>
      publications.push(publication)
    )

    factory.startTransaction()
    const handle = factory.updateTransactionBatch([
      createUpdateEvent(
        'props-batch',
        SharedDataChannelNames.PROPS,
        EventTypes.UPDATE_PROPERTY,
        {
          orderedIds: ['element-a', 'element-b'],
          sharedRecords: [createRecord('element-a'), createRecord('element-b')]
        }
      ),
      createUpdateEvent(
        'scene-batch',
        SharedDataChannelNames.SCENE_TREE,
        EventTypes.UPDATE_PROPERTY,
        {
          orderedIds: ['element-a', 'element-b'],
          sharedRecords: [createRecord('element-a'), createRecord('element-b')]
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

    expect(projected).toEqual([
      'props:element-a',
      'scene:element-a',
      'props:element-b',
      'scene:element-b'
    ])
    expect(
      publications.map((publication) =>
        publication.slices.flatMap((slice) =>
          slice.batches.map((batch) => `${slice.sliceId}:${batch.channel}`)
        )
      )
    ).toEqual([
      [
        `slice-a:${SharedDataChannelNames.PROPS}`,
        `slice-a:${SharedDataChannelNames.SCENE_TREE}`
      ],
      [
        `slice-b:${SharedDataChannelNames.PROPS}`,
        `slice-b:${SharedDataChannelNames.SCENE_TREE}`
      ]
    ])
    const publicationBatches = publications.flatMap(({ slices }) =>
      slices.flatMap(({ batches }) => batches)
    )
    expect(new Set(publicationBatches.map(({ batchId }) => batchId)).size).toBe(
      publicationBatches.length
    )
    expect(factory.getUndoHistoryDepth()).toBe(1)
  })

  it('links history replay only to records that were actually delivered', () => {
    const factory = new Factory()
    const channel = new LocalSharedDataChannel()
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      channel
    )
    let firstProjection = true
    factory.observeSharedDataChannelBatch(
      SharedDataChannelNames.SCENE_TREE,
      () => {
        if (!firstProjection) return
        firstProjection = false
        factory.unregisterSharedDataChannel(SharedDataChannelNames.SCENE_TREE)
      }
    )
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
    const actionPublications: SharedPublication[] = []
    factory.subscribeToSharedPublication((publication) => {
      if (publication.origin === 'action') actionPublications.push(publication)
    })

    factory.startTransaction()
    const handle = factory.updateTransactionBatch([
      createUpdateEvent(
        'canonical-batch',
        SharedDataChannelNames.SCENE_TREE,
        EventTypes.UPDATE_PROPERTY,
        {
          orderedIds: ['element-a', 'element-b'],
          sharedRecords: [createRecord('element-a'), createRecord('element-b')]
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
    factory.endTransaction()

    expect(
      actionPublications.flatMap((publication) =>
        publication.slices.flatMap(({ batches }) =>
          batches.flatMap(({ deliveries }) =>
            deliveries.flatMap(({ orderedIds }) => orderedIds)
          )
        )
      )
    ).toEqual(['element-a'])

    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      new LocalSharedDataChannel()
    )
    const undoProjected: unknown[] = []
    factory.observeSharedDataChannelBatch(
      SharedDataChannelNames.SCENE_TREE,
      (changes) => undoProjected.push(...changes)
    )
    const undoPublications: SharedPublication[] = []
    factory.subscribeToSharedPublication((publication) => {
      if (publication.origin === 'undo') undoPublications.push(publication)
    })

    factory.undo()

    expect(undoProjected.map(payloadId)).toEqual(['element-a'])
    expect(
      undoPublications.flatMap((publication) =>
        publication.slices.flatMap(({ batches }) =>
          batches.flatMap(({ deliveries }) =>
            deliveries.flatMap(({ orderedIds }) => orderedIds)
          )
        )
      )
    ).toEqual(['element-a'])
  })

  it('reuses Group and children batch evidence once when canonical replay handlers decompose the write', () => {
    const factory = new Factory()
    factory.registerSharedDataChannel(
      SharedDataChannelNames.PROPS,
      new LocalSharedDataChannel()
    )
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      new LocalSharedDataChannel()
    )
    factory.registerTransactionReplayHandler(
      EventTypes.UPDATE_PROPERTY,
      (event) => {
        const payload = (
          event as AllEvent & {
            payload: { id: string; before: number; after: number }
          }
        ).payload
        if (payload.id === 'local-only') {
          factory.updateTransaction({
            type: TransactionEventTypes.UPDATE_TRANSACTION,
            eventName: event.type,
            payload: {
              id: 'derived-immediate',
              before: payload.before,
              after: payload.after
            },
            options: {
              shared: SharedDataChannelNames.PROPS,
              sharedDelivery: 'immediate'
            }
          })
          factory.updateTransaction({
            type: TransactionEventTypes.UPDATE_TRANSACTION,
            eventName: event.type,
            payload: {
              id: 'derived-transaction-end',
              before: payload.before,
              after: payload.after
            },
            options: { shared: SharedDataChannelNames.SCENE_TREE }
          })
          return true
        }
        const isSceneChange = payload.id.startsWith('scene-')

        if (isSceneChange) {
          factory.updateTransaction({
            type: TransactionEventTypes.UPDATE_TRANSACTION,
            eventName: event.type,
            payload,
            options: { shared: SharedDataChannelNames.SCENE_TREE }
          })
          if (payload.after === 0) {
            factory.updateTransaction({
              type: TransactionEventTypes.UPDATE_TRANSACTION,
              eventName: event.type,
              payload: {
                id: `cleanup-${payload.id}`,
                before: 1,
                after: 0
              },
              options: { shared: SharedDataChannelNames.PROPS }
            })
          }
        } else {
          ;['field-a', 'field-b'].forEach((field) => {
            factory.updateTransaction({
              type: TransactionEventTypes.UPDATE_TRANSACTION,
              eventName: event.type,
              payload: {
                ...payload,
                id: `${payload.id}:${field}`
              },
              options: { shared: SharedDataChannelNames.PROPS }
            })
          })
        }
        return true
      }
    )
    const publications: SharedPublication[] = []
    factory.subscribeToSharedPublication((publication) =>
      publications.push(publication)
    )

    factory.startTransaction()
    factory.updateTransactionBatch([
      createUpdateEvent(
        'props-group',
        SharedDataChannelNames.PROPS,
        EventTypes.UPDATE_PROPERTY,
        { orderedIds: ['group'] }
      ),
      createUpdateEvent(
        'scene-group',
        SharedDataChannelNames.SCENE_TREE,
        EventTypes.UPDATE_PROPERTY,
        { orderedIds: ['group'] }
      ),
      createUpdateEvent(
        'props-a',
        SharedDataChannelNames.PROPS,
        EventTypes.UPDATE_PROPERTY,
        { orderedIds: ['props-a'] }
      ),
      createUpdateEvent(
        'props-b',
        SharedDataChannelNames.PROPS,
        EventTypes.UPDATE_PROPERTY,
        { orderedIds: ['props-b'] }
      ),
      createUpdateEvent(
        'scene-a',
        SharedDataChannelNames.SCENE_TREE,
        EventTypes.UPDATE_PROPERTY,
        { orderedIds: ['scene-a'] }
      ),
      createUpdateEvent(
        'scene-b',
        SharedDataChannelNames.SCENE_TREE,
        EventTypes.UPDATE_PROPERTY,
        { orderedIds: ['scene-b'] }
      ),
      {
        ...createUpdateEvent('local-only'),
        options: undefined
      }
    ])
    factory.endTransaction()

    const summarize = (publication: SharedPublication | undefined) => ({
      origin: publication?.origin,
      batches: publication?.slices.flatMap(({ batches }) =>
        batches.map((batch) => ({
          channel: batch.channel,
          ids: batch.deliveries.map(({ payload }) => payloadId(payload)),
          recordIds: batch.deliveries.flatMap(({ orderedIds }) => orderedIds)
        }))
      )
    })
    const expectAtomicBatchIntegrity = (
      publication: SharedPublication | undefined
    ) => {
      expect(publication?.mode).toBe('atomic')
      publication?.slices.forEach((slice) => {
        expect(slice.orderedIds).toEqual(
          slice.batches.flatMap(({ deliveries }) =>
            deliveries.map(({ deliveryId }) => deliveryId)
          )
        )
      })
    }

    expect(summarize(publications[0])).toEqual({
      origin: 'action',
      batches: [
        {
          channel: SharedDataChannelNames.PROPS,
          ids: ['props-group'],
          recordIds: ['group']
        },
        {
          channel: SharedDataChannelNames.SCENE_TREE,
          ids: ['scene-group'],
          recordIds: ['group']
        },
        {
          channel: SharedDataChannelNames.PROPS,
          ids: ['props-a', 'props-b'],
          recordIds: ['props-a', 'props-b']
        },
        {
          channel: SharedDataChannelNames.SCENE_TREE,
          ids: ['scene-a', 'scene-b'],
          recordIds: ['scene-a', 'scene-b']
        }
      ]
    })
    expectAtomicBatchIntegrity(publications[0])

    publications.length = 0
    factory.undo()

    expect(publications).toHaveLength(1)
    expect(summarize(publications[0])).toEqual({
      origin: 'undo',
      batches: [
        {
          channel: SharedDataChannelNames.SCENE_TREE,
          ids: ['scene-b', 'scene-a'],
          recordIds: ['scene-b', 'scene-a']
        },
        {
          channel: SharedDataChannelNames.PROPS,
          ids: ['props-b', 'props-a'],
          recordIds: ['props-b', 'props-a']
        },
        {
          channel: SharedDataChannelNames.SCENE_TREE,
          ids: ['scene-group'],
          recordIds: ['group']
        },
        {
          channel: SharedDataChannelNames.PROPS,
          ids: ['props-group'],
          recordIds: ['group']
        }
      ]
    })
    expectAtomicBatchIntegrity(publications[0])

    publications.length = 0
    factory.redo()

    expect(publications).toHaveLength(1)
    expect(summarize(publications[0])).toEqual({
      origin: 'redo',
      batches: [
        {
          channel: SharedDataChannelNames.PROPS,
          ids: ['props-group'],
          recordIds: ['group']
        },
        {
          channel: SharedDataChannelNames.SCENE_TREE,
          ids: ['scene-group'],
          recordIds: ['group']
        },
        {
          channel: SharedDataChannelNames.PROPS,
          ids: ['props-a', 'props-b'],
          recordIds: ['props-a', 'props-b']
        },
        {
          channel: SharedDataChannelNames.SCENE_TREE,
          ids: ['scene-a', 'scene-b'],
          recordIds: ['scene-a', 'scene-b']
        }
      ]
    })
    expectAtomicBatchIntegrity(publications[0])
  })

  it.each(['channel', 'publication'] as const)(
    'rejects endTransaction from a shared %s observer without closing the outer action',
    (observerKind) => {
      const factory = new Factory()
      factory.registerSharedDataChannel(
        SharedDataChannelNames.SCENE_TREE,
        new LocalSharedDataChannel()
      )
      const attempts: string[] = []
      const attemptEnd = () => {
        try {
          factory.endTransaction()
          attempts.push('allowed')
        } catch (error) {
          attempts.push(error instanceof Error ? error.message : String(error))
        }
      }
      if (observerKind === 'channel') {
        factory.observeSharedDataChannelBatch(
          SharedDataChannelNames.SCENE_TREE,
          attemptEnd
        )
      } else {
        factory.subscribeToSharedPublication(attemptEnd)
      }
      factory.startTransaction()
      const handle = factory.updateTransactionBatch([
        createUpdateEvent(
          `observer-${observerKind}`,
          SharedDataChannelNames.SCENE_TREE,
          EventTypes.UPDATE_PROPERTY,
          { orderedIds: [`observer-${observerKind}`] }
        )
      ])
      handle?.setDeliverySequence({
        mode: 'progressive',
        slices: [
          {
            sliceId: 'slice-observer',
            orderedIds: [`observer-${observerKind}`]
          }
        ]
      })
      handle?.deliverSlice('slice-observer')
      factory.endTransaction()

      expect(attempts).toEqual([
        'Factory shared evidence observers cannot mutate canonical transaction controls'
      ])
      expect(factory.getUndoHistoryDepth()).toBe(1)
    }
  )

  it('maps each custom inverter output to its matching shared record output exactly once', () => {
    const factory = new Factory()
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      new LocalSharedDataChannel()
    )
    const inverseEvents = () =>
      ['inverse-x', 'inverse-y'].map(
        (id): AllEvent => ({
          type: EventTypes.UPDATE_PROPERTY,
          payload: { id, before: 1, after: 0 }
        })
      )
    factory.registerTransactionInverter('custom.multi-output', inverseEvents)
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
    factory.registerTransactionReplayHandler('custom.multi-output', (event) => {
      factory.updateTransaction({
        type: TransactionEventTypes.UPDATE_TRANSACTION,
        eventName: event.type,
        payload: (event as AllEvent & { payload: unknown }).payload,
        options: { shared: SharedDataChannelNames.SCENE_TREE }
      })
      return true
    })
    const projected: unknown[] = []
    factory.observeSharedDataChannelBatch(
      SharedDataChannelNames.SCENE_TREE,
      (changes) => projected.push(...changes)
    )

    factory.startTransaction()
    factory.updateTransactionBatch([
      createUpdateEvent(
        'canonical-multi-output',
        SharedDataChannelNames.SCENE_TREE,
        'custom.multi-output',
        {
          orderedIds: ['element-a'],
          sharedRecords: [createRecord('element-a')]
        }
      )
    ])
    factory.endTransaction()
    projected.length = 0

    factory.undo()
    expect(projected.map(payloadId)).toEqual(['inverse-x', 'inverse-y'])

    projected.length = 0
    factory.redo()
    expect(projected.map(payloadId)).toEqual(['element-a'])
  })

  it('fails closed when custom canonical and shared record inverse counts differ', () => {
    const factory = new Factory()
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      new LocalSharedDataChannel()
    )
    factory.registerTransactionInverter(
      'custom.mismatched-outputs',
      (event) => {
        const id = payloadId((event as AllEvent & { payload: unknown }).payload)
        const outputIds =
          id === 'canonical-mismatch'
            ? ['inverse-x', 'inverse-y']
            : ['inverse-x']
        return outputIds.map(
          (outputId): AllEvent => ({
            type: EventTypes.UPDATE_PROPERTY,
            payload: { id: outputId, before: 1, after: 0 }
          })
        )
      }
    )
    factory.registerTransactionReplayHandler(
      EventTypes.UPDATE_PROPERTY,
      () => true
    )

    factory.startTransaction()
    expect(() =>
      factory.updateTransactionBatch([
        createUpdateEvent(
          'canonical-mismatch',
          SharedDataChannelNames.SCENE_TREE,
          'custom.mismatched-outputs',
          {
            orderedIds: ['element-a'],
            sharedRecords: [createRecord('element-a')]
          }
        )
      ])
    ).toThrow(
      /shared record inverse output count must match canonical inverse output count/
    )
    expect(() => factory.endTransaction()).not.toThrow()
    expect(
      (factory.transact as unknown as { undoStack: unknown[] }).undoStack
    ).toEqual([])
  })

  it('selects 16 progressive publication boundaries without rescanning the sequence', () => {
    const runtimeGlobal = globalThis as typeof globalThis & {
      __asyraBrowserDragPhaseSink?: (name: string, durationMs: number) => void
    }
    const previousPhaseSink = runtimeGlobal.__asyraBrowserDragPhaseSink
    const phaseNames: string[] = []
    runtimeGlobal.__asyraBrowserDragPhaseSink = (name) => phaseNames.push(name)
    const factory = new Factory()
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      new LocalSharedDataChannel()
    )
    const orderedIds = Array.from(
      { length: 16 },
      (_, index) => `element-${index}`
    )

    factory.startTransaction()
    const handle = factory.updateTransactionBatch([
      createUpdateEvent(
        'canonical-sequence',
        SharedDataChannelNames.SCENE_TREE,
        EventTypes.UPDATE_PROPERTY,
        {
          orderedIds,
          sharedRecords: orderedIds.map((id) => createRecord(id))
        }
      )
    ])
    handle?.setDeliverySequence({
      mode: 'progressive',
      slices: orderedIds.map((id, index) => ({
        sliceId: `slice-${index}`,
        orderedIds: [id]
      }))
    })
    const transact = factory.transact as unknown as {
      activeDeliverySequence: FactoryMutationDeliverySequence
    }
    const activeSequence = transact.activeDeliverySequence
    let fullSequenceFilterCalls = 0
    transact.activeDeliverySequence = {
      ...activeSequence,
      slices: new Proxy(activeSequence.slices, {
        get(target, property, receiver) {
          if (property === 'filter') fullSequenceFilterCalls += 1
          return Reflect.get(target, property, receiver)
        }
      })
    }

    try {
      orderedIds.forEach((_, index) => handle?.deliverSlice(`slice-${index}`))
      factory.endTransaction()
    } finally {
      runtimeGlobal.__asyraBrowserDragPhaseSink = previousPhaseSink
    }

    expect(fullSequenceFilterCalls).toBe(0)
    expect(
      phaseNames.filter(
        (phaseName) =>
          phaseName === 'factory:select-delivery-sequence-boundaries'
      )
    ).toHaveLength(16)
    expect(
      phaseNames.filter(
        (phaseName) => phaseName === 'factory:create-shared-publication'
      )
    ).toHaveLength(16)
  })

  it('delivers 7112 canonical records through one ordered batch callback', () => {
    const factory = new Factory()
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      new LocalSharedDataChannel()
    )
    const deliveryBatches: SharedDeliveryBatch[] = []
    const publications: SharedPublication[] = []
    factory.subscribeToSharedDeliveryBatch((batch) =>
      deliveryBatches.push(batch)
    )
    factory.subscribeToSharedPublication((publication) =>
      publications.push(publication)
    )
    const orderedIds = Array.from(
      { length: 7_112 },
      (_, index) => `element-${index}`
    )

    factory.startTransaction()
    factory.updateTransactionBatch([
      createUpdateEvent(
        'canonical-large',
        SharedDataChannelNames.SCENE_TREE,
        EventTypes.UPDATE_PROPERTY,
        {
          orderedIds,
          sharedRecords: orderedIds.map((id) => createRecord(id))
        }
      )
    ])
    factory.endTransaction()

    expect(deliveryBatches).toHaveLength(1)
    expect(deliveryBatches[0]?.deliveries).toHaveLength(7_112)
    expect(
      deliveryBatches[0]?.deliveries.map(({ payload }) => payloadId(payload))
    ).toEqual(orderedIds)
    expect(publications).toHaveLength(1)
    const publicationDeliveries =
      publications[0]?.slices.flatMap(({ batches }) =>
        batches.flatMap(({ deliveries }) => deliveries)
      ) ?? []
    expect(publicationDeliveries).toHaveLength(7_112)
    expect(
      publicationDeliveries.map(({ payload }) => payloadId(payload))
    ).toEqual(orderedIds)
  })

  it.each([
    ['Array', []],
    ['Map', new Map([['id', 'element-a']])],
    ['Date', new Date(0)],
    ['custom prototype', Object.create({ id: 'element-a' })]
  ])('rejects an explicit shared record %s payload', (_name, payload) => {
    const factory = new Factory()
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      new LocalSharedDataChannel()
    )
    factory.startTransaction()

    expect(() =>
      factory.updateTransactionBatch([
        createUpdateEvent(
          'canonical-invalid-record',
          SharedDataChannelNames.SCENE_TREE,
          EventTypes.UPDATE_PROPERTY,
          {
            orderedIds: ['element-a'],
            sharedRecords: [{ orderedIds: ['element-a'], payload }]
          }
        )
      ])
    ).toThrow(/requires a plain record payload/)
    factory.endTransaction({ outcome: 'rollback' })
  })

  it('accepts an explicit shared record payload with a null prototype', () => {
    const factory = new Factory()
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      new LocalSharedDataChannel()
    )
    const payload = Object.assign(Object.create(null) as object, {
      id: 'element-a',
      before: 0,
      after: 1
    })

    factory.startTransaction()
    expect(() =>
      factory.updateTransactionBatch([
        createUpdateEvent(
          'canonical-null-prototype',
          SharedDataChannelNames.SCENE_TREE,
          EventTypes.UPDATE_PROPERTY,
          {
            orderedIds: ['element-a'],
            sharedRecords: [{ orderedIds: ['element-a'], payload }]
          }
        )
      ])
    ).not.toThrow()
    expect(() => factory.endTransaction()).not.toThrow()
  })

  it('reuses nested geometry from an issued canonical owner batch', () => {
    const factory = new Factory()
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      new LocalSharedDataChannel()
    )
    const publications: SharedPublication[] = []
    factory.subscribeToSharedPublication((publication) =>
      publications.push(publication)
    )
    const points = Object.freeze([
      Object.freeze({ x: 1, y: 2 }),
      Object.freeze({ x: 3, y: 4 })
    ])
    let nestedGeometryReads = 0
    const geometry = Object.freeze(
      Object.defineProperty({}, 'points', {
        enumerable: true,
        get: () => {
          nestedGeometryReads += 1
          return points
        }
      })
    ) as { readonly points: typeof points }
    const event = Object.freeze({
      type: TransactionEventTypes.UPDATE_TRANSACTION,
      eventName: EventTypes.UPDATE_PROPERTY,
      payload: Object.freeze({
        id: 'owner-issued-element',
        before: 0,
        after: 1,
        geometry
      }),
      options: Object.freeze({
        shared: SharedDataChannelNames.SCENE_TREE
      }),
      canonicalEvidence: Object.freeze({
        orderedIds: Object.freeze(['owner-issued-element'])
      })
    }) satisfies UpdateTransactionEvent
    const ownerBatch = issueDetachedTransactionOwnerBatch(
      Object.freeze([event])
    )

    factory.startTransaction()
    factory.updateTransactionBatch(ownerBatch)
    factory.endTransaction()

    const deliveredPayload = publications[0]?.slices[0]?.batches[0]
      ?.deliveries[0]?.payload as
      | { readonly geometry?: typeof geometry }
      | undefined
    expect(deliveredPayload?.geometry).toBe(geometry)
    expect(factory.getUndoHistoryDepth()).toBe(1)
    expect(nestedGeometryReads).toBe(0)
  })

  it('isolates a shallow-frozen external batch before the journal handoff', () => {
    const factory = new Factory()
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      new LocalSharedDataChannel()
    )
    const publications: SharedPublication[] = []
    factory.subscribeToSharedPublication((publication) =>
      publications.push(publication)
    )
    const event = createUpdateEvent(
      'element-a',
      SharedDataChannelNames.SCENE_TREE,
      EventTypes.UPDATE_PROPERTY,
      {
        orderedIds: ['element-a'],
        sharedRecords: [createRecord('element-a')]
      }
    )
    const externalBatch = Object.freeze([event])

    factory.startTransaction()
    factory.updateTransactionBatch(externalBatch)

    expect(Object.isFrozen(event)).toBe(false)
    expect(Object.isFrozen(event.payload)).toBe(false)
    expect(Object.isFrozen(event.canonicalEvidence)).toBe(false)
    ;(event.payload as { id: string }).id = 'caller-mutated'
    ;(event.canonicalEvidence?.orderedIds as string[])[0] = 'caller-mutated'
    factory.endTransaction()

    expect(
      publications[0]?.slices[0]?.batches[0]?.deliveries[0]?.payload
    ).toMatchObject({ id: 'element-a' })
    expect(
      publications[0]?.slices[0]?.batches[0]?.deliveries[0]?.orderedIds
    ).toEqual(['element-a'])
  })
})
