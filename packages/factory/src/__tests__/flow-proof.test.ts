import { beforeAll, describe, expect, it } from 'vitest'
import {
  EventTypes,
  type AllEvent,
  type UpdateTransactionEvent
} from '@asyra/reactive-events'
import {
  SharedDataChannelNames,
  type TransactionStatusPayload
} from '@asyra/utils'
import { Factory } from '../factory.js'
import { LocalSharedDataChannel } from '../shared-data-channel.js'
import type { SharedPublication } from '../shared-delivery.js'

// Both flows exercise the same production owner. Assertions below remain
// unchanged when the runner applies the isolated inverse regression.
const exercise = async (cancel: boolean) => {
  const factory = new Factory()
  const channel = SharedDataChannelNames.SCENE_TREE
  factory.registerSharedDataChannel(channel, new LocalSharedDataChannel())
  const projected: unknown[] = []
  const replayed: unknown[] = []
  const publications: SharedPublication[] = []
  const statuses: TransactionStatusPayload[] = []
  const disposeProjection = factory.observeSharedDataChannel(
    channel,
    (change) => projected.push(change)
  )
  const disposePublication = factory.subscribeToSharedPublication((value) =>
    publications.push(value)
  )
  const disposeStatus = factory.subscribeToTransactionStatus((value) =>
    statuses.push(value)
  )
  const disposeReplay = factory.registerTransactionReplayHandler(
    EventTypes.UPDATE_PROPERTY,
    (event) => {
      replayed.push((event as AllEvent & { payload: unknown }).payload)
      return true
    }
  )
  const payload = {
    id: 'proof-element',
    before: { value: 0 },
    after: { value: 1 }
  }
  try {
    factory.startTransaction()
    const handle = factory.updateTransaction({
      type: EventTypes.UPDATE_TRANSACTION,
      eventName: EventTypes.UPDATE_PROPERTY,
      payload: payload as unknown as UpdateTransactionEvent['payload'],
      options: {
        shared: channel,
        sharedDelivery: cancel ? 'immediate' : 'transaction-end'
      }
    })
    if (cancel)
      handle?.setDeliverySequence({
        mode: 'atomic',
        batchPublications: false,
        slices: []
      })
    await Promise.resolve()
    const beforeClose = {
      projectionCount: projected.length,
      publicationCount: publications.length
    }
    payload.before.value = 40
    payload.after.value = 41
    factory.endTransaction({ outcome: cancel ? 'rollback' : 'commit' })
    await Promise.resolve()
    return {
      projected,
      replayed,
      publications,
      statuses,
      beforeClose,
      history: factory.getUndoHistoryDepth()
    }
  } finally {
    disposeProjection()
    disposePublication()
    disposeStatus()
    disposeReplay()
  }
}

describe('Factory flow proof', () => {
  describe('deferred', () => {
    let deferred: Awaited<ReturnType<typeof exercise>>
    beforeAll(async () => {
      deferred = await exercise(false)
    })

    it('snapshot', () => {
      expect(deferred.projected[0]).toMatchObject({
        before: { value: 0 },
        after: { value: 1 }
      })
    })

    it('outcome', () => {
      expect(deferred.history).toBe(1)
      expect(deferred.replayed).toEqual([])
      expect(deferred.statuses[deferred.statuses.length - 1]?.status).toBe(
        'committed'
      )
    })

    it('delivery', () => {
      expect(deferred.beforeClose).toEqual({
        projectionCount: 0,
        publicationCount: 0
      })
      expect(deferred.projected).toHaveLength(1)
      expect(deferred.publications).toHaveLength(1)
      expect(deferred.publications[0]?.origin).toBe('action')
    })
  })
  describe('cancel', () => {
    let cancelled: Awaited<ReturnType<typeof exercise>>
    beforeAll(async () => {
      cancelled = await exercise(true)
    })

    it('snapshot', () => {
      expect(cancelled.projected[0]).toMatchObject({
        before: { value: 0 },
        after: { value: 1 }
      })
    })

    it('outcome', () => {
      expect(cancelled.history).toBe(0)
      expect(cancelled.replayed).toEqual([
        expect.objectContaining({ before: { value: 1 }, after: { value: 0 } })
      ])
      expect(cancelled.statuses[cancelled.statuses.length - 1]?.status).toBe(
        'rolled-back'
      )
    })

    it('delivery', () => {
      expect(cancelled.beforeClose).toEqual({
        projectionCount: 1,
        publicationCount: 1
      })
      expect(cancelled.projected).toHaveLength(2)
      expect(cancelled.projected[1]).toMatchObject({
        before: { value: 1 },
        after: { value: 0 }
      })
      expect(cancelled.publications.map((value) => value.origin)).toEqual([
        'action',
        'rollback-compensation'
      ])
      expect(cancelled.publications[1]?.compensatesPublicationId).toBe(
        cancelled.publications[0]?.publicationId
      )
    })
  })
})
