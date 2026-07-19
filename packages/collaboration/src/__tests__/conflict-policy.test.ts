import { describe, expect, it, vi } from 'vitest'
import {
  createConflictPolicyPipeline,
  type AppConflictPolicy,
  type FrameworkInvariantConfiguration
} from '../conflict-policy'
import type { ValidatedRemoteOperation } from '../inbound-pipeline'
import { OperationRegistry } from '../operation-registry'

interface Payload {
  entityId: string
  value: number
  parentId?: string
}

const isPayload = (payload: unknown): payload is Payload => {
  if (!payload || typeof payload !== 'object') return false
  const candidate = payload as Partial<Payload>
  return (
    typeof candidate.entityId === 'string' &&
    typeof candidate.value === 'number' &&
    (candidate.parentId === undefined || typeof candidate.parentId === 'string')
  )
}

const registry = () =>
  new OperationRegistry([
    {
      channel: 'scene',
      eventName: 'set-value',
      schemaVersion: 1,
      validate: isPayload
    }
  ])

const operation = (
  payload: Payload = { entityId: 'node-a', value: 1 }
): ValidatedRemoteOperation => ({
  status: 'validated',
  envelope: {
    operationId: 'actor-a:session-a:1:forward',
    transactionId: 'actor-a:session-a:1',
    documentId: 'document-a',
    actorId: 'actor-a',
    protocolVersion: 1,
    schemaVersion: 1,
    origin: 'action',
    channel: 'scene',
    eventName: 'set-value',
    payload
  }
})

const pipeline = (
  overrides: {
    permissionPolicy?: () => boolean | Promise<boolean>
    frameworkInvariants?: FrameworkInvariantConfiguration
    appPolicies?: readonly AppConflictPolicy[]
  } = {}
) =>
  createConflictPolicyPipeline({
    operationRegistry: registry(),
    permissionPolicy: overrides.permissionPolicy ?? (() => true),
    frameworkInvariants: overrides.frameworkInvariants ?? {},
    appPolicies: overrides.appPolicies ?? []
  })

describe('permission and conflict policy pipeline', () => {
  it('runs permission before every conflict policy and returns no accepted operation when unauthorized', async () => {
    const entity = vi.fn(() => undefined)
    const app = vi.fn(() => ({ decision: 'accept' as const }))
    const result = await pipeline({
      permissionPolicy: () => false,
      frameworkInvariants: { entity: { describe: entity, exists: () => true } },
      appPolicies: [{ id: 'app-policy', decide: app }]
    }).decide(operation())

    expect(result).toEqual({
      status: 'rejected',
      owner: 'permission',
      code: 'unauthorized',
      operationId: 'actor-a:session-a:1:forward'
    })
    expect(entity).not.toHaveBeenCalled()
    expect(app).not.toHaveBeenCalled()
  })

  it('enforces entity existence while treating repeated delete as idempotent', async () => {
    const frameworkInvariants: FrameworkInvariantConfiguration = {
      entity: {
        describe: (envelope) => ({
          entityId: (envelope.payload as Payload).entityId,
          intent:
            (envelope.payload as Payload).value === -1 ? 'delete' : 'update'
        }),
        exists: () => false
      }
    }

    const update = await pipeline({ frameworkInvariants }).decide(operation())
    const repeatedDelete = await pipeline({ frameworkInvariants }).decide(
      operation({ entityId: 'node-a', value: -1 })
    )

    expect(update).toEqual(
      expect.objectContaining({
        status: 'rejected',
        owner: 'framework',
        policyId: 'framework:entity-existence',
        code: 'entity-missing'
      })
    )
    expect(repeatedDelete.status).toBe('accepted')
  })

  it('runs fixed hierarchy and property invariants before app policies', async () => {
    const app = vi.fn(() => ({ decision: 'accept' as const }))
    const hierarchyRejected = await pipeline({
      frameworkInvariants: {
        hierarchy: {
          evaluate: () => ({ decision: 'reject', code: 'missing-parent' })
        }
      },
      appPolicies: [{ id: 'app-policy', decide: app }]
    }).decide(operation())

    expect(hierarchyRejected).toEqual(
      expect.objectContaining({
        policyId: 'framework:hierarchy-membership-order',
        code: 'missing-parent'
      })
    )
    expect(app).not.toHaveBeenCalled()

    const propertyRejected = await pipeline({
      frameworkInvariants: {
        property: {
          evaluate: () => ({ decision: 'reject', code: 'invalid-property' })
        }
      }
    }).decide(operation())
    expect(propertyRejected).toEqual(
      expect.objectContaining({
        policyId: 'framework:property-validation',
        code: 'invalid-property'
      })
    )
  })

  it('repairs hierarchy payload, revalidates it, and exposes immutable received and effective envelopes', async () => {
    const result = await pipeline({
      frameworkInvariants: {
        hierarchy: {
          evaluate: () => ({
            decision: 'repair',
            payload: { entityId: 'node-a', value: 1, parentId: 'root' }
          })
        }
      }
    }).decide(operation())

    expect(result.status).toBe('repaired')
    if (result.status !== 'repaired') throw new Error('expected repair')
    expect(result.receivedEnvelope.payload).toEqual({
      entityId: 'node-a',
      value: 1
    })
    expect(result.envelope.payload).toEqual({
      entityId: 'node-a',
      value: 1,
      parentId: 'root'
    })
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.envelope.payload)).toBe(true)
  })

  it('rejects a repair that fails the registered operation payload validator', async () => {
    const result = await pipeline({
      frameworkInvariants: {
        hierarchy: {
          evaluate: () => ({
            decision: 'repair',
            payload: { entityId: 'node-a', value: 'invalid' }
          })
        }
      }
    }).decide(operation())

    expect(result).toEqual(
      expect.objectContaining({
        status: 'rejected',
        owner: 'framework',
        policyId: 'framework:hierarchy-membership-order',
        code: 'invalid-repair'
      })
    )
  })

  it('contains a validator error while revalidating a repaired payload', async () => {
    const operationRegistry = new OperationRegistry([
      {
        channel: 'scene',
        eventName: 'set-value',
        schemaVersion: 1,
        validate: (payload): payload is Payload => {
          if ((payload as Partial<Payload> | null)?.value === 2) {
            throw new Error('repair validator failed')
          }
          return isPayload(payload)
        }
      }
    ])
    const instance = createConflictPolicyPipeline({
      operationRegistry,
      permissionPolicy: () => true,
      frameworkInvariants: {},
      appPolicies: [
        {
          id: 'repair-to-throwing-value',
          decide: () => ({
            decision: 'repair',
            payload: { entityId: 'node-a', value: 2 }
          })
        }
      ]
    })

    expect(await instance.decide(operation())).toEqual(
      expect.objectContaining({
        status: 'rejected',
        owner: 'app',
        policyId: 'repair-to-throwing-value',
        code: 'invalid-repair'
      })
    )
  })

  it('runs app policies in registration order and revalidates every repair', async () => {
    const order: string[] = []
    const appPolicies: AppConflictPolicy[] = [
      {
        id: 'first',
        decide: () => {
          order.push('first')
          return { decision: 'not-applicable' }
        }
      },
      {
        id: 'second',
        decide: ({ envelope }) => {
          order.push('second')
          return {
            decision: 'repair',
            payload: { ...(envelope.payload as Payload), value: 2 }
          }
        }
      },
      {
        id: 'third',
        decide: ({ envelope }) => {
          order.push(`third:${(envelope.payload as Payload).value}`)
          return { decision: 'accept' }
        }
      }
    ]

    const result = await pipeline({ appPolicies }).decide(operation())

    expect(order).toEqual(['first', 'second', 'third:2'])
    expect(result.status).toBe('repaired')
  })

  it('reserves framework policy IDs and snapshots app registration order per instance', () => {
    const policies: AppConflictPolicy[] = [
      { id: 'first', decide: () => ({ decision: 'accept' }) }
    ]
    const instance = pipeline({ appPolicies: policies })
    policies.push({
      id: 'late',
      decide: () => ({ decision: 'reject', code: 'late' })
    })

    expect(instance.policyIds()).toEqual([
      'framework:entity-existence',
      'framework:hierarchy-membership-order',
      'framework:property-validation',
      'first'
    ])
    expect(() =>
      pipeline({
        appPolicies: [
          {
            id: 'framework:entity-existence',
            decide: () => ({ decision: 'accept' })
          }
        ]
      })
    ).toThrow('[collaboration] app policy cannot use reserved framework id')
  })

  it('snapshots framework invariant adapters so callers cannot replace them after construction', async () => {
    const configuration: FrameworkInvariantConfiguration = {
      entity: {
        describe: () => ({ entityId: 'node-a', intent: 'update' }),
        exists: () => false
      }
    }
    const instance = pipeline({ frameworkInvariants: configuration })
    ;(
      configuration as { entity: FrameworkInvariantConfiguration['entity'] }
    ).entity = {
      describe: () => ({ entityId: 'node-a', intent: 'update' }),
      exists: () => true
    }

    expect(await instance.decide(operation())).toEqual(
      expect.objectContaining({
        status: 'rejected',
        policyId: 'framework:entity-existence',
        code: 'entity-missing'
      })
    )
  })

  it('fails closed when an app policy returns an unknown decision', async () => {
    const result = await pipeline({
      appPolicies: [
        {
          id: 'malformed',
          decide: () =>
            ({ decision: 'surprise' }) as unknown as ReturnType<
              AppConflictPolicy['decide']
            >
        }
      ]
    }).decide(operation())

    expect(result).toEqual(
      expect.objectContaining({
        status: 'rejected',
        owner: 'app',
        policyId: 'malformed',
        code: 'invalid-policy-decision'
      })
    )
  })

  it('lets an app policy converge reordered non-commutative property updates', async () => {
    const applyInOrder = async (values: readonly number[]) => {
      const state = { value: 0 }
      const instance = pipeline({
        appPolicies: [
          {
            id: 'app:max-register',
            decide: ({ envelope }) => {
              const payload = envelope.payload as Payload
              return payload.value < state.value
                ? {
                    decision: 'repair' as const,
                    payload: { ...payload, value: state.value }
                  }
                : { decision: 'accept' as const }
            }
          }
        ]
      })
      const outcomes: string[] = []
      for (const value of values) {
        const base = operation({ entityId: 'node-a', value })
        const candidate: ValidatedRemoteOperation = {
          status: 'validated',
          envelope: {
            ...base.envelope,
            operationId: `actor-a:session-a:${value}:forward`,
            transactionId: `actor-a:session-a:${value}`
          }
        }
        const outcome = await instance.decide(candidate)
        if (outcome.status === 'rejected') throw new Error('unexpected reject')
        outcomes.push(outcome.status)
        state.value = (outcome.envelope.payload as Payload).value
      }
      return { outcomes, value: state.value }
    }

    expect(await applyInOrder([1, 2])).toEqual({
      outcomes: ['accepted', 'accepted'],
      value: 2
    })
    expect(await applyInOrder([2, 1])).toEqual({
      outcomes: ['accepted', 'repaired'],
      value: 2
    })
  })
})
