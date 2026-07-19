import {
  Factory,
  LocalSharedDataChannel,
  type SharedDelivery
} from '@asyra/factory'
import { describe, expect, it, vi } from 'vitest'
import type { ConflictAcceptedOperation } from '../conflict-policy'
import {
  OperationOutcomeRegistry,
  runRemoteCanonicalApply,
  validateRemoteOperation
} from '../inbound-pipeline'
import {
  defineCanonicalOperationApply,
  OperationRegistry
} from '../operation-registry'

interface ValuePayload {
  id: string
  before: number
  after: number
}

const TEST_CHANNEL = 'sceneTree'
const TEST_EVENT = 'updateComputedData'

const operationRegistry = () =>
  new OperationRegistry([
    {
      channel: TEST_CHANNEL,
      eventName: TEST_EVENT,
      schemaVersion: 1,
      validate: (payload): payload is ValuePayload => {
        if (!payload || typeof payload !== 'object') return false
        const value = payload as Partial<ValuePayload>
        return (
          typeof value.id === 'string' &&
          typeof value.before === 'number' &&
          typeof value.after === 'number'
        )
      }
    }
  ])

const validatedDecision = () => {
  const outcomes = new OperationOutcomeRegistry()
  const registry = operationRegistry()
  const result = validateRemoteOperation({
    decoded: {
      operationId: 'actor-a:session-a:1:forward',
      transactionId: 'actor-a:session-a:1',
      documentId: 'document-a',
      actorId: 'actor-a',
      protocolVersion: 1,
      schemaVersion: 1,
      origin: 'action',
      channel: TEST_CHANNEL,
      eventName: TEST_EVENT,
      payload: { id: 'node-a', before: 0, after: 1 }
    },
    documentId: 'document-a',
    registry,
    outcomes
  })
  if (result.status !== 'validated') throw new Error('expected validation')
  const decision: ConflictAcceptedOperation = {
    status: 'accepted',
    receivedEnvelope: result.envelope,
    envelope: result.envelope
  }
  return { decision, outcomes, registry }
}

const harness = () => {
  const factory = new Factory()
  const channel = new LocalSharedDataChannel()
  factory.registerSharedDataChannel(TEST_CHANNEL, channel)
  const projection: ValuePayload[] = []
  factory.observeSharedDataChannel<ValuePayload>(TEST_CHANNEL, (payload) =>
    projection.push(payload)
  )
  const deliveries: SharedDelivery[] = []
  factory.subscribeToSharedDelivery((delivery) => deliveries.push(delivery))
  const statuses: Parameters<
    Parameters<Factory['subscribeToTransactionStatus']>[0]
  >[0][] = []
  factory.subscribeToTransactionStatus((status) => statuses.push(status))
  const state = { value: 0 }

  factory.registerTransactionInverter(TEST_EVENT, (event) => {
    const payload = (event as unknown as { payload: ValuePayload }).payload
    return {
      type: event.type,
      payload: { ...payload, before: payload.after, after: payload.before }
    } as typeof event
  })
  factory.registerTransactionReplayHandler(TEST_EVENT, (event) => {
    state.value = (event as unknown as { payload: ValuePayload }).payload.after
    return true
  })

  const apply = (
    payload: ValuePayload,
    sharedDelivery: 'transaction-end' | 'immediate' = 'transaction-end'
  ) => {
    state.value = payload.after
    factory.updateTransaction({
      type: 'updateTransaction' as Parameters<
        Factory['updateTransaction']
      >[0]['type'],
      eventName: TEST_EVENT,
      payload,
      options: {
        undoable: true,
        rollbackable: true,
        shared: TEST_CHANNEL,
        sharedDelivery
      }
    })
  }

  return { factory, projection, deliveries, statuses, state, apply }
}

describe('remote canonical apply transaction', () => {
  it('commits one rollbackable, non-undoable remote transaction with local projection and no network echo', () => {
    const target = harness()
    const { decision, outcomes } = validatedDecision()
    const handler = vi.fn((envelope: ConflictAcceptedOperation['envelope']) => {
      target.apply(envelope.payload as ValuePayload)
      return true
    })

    const result = runRemoteCanonicalApply({
      operation: decision,
      factory: target.factory,
      apply: defineCanonicalOperationApply(handler),
      outcomes
    })

    expect(result).toEqual({
      status: 'accepted',
      operationId: decision.envelope.operationId,
      applied: true
    })
    expect(handler).toHaveBeenCalledTimes(1)
    expect(target.state.value).toBe(1)
    expect(target.projection).toEqual([
      expect.objectContaining({
        before: 0,
        after: 1,
        options: expect.objectContaining({ undoable: false })
      })
    ])
    expect(target.deliveries).toEqual([])
    expect(target.statuses).toEqual([
      expect.objectContaining({
        origin: 'remote',
        status: 'committed',
        changeCount: 1,
        undoableChangeCount: 0,
        rollbackableChangeCount: 1
      })
    ])

    target.factory.undo()
    expect(target.state.value).toBe(1)
    const duplicate = validateRemoteOperation({
      decoded: decision.receivedEnvelope,
      documentId: 'document-a',
      registry: operationRegistry(),
      outcomes
    })
    expect(duplicate).toEqual(
      expect.objectContaining({
        status: 'duplicate',
        recordedOutcome: expect.objectContaining({ status: 'accepted' })
      })
    )
  })

  it('rolls back a synchronous handler failure and records one apply-failed outcome', () => {
    const target = harness()
    const { decision, outcomes } = validatedDecision()

    const result = runRemoteCanonicalApply({
      operation: decision,
      factory: target.factory,
      apply: defineCanonicalOperationApply((envelope) => {
        target.apply(envelope.payload as ValuePayload)
        throw new Error('canonical handler failed')
      }),
      outcomes
    })

    expect(result).toEqual(
      expect.objectContaining({
        status: 'apply-failed',
        operationId: decision.envelope.operationId,
        code: 'canonical-apply-failed'
      })
    )
    expect(target.state.value).toBe(0)
    expect(target.projection).toEqual([])
    expect(target.deliveries).toEqual([])
    expect(target.statuses.at(-1)).toEqual(
      expect.objectContaining({ origin: 'remote', status: 'rolled-back' })
    )
  })

  it('forces remote mutations to remain rollbackable when a handler opts out', () => {
    const target = harness()
    const { decision, outcomes } = validatedDecision()

    const result = runRemoteCanonicalApply({
      operation: decision,
      factory: target.factory,
      apply: defineCanonicalOperationApply((envelope) => {
        const payload = envelope.payload as ValuePayload
        target.state.value = payload.after
        target.factory.updateTransaction({
          type: 'updateTransaction' as Parameters<
            Factory['updateTransaction']
          >[0]['type'],
          eventName: TEST_EVENT,
          payload,
          options: {
            undoable: true,
            rollbackable: false,
            shared: TEST_CHANNEL
          }
        })
        throw new Error('canonical handler failed')
      }),
      outcomes
    })

    expect(result).toEqual(
      expect.objectContaining({
        status: 'apply-failed',
        code: 'canonical-apply-failed'
      })
    )
    expect(target.state.value).toBe(0)
    expect(target.statuses.at(-1)).toEqual(
      expect.objectContaining({
        origin: 'remote',
        status: 'rolled-back',
        rollbackableChangeCount: 1,
        nonRollbackableChangeCount: 0
      })
    )
  })

  it('compensates immediate local projection on failure without publishing remote forward or compensation', () => {
    const target = harness()
    const { decision, outcomes } = validatedDecision()

    runRemoteCanonicalApply({
      operation: decision,
      factory: target.factory,
      apply: defineCanonicalOperationApply((envelope) => {
        target.apply(envelope.payload as ValuePayload, 'immediate')
        throw new Error('failed after projection')
      }),
      outcomes
    })

    expect(target.state.value).toBe(0)
    expect(target.projection).toEqual([
      expect.objectContaining({ before: 0, after: 1 }),
      expect.objectContaining({ before: 1, after: 0 })
    ])
    expect(target.deliveries).toEqual([])
  })

  it('acknowledges a semantic no-op without fabricating a mutation', () => {
    const target = harness()
    const { decision, outcomes } = validatedDecision()

    const result = runRemoteCanonicalApply({
      operation: decision,
      factory: target.factory,
      apply: defineCanonicalOperationApply(() => false),
      outcomes
    })

    expect(result).toEqual({
      status: 'accepted',
      operationId: decision.envelope.operationId,
      applied: false
    })
    expect(target.statuses).toEqual([
      expect.objectContaining({ origin: 'remote', status: 'discarded' })
    ])
    expect(target.state.value).toBe(0)
  })

  it('fails closed and rolls back when a registered handler returns a promise', () => {
    const target = harness()
    const { decision, outcomes } = validatedDecision()

    const result = runRemoteCanonicalApply({
      operation: decision,
      factory: target.factory,
      apply: defineCanonicalOperationApply((envelope) => {
        target.apply(envelope.payload as ValuePayload)
        return Promise.reject(
          new Error('async handler rejected')
        ) as unknown as boolean
      }),
      outcomes
    })

    expect(result).toEqual(
      expect.objectContaining({
        status: 'apply-failed',
        code: 'async-handler-not-supported'
      })
    )
    expect(target.state.value).toBe(0)
  })

  it('does not classify an ordinary handler error by matching its message text', () => {
    const target = harness()
    const { decision, outcomes } = validatedDecision()

    const result = runRemoteCanonicalApply({
      operation: decision,
      factory: target.factory,
      apply: defineCanonicalOperationApply(() => {
        throw new Error(
          '[collaboration] remote canonical apply handler must be synchronous'
        )
      }),
      outcomes
    })

    expect(result).toEqual(
      expect.objectContaining({
        status: 'apply-failed',
        code: 'canonical-apply-failed'
      })
    )
  })

  it('forbids a remote handler from consuming ordinary local undo history', () => {
    const target = harness()
    target.factory.startTransaction()
    target.apply({ id: 'node-a', before: 0, after: 1 })
    target.factory.endTransaction()
    target.projection.length = 0
    target.deliveries.length = 0
    target.statuses.length = 0
    const { decision, outcomes } = validatedDecision()

    const result = runRemoteCanonicalApply({
      operation: decision,
      factory: target.factory,
      apply: defineCanonicalOperationApply(() => {
        target.factory.undo()
      }),
      outcomes
    })

    expect(result).toEqual(
      expect.objectContaining({
        status: 'apply-failed',
        code: 'canonical-apply-failed'
      })
    )
    expect(target.state.value).toBe(1)
    target.factory.undo()
    expect(target.state.value).toBe(0)
  })

  it('preserves a package state-owner rejection without fabricating a canonical prefix', () => {
    const target = harness()
    const { decision, outcomes } = validatedDecision()
    const stateOwner = {
      validateAndApply: vi.fn((_payload: unknown) => {
        throw new Error('package invariant rejected operation')
      })
    }

    const result = runRemoteCanonicalApply({
      operation: decision,
      factory: target.factory,
      apply: defineCanonicalOperationApply((envelope) =>
        stateOwner.validateAndApply(envelope.payload)
      ),
      outcomes
    })

    expect(result).toEqual(
      expect.objectContaining({
        status: 'apply-failed',
        code: 'canonical-apply-failed'
      })
    )
    expect(stateOwner.validateAndApply).toHaveBeenCalledTimes(1)
    expect(target.state.value).toBe(0)
    expect(target.projection).toEqual([])
    expect(target.deliveries).toEqual([])
    expect(target.statuses).toEqual([
      expect.objectContaining({ origin: 'remote', status: 'discarded' })
    ])
  })
})
