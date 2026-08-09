import { describe, expect, it } from 'vitest'
import {
  EventTypes,
  TransactionEventTypes,
  type AllEvent,
  type UpdateTransactionEvent
} from '@asyra/reactive-events'
import { SharedDataChannelNames } from '@asyra/utils'
import { Factory, LocalSharedDataChannel, type SharedPublication } from '..'

const createUpdateEvent = (
  id: string,
  options: UpdateTransactionEvent['options'] = {},
  before = 0,
  after = 1
): UpdateTransactionEvent => ({
  type: TransactionEventTypes.UPDATE_TRANSACTION,
  eventName: EventTypes.UPDATE_PROPERTY,
  payload: { id, before, after },
  options
})

interface ReplaceLatestHistoryOptions {
  history: {
    mode: 'replace-latest'
    key: string
  }
}

interface ReplaceLatestHistoryCandidate {
  key: string
  events: readonly UpdateTransactionEvent[]
  eventKeys?: readonly string[]
}

const createReplaceLatestBatch = (
  key: string,
  values: readonly {
    id: string
    before: number
    after: number
  }[],
  baseOptions: UpdateTransactionEvent['options'] = {}
): readonly UpdateTransactionEvent[] => {
  const options = {
    ...baseOptions,
    history: {
      mode: 'replace-latest',
      key
    }
  } satisfies UpdateTransactionEvent['options'] & ReplaceLatestHistoryOptions
  const candidateEvents = values.map(({ id, before, after }) => ({
    ...createUpdateEvent(id, options, before, after),
    ...(options.shared ? { canonicalEvidence: { orderedIds: [id] } } : {})
  }))
  const historyCandidate: ReplaceLatestHistoryCandidate = {
    key,
    events: candidateEvents,
    eventKeys: values.map(({ id }) => id)
  }

  return candidateEvents.map((event, index) =>
    index === 0
      ? ({
          ...event,
          historyCandidate
        } as UpdateTransactionEvent & {
          historyCandidate: ReplaceLatestHistoryCandidate
        })
      : event
  )
}

const createOwnerIssuedReplaceLatestBatch = (
  key: string,
  payload: Readonly<Record<string, unknown>>
): readonly UpdateTransactionEvent[] => {
  const options = {
    history: {
      mode: 'replace-latest',
      key
    }
  } satisfies UpdateTransactionEvent['options'] & ReplaceLatestHistoryOptions
  const event: UpdateTransactionEvent = {
    type: TransactionEventTypes.UPDATE_TRANSACTION,
    eventName: EventTypes.UPDATE_PROPERTY,
    payload,
    options
  }
  const historyCandidate: ReplaceLatestHistoryCandidate = {
    key,
    events: [event],
    eventKeys: [String(payload.id)]
  }
  return [{ ...event, historyCandidate }]
}

const createOwnerKeyedReplaceLatestBatch = (
  key: string,
  values: readonly {
    eventKey: string
    id: string
    before: number
    after: number
  }[]
): readonly UpdateTransactionEvent[] => {
  const options = {
    history: {
      mode: 'replace-latest',
      key
    }
  } satisfies UpdateTransactionEvent['options'] & ReplaceLatestHistoryOptions
  const candidateEvents = values.map(({ id, before, after }) =>
    createUpdateEvent(id, options, before, after)
  )
  const historyCandidate: ReplaceLatestHistoryCandidate = {
    key,
    events: candidateEvents,
    eventKeys: values.map(({ eventKey }) => eventKey)
  }
  return candidateEvents.map((event, index) =>
    index === 0 ? { ...event, historyCandidate } : event
  )
}

describe('Factory journal-backed action history', () => {
  it('records one owner batch as one Undo action and replays the whole action', () => {
    const factory = new Factory()
    const replayed: AllEvent[] = []
    factory.registerTransactionReplayHandler(
      EventTypes.UPDATE_PROPERTY,
      (event) => {
        replayed.push(event)
        return true
      }
    )

    factory.startTransaction()
    factory.updateTransactionBatch([
      createUpdateEvent('element-a'),
      createUpdateEvent('element-b')
    ])
    factory.endTransaction()

    expect(factory.getUndoHistoryDepth()).toBe(1)

    factory.undo()
    expect(
      replayed.map(
        (event) => (event as AllEvent & { payload: { id: string } }).payload.id
      )
    ).toEqual(['element-b', 'element-a'])
    expect(factory.getUndoHistoryDepth()).toBe(0)

    replayed.length = 0
    factory.redo()
    expect(
      replayed.map(
        (event) => (event as AllEvent & { payload: { id: string } }).payload.id
      )
    ).toEqual(['element-a', 'element-b'])
    expect(factory.getUndoHistoryDepth()).toBe(1)
  })

  it('keeps progressive delivery on a delivery-only handle and one history action', () => {
    const factory = new Factory()
    factory.registerSharedDataChannel(
      SharedDataChannelNames.SCENE_TREE,
      new LocalSharedDataChannel()
    )
    const publications: SharedPublication[] = []
    factory.subscribeToSharedPublication((publication) =>
      publications.push(publication)
    )

    factory.startTransaction()
    const controller = factory.getActiveStagedDeliveryController()
    const handle = factory.updateTransactionBatch([
      {
        ...createUpdateEvent('element-a', {
          shared: SharedDataChannelNames.SCENE_TREE
        }),
        canonicalEvidence: {
          orderedIds: ['element-a']
        }
      }
    ])

    expect(controller).not.toBeNull()
    expect(handle).not.toBeNull()
    expect(handle).not.toHaveProperty('artifact')

    controller?.setDeliverySequence({
      mode: 'progressive',
      slices: [{ sliceId: 'slice-a', orderedIds: ['element-a'] }]
    })
    controller?.stageSlice('slice-a')
    factory.endTransaction()

    expect(publications).toHaveLength(1)
    expect(publications[0]?.slices[0]?.orderedIds).toEqual(['element-a'])
    expect(factory.getUndoHistoryDepth()).toBe(1)
    expect(factory.getActiveStagedDeliveryController()).toBeNull()
  })

  it('creates no history action for an empty or rolled-back transaction', () => {
    const factory = new Factory()
    factory.registerTransactionReplayHandler(
      EventTypes.UPDATE_PROPERTY,
      () => true
    )

    factory.startTransaction()
    factory.endTransaction()
    expect(factory.getUndoHistoryDepth()).toBe(0)

    factory.startTransaction()
    factory.updateTransaction(createUpdateEvent('rolled-back'))
    factory.endTransaction({ outcome: 'rollback' })
    expect(factory.getUndoHistoryDepth()).toBe(0)
  })

  it('rejects a stale delivery handle after its transaction settles', () => {
    const factory = new Factory()

    factory.startTransaction()
    const handle = factory.updateTransaction(createUpdateEvent('element-a'))
    factory.endTransaction()

    expect(() =>
      handle?.setDeliverySequence({
        mode: 'progressive',
        slices: [{ sliceId: 'slice-a', orderedIds: ['element-a'] }]
      })
    ).toThrow('Factory staged delivery controller is no longer active')
  })

  it('keeps update equivalent to a batch of one', () => {
    const singleFactory = new Factory()
    const batchFactory = new Factory()

    singleFactory.startTransaction()
    singleFactory.updateTransaction(createUpdateEvent('element-a'))
    singleFactory.endTransaction()

    batchFactory.startTransaction()
    batchFactory.updateTransactionBatch([createUpdateEvent('element-a')])
    batchFactory.endTransaction()

    expect(singleFactory.getUndoHistoryDepth()).toBe(1)
    expect(batchFactory.getUndoHistoryDepth()).toBe(1)
  })

  it('replaces one staged gesture History bundle and replays only its first-before/latest-after values', () => {
    const factory = new Factory()
    const replayed: AllEvent[] = []
    factory.registerTransactionReplayHandler(
      EventTypes.UPDATE_PROPERTY,
      (event) => {
        replayed.push(event)
        return true
      }
    )

    factory.startTransaction()
    factory.updateTransactionBatch(
      createReplaceLatestBatch('move-session', [
        { id: 'element-a:x', before: 0, after: 10 },
        { id: 'element-b:x', before: 100, after: 110 }
      ])
    )
    factory.updateTransactionBatch(
      createReplaceLatestBatch('move-session', [
        { id: 'element-a:x', before: 10, after: 25 },
        { id: 'element-b:x', before: 110, after: 125 }
      ])
    )
    factory.endTransaction()

    expect(factory.getUndoHistoryDepth()).toBe(1)

    factory.undo()
    expect(
      replayed.map(
        (event) =>
          (
            event as AllEvent & {
              payload: { id: string; before: number; after: number }
            }
          ).payload
      )
    ).toEqual([
      { id: 'element-b:x', before: 125, after: 100 },
      { id: 'element-a:x', before: 25, after: 0 }
    ])

    replayed.length = 0
    factory.redo()
    expect(
      replayed.map(
        (event) =>
          (
            event as AllEvent & {
              payload: { id: string; before: number; after: number }
            }
          ).payload
      )
    ).toEqual([
      { id: 'element-a:x', before: 0, after: 25 },
      { id: 'element-b:x', before: 100, after: 125 }
    ])
  })

  it('trusts changing owner payload metadata in a replace-latest candidate', () => {
    const factory = new Factory()
    const replayed: AllEvent[] = []
    factory.registerTransactionReplayHandler(
      EventTypes.UPDATE_PROPERTY,
      (event) => {
        replayed.push(event)
        return true
      }
    )

    factory.startTransaction()
    factory.updateTransactionBatch(
      createOwnerIssuedReplaceLatestBatch('owner-session', {
        id: 'element-a:x',
        before: 0,
        after: 10,
        ownerRevision: 1
      })
    )
    factory.updateTransactionBatch(
      createOwnerIssuedReplaceLatestBatch('owner-session', {
        id: 'element-a:x',
        before: 10,
        after: 25,
        ownerRevision: 2
      })
    )
    factory.endTransaction()

    factory.undo()
    expect(replayed[0]).toMatchObject({
      payload: {
        id: 'element-a:x',
        before: 25,
        after: 0,
        ownerRevision: 2
      }
    })
  })

  it('keeps replace-latest options without an owner candidate as ordinary History', () => {
    const factory = new Factory()
    const replayed: AllEvent[] = []
    factory.registerTransactionReplayHandler(
      EventTypes.UPDATE_PROPERTY,
      (event) => {
        replayed.push(event)
        return true
      }
    )
    const options = {
      history: {
        mode: 'replace-latest',
        key: 'owner-pass-through'
      }
    } satisfies UpdateTransactionEvent['options'] & ReplaceLatestHistoryOptions

    factory.startTransaction()
    factory.updateTransaction(createUpdateEvent('element-a:x', options, 0, 10))
    factory.updateTransaction(createUpdateEvent('element-a:x', options, 10, 25))
    factory.endTransaction()

    factory.undo()
    expect(
      replayed.map(
        (event) =>
          (
            event as AllEvent & {
              payload: { id: string; before: number; after: number }
            }
          ).payload
      )
    ).toEqual([
      { id: 'element-a:x', before: 25, after: 10 },
      { id: 'element-a:x', before: 10, after: 0 }
    ])
  })

  it('keeps earlier option-only owner events before later candidate staging', () => {
    const factory = new Factory()
    const replayed: AllEvent[] = []
    factory.registerTransactionReplayHandler(
      EventTypes.UPDATE_PROPERTY,
      (event) => {
        replayed.push(event)
        return true
      }
    )
    const options = {
      history: {
        mode: 'replace-latest',
        key: 'owner-mixed-session'
      }
    } satisfies UpdateTransactionEvent['options'] & ReplaceLatestHistoryOptions

    factory.startTransaction()
    factory.updateTransaction(createUpdateEvent('element-a:x', options, 0, 10))
    factory.updateTransactionBatch(
      createReplaceLatestBatch('owner-mixed-session', [
        { id: 'element-a:x', before: 10, after: 25 }
      ])
    )
    factory.updateTransactionBatch(
      createReplaceLatestBatch('owner-mixed-session', [
        { id: 'element-a:x', before: 25, after: 40 }
      ])
    )
    factory.endTransaction()

    factory.undo()
    expect(
      replayed.map(
        (event) =>
          (
            event as AllEvent & {
              payload: { id: string; before: number; after: number }
            }
          ).payload
      )
    ).toEqual([
      { id: 'element-a:x', before: 40, after: 10 },
      { id: 'element-a:x', before: 10, after: 0 }
    ])
  })

  it('retains the latest owner event per key when later candidate bundles omit unchanged fields', () => {
    const factory = new Factory()
    const replayed: AllEvent[] = []
    factory.registerTransactionReplayHandler(
      EventTypes.UPDATE_PROPERTY,
      (event) => {
        replayed.push(event)
        return true
      }
    )

    factory.startTransaction()
    factory.updateTransactionBatch(
      createOwnerKeyedReplaceLatestBatch('owner-sparse-session', [
        { eventKey: 'x', id: 'element-a:x', before: 0, after: 10 },
        { eventKey: 'y', id: 'element-a:y', before: 100, after: 110 },
        { eventKey: 'z', id: 'element-a:z', before: 200, after: 210 }
      ])
    )
    factory.updateTransactionBatch(
      createOwnerKeyedReplaceLatestBatch('owner-sparse-session', [
        { eventKey: 'x', id: 'element-a:x', before: 10, after: 25 },
        { eventKey: 'z', id: 'element-a:z', before: 210, after: 240 }
      ])
    )
    factory.endTransaction()

    factory.undo()
    expect(
      replayed.map(
        (event) =>
          (
            event as AllEvent & {
              payload: { id: string; before: number; after: number }
            }
          ).payload
      )
    ).toEqual([
      { id: 'element-a:z', before: 240, after: 200 },
      { id: 'element-a:y', before: 110, after: 100 },
      { id: 'element-a:x', before: 25, after: 0 }
    ])
  })

  it('keeps ordinary History append-only when replace-latest is absent', () => {
    const factory = new Factory()
    const replayed: AllEvent[] = []
    factory.registerTransactionReplayHandler(
      EventTypes.UPDATE_PROPERTY,
      (event) => {
        replayed.push(event)
        return true
      }
    )

    factory.startTransaction()
    factory.updateTransaction(
      createUpdateEvent('element-a:x', undefined, 0, 10)
    )
    factory.updateTransaction(
      createUpdateEvent('element-a:x', undefined, 10, 25)
    )
    factory.endTransaction()
    factory.undo()

    expect(
      replayed.map(
        (event) =>
          (
            event as AllEvent & {
              payload: { before: number; after: number }
            }
          ).payload
      )
    ).toEqual([
      { id: 'element-a:x', before: 25, after: 10 },
      { id: 'element-a:x', before: 10, after: 0 }
    ])
  })

  it('keeps an ordinary final normalization ordered after one staged gesture bundle', () => {
    const factory = new Factory()
    const replayed: AllEvent[] = []
    factory.registerTransactionReplayHandler(
      EventTypes.UPDATE_PROPERTY,
      (event) => {
        replayed.push(event)
        return true
      }
    )

    factory.startTransaction()
    factory.updateTransactionBatch(
      createReplaceLatestBatch('move-session', [
        { id: 'element-a:x', before: 0, after: 10 },
        { id: 'element-a:y', before: 0, after: 20 }
      ])
    )
    factory.updateTransactionBatch(
      createReplaceLatestBatch('move-session', [
        { id: 'element-a:x', before: 10, after: 25 },
        { id: 'element-a:y', before: 20, after: 35 }
      ])
    )
    factory.updateTransaction(
      createUpdateEvent('group-normalization', undefined, 1, 2)
    )
    factory.endTransaction()
    factory.undo()

    expect(
      replayed.map(
        (event) =>
          (
            event as AllEvent & {
              payload: { id: string; before: number; after: number }
            }
          ).payload
      )
    ).toEqual([
      { id: 'group-normalization', before: 2, after: 1 },
      { id: 'element-a:y', before: 35, after: 0 },
      { id: 'element-a:x', before: 25, after: 0 }
    ])
  })

  it('rolls back every applied staged sample without creating History', () => {
    const factory = new Factory()
    const replayed: AllEvent[] = []
    factory.registerTransactionReplayHandler(
      EventTypes.UPDATE_PROPERTY,
      (event) => {
        replayed.push(event)
        return true
      }
    )

    factory.startTransaction()
    factory.updateTransactionBatch(
      createReplaceLatestBatch('move-session', [
        { id: 'element-a:x', before: 0, after: 10 }
      ])
    )
    factory.updateTransactionBatch(
      createReplaceLatestBatch('move-session', [
        { id: 'element-a:x', before: 10, after: 25 }
      ])
    )
    factory.endTransaction({ outcome: 'rollback' })

    expect(
      replayed.map(
        (event) =>
          (
            event as AllEvent & {
              payload: { id: string; before: number; after: number }
            }
          ).payload
      )
    ).toEqual([
      { id: 'element-a:x', before: 25, after: 10 },
      { id: 'element-a:x', before: 10, after: 0 }
    ])
    expect(factory.getUndoHistoryDepth()).toBe(0)
  })

  it('keeps staging metadata local and publishes one final-to-initial shared Undo bundle', async () => {
    const factory = new Factory()
    factory.registerSharedDataChannel(
      SharedDataChannelNames.PROPS,
      new LocalSharedDataChannel()
    )
    factory.registerTransactionReplayHandler(
      EventTypes.UPDATE_PROPERTY,
      () => true
    )
    const publications: SharedPublication[] = []
    factory.subscribeToSharedPublication((publication) =>
      publications.push(publication)
    )
    const options = {
      shared: SharedDataChannelNames.PROPS,
      sharedDelivery: 'immediate'
    } as const

    factory.startTransaction()
    factory.updateTransactionBatch(
      createReplaceLatestBatch(
        'move-session',
        [
          { id: 'element-a:x', before: 0, after: 10 },
          { id: 'element-a:y', before: 0, after: 20 }
        ],
        options
      )
    )
    factory.updateTransactionBatch(
      createReplaceLatestBatch(
        'move-session',
        [
          { id: 'element-a:x', before: 10, after: 25 },
          { id: 'element-a:y', before: 20, after: 35 }
        ],
        options
      )
    )
    await Promise.resolve()
    factory.endTransaction()

    expect(JSON.stringify(publications)).not.toContain('replace-latest')
    expect(JSON.stringify(publications)).not.toContain('move-session')
    publications.length = 0

    factory.undo()
    await Promise.resolve()

    expect(publications).toHaveLength(1)
    expect(publications[0]).toMatchObject({ origin: 'undo' })
    expect(
      publications[0]?.slices
        .flatMap(({ batches }) => batches)
        .flatMap(({ deliveries }) => deliveries)
        .map(({ payload }) => payload)
    ).toEqual([
      expect.objectContaining({
        id: 'element-a:y',
        before: 35,
        after: 0
      }),
      expect.objectContaining({
        id: 'element-a:x',
        before: 25,
        after: 0
      })
    ])
  })
})
