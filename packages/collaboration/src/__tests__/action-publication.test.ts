import * as Y from 'yjs'
import { Factory, LocalSharedDataChannel } from '@asyra/factory'
import { describe, expect, it, vi } from 'vitest'
import {
  createCollaboration,
  defineCanonicalOperationApply,
  MemoryHub,
  MemoryProvider
} from '..'
import { applyInboundYjsUpdate, readOperationLog } from '../yjs-document'

const CHANNEL = 'document'
const SET_VALUE = 'set-value'

interface SetValuePayload {
  id: string
  before: number
  after: number
}

const createHarness = (registeredEvents: readonly string[] = [SET_VALUE]) => {
  const factory = new Factory()
  factory.registerSharedDataChannel(CHANNEL, new LocalSharedDataChannel())
  const provider = new MemoryProvider(new MemoryHub(), {
    documentId: 'document-a',
    roomId: 'room-a',
    actorId: 'actor-a'
  })
  const sendUpdate = vi.spyOn(provider, 'sendUpdate')
  factory.registerTransactionInverter(SET_VALUE, (event) => {
    const payload = (event as unknown as { payload: SetValuePayload }).payload
    return {
      ...event,
      payload: {
        ...payload,
        before: payload.after,
        after: payload.before
      }
    } as typeof event
  })
  const instance = createCollaboration({
    documentId: 'document-a',
    roomId: 'room-a',
    actorId: 'actor-a',
    factory,
    provider,
    operationDefinitions: registeredEvents.map((eventName) => ({
      channel: CHANNEL,
      eventName,
      schemaVersion: 1,
      validate: (payload: unknown): payload is SetValuePayload => {
        if (!payload || typeof payload !== 'object') return false
        const value = payload as Partial<SetValuePayload>
        return (
          typeof value.id === 'string' &&
          typeof value.before === 'number' &&
          typeof value.after === 'number'
        )
      },
      apply: defineCanonicalOperationApply(() => true)
    })),
    permissionPolicy: () => true,
    resourceOwnership: { provider: 'owned' }
  })
  const update = (
    id: string,
    after: number,
    options: {
      eventName?: string
      rollbackable?: boolean
    } = {}
  ) => {
    factory.updateTransaction({
      type: 'updateTransaction' as Parameters<
        Factory['updateTransaction']
      >[0]['type'],
      eventName: options.eventName ?? SET_VALUE,
      payload: { id, before: after - 1, after },
      options: {
        undoable: false,
        rollbackable: options.rollbackable ?? false,
        shared: CHANNEL,
        sharedDelivery: 'immediate'
      }
    })
  }
  return { factory, instance, provider, sendUpdate, update }
}

describe('Collaboration action publication transport', () => {
  it('sends one ordered immediate batch before the outer undo transaction ends', async () => {
    const { factory, instance, sendUpdate, update } = createHarness()
    await instance.start()

    factory.startTransaction()
    update('element-a', 1)
    update('element-b', 2)
    await Promise.resolve()
    await instance.whenIdle()

    expect(sendUpdate).toHaveBeenCalledTimes(1)
    expect(readOperationLog(instance.yDoc)).toEqual([
      expect.objectContaining({
        payload: expect.objectContaining({ id: 'element-a' })
      }),
      expect.objectContaining({
        payload: expect.objectContaining({ id: 'element-b' })
      })
    ])

    const transported = sendUpdate.mock.calls[0]?.[0]
    expect(transported).toBeDefined()
    if (!transported) throw new Error('expected one transported action update')
    const receiver = new Y.Doc()
    const decoded = applyInboundYjsUpdate(
      receiver,
      transported.update,
      'provider'
    )
    expect(decoded.operations).toHaveLength(2)
    expect(readOperationLog(receiver)).toEqual(readOperationLog(instance.yDoc))

    factory.endTransaction()
    await instance.whenIdle()
    expect(sendUpdate).toHaveBeenCalledTimes(1)

    await instance.dispose()
  })

  it('transports one linked compensation batch after a flushed immediate action rolls back', async () => {
    const { factory, instance, sendUpdate, update } = createHarness()
    await instance.start()

    factory.startTransaction()
    update('element-a', 1, { rollbackable: true })
    await Promise.resolve()
    await instance.whenIdle()

    expect(sendUpdate).toHaveBeenCalledTimes(1)
    factory.endTransaction({ outcome: 'rollback' })
    await instance.whenIdle()

    expect(sendUpdate).toHaveBeenCalledTimes(2)
    expect(readOperationLog(instance.yDoc)).toEqual([
      expect.objectContaining({
        payload: expect.objectContaining({ id: 'element-a', after: 1 })
      }),
      expect.objectContaining({
        origin: 'rollback-compensation',
        payload: expect.objectContaining({ id: 'element-a', after: 0 }),
        compensatesOperationId: expect.any(String)
      })
    ])

    await instance.dispose()
  })

  it('rejects the whole action before Y.Doc mutation when one delivery is invalid', async () => {
    const { factory, instance, sendUpdate, update } = createHarness()
    const outcomes: unknown[] = []
    instance.observeOperationOutcomes((outcome) => outcomes.push(outcome))
    await instance.start()

    factory.startTransaction()
    update('element-a', 1)
    update('element-b', 2, { eventName: 'unregistered-event' })
    factory.endTransaction()
    await instance.whenIdle()

    expect(sendUpdate).not.toHaveBeenCalled()
    expect(readOperationLog(instance.yDoc)).toEqual([])
    expect(outcomes).toEqual([
      expect.objectContaining({ direction: 'local', status: 'rejected' })
    ])

    await instance.dispose()
  })
})
