import { describe, expect, it, vi } from 'vitest'
import {
  createConflictPolicy,
  type AppConflictPolicy
} from '../operations/conflict'
import { OperationRegistry } from '../operations/registry'
import type { ValidatedRemoteOperation } from '../operations/validation'

interface Payload {
  entityId: string
  value: number
}

const isPayload = (payload: unknown): payload is Payload => {
  if (!payload || typeof payload !== 'object') return false
  const candidate = payload as Partial<Payload>
  return (
    typeof candidate.entityId === 'string' &&
    typeof candidate.value === 'number'
  )
}

const registry = (
  validate: (payload: unknown) => payload is Payload = isPayload
) =>
  new OperationRegistry([
    {
      channel: 'scene',
      eventName: 'set-value',
      schemaVersion: 1,
      validate
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
  options: {
    permissionPolicy?: () => boolean | Promise<boolean>
    appPolicies?: readonly AppConflictPolicy[]
    operationRegistry?: OperationRegistry
  } = {}
) =>
  createConflictPolicy({
    operationRegistry: options.operationRegistry ?? registry(),
    permissionPolicy: options.permissionPolicy ?? (() => true),
    appPolicies: options.appPolicies ?? []
  })

describe('permission and conflict policy pipeline', () => {
  it('runs permission before app policies', async () => {
    const app = vi.fn(() => ({ decision: 'accept' as const }))
    const result = await pipeline({
      permissionPolicy: () => false,
      appPolicies: [{ id: 'app-policy', decide: app }]
    }).decide(operation())

    expect(result).toEqual({
      status: 'rejected',
      owner: 'permission',
      code: 'unauthorized',
      operationId: 'actor-a:session-a:1:forward'
    })
    expect(app).not.toHaveBeenCalled()
  })

  it('accepts the validated operation unchanged when no app policy applies', async () => {
    const payload = { entityId: 'node-a', value: 1 }
    const result = await pipeline({
      appPolicies: [
        { id: 'not-applicable', decide: () => ({ decision: 'not-applicable' }) }
      ]
    }).decide(operation(payload))

    expect(result.status).toBe('accepted')
    if (result.status !== 'accepted') throw new Error('expected acceptance')
    expect(result.envelope.payload).toEqual(payload)
    expect(result.receivedEnvelope).toEqual(result.envelope)
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.envelope.payload)).toBe(true)
  })

  it('runs app policies in registration order and exposes a validated repair', async () => {
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
    if (result.status !== 'repaired') throw new Error('expected repair')
    expect(result.receivedEnvelope.payload).toEqual({
      entityId: 'node-a',
      value: 1
    })
    expect(result.envelope.payload).toEqual({ entityId: 'node-a', value: 2 })
  })

  it('rejects invalid or throwing repair validation', async () => {
    const invalid = await pipeline({
      appPolicies: [
        {
          id: 'invalid-repair',
          decide: () => ({
            decision: 'repair',
            payload: { entityId: 'node-a', value: 'invalid' }
          })
        }
      ]
    }).decide(operation())
    expect(invalid).toEqual(
      expect.objectContaining({
        status: 'rejected',
        owner: 'app',
        policyId: 'invalid-repair',
        code: 'invalid-repair'
      })
    )

    const throwingRegistry = registry((payload): payload is Payload => {
      if ((payload as Partial<Payload> | null)?.value === 2) {
        throw new Error('repair validator failed')
      }
      return isPayload(payload)
    })
    const throwing = await pipeline({
      operationRegistry: throwingRegistry,
      appPolicies: [
        {
          id: 'throwing-repair',
          decide: () => ({
            decision: 'repair',
            payload: { entityId: 'node-a', value: 2 }
          })
        }
      ]
    }).decide(operation())
    expect(throwing).toEqual(
      expect.objectContaining({
        status: 'rejected',
        policyId: 'throwing-repair',
        code: 'invalid-repair'
      })
    )
  })

  it('returns stable permission and app policy failures', async () => {
    expect(
      await pipeline({
        permissionPolicy: async () => {
          throw new Error('permission unavailable')
        }
      }).decide(operation())
    ).toEqual(
      expect.objectContaining({
        status: 'rejected',
        owner: 'permission',
        code: 'permission-error'
      })
    )

    expect(
      await pipeline({
        appPolicies: [
          {
            id: 'rejecting-policy',
            decide: () => ({ decision: 'reject', code: 'locked' })
          }
        ]
      }).decide(operation())
    ).toEqual(
      expect.objectContaining({
        status: 'rejected',
        owner: 'app',
        policyId: 'rejecting-policy',
        code: 'locked'
      })
    )

    expect(
      await pipeline({
        appPolicies: [
          {
            id: 'throwing-policy',
            decide: () => {
              throw new Error('policy failed')
            }
          }
        ]
      }).decide(operation())
    ).toEqual(
      expect.objectContaining({
        status: 'rejected',
        owner: 'app',
        policyId: 'throwing-policy',
        code: 'policy-error'
      })
    )
  })

  it('fails closed for malformed decisions and policy registrations', async () => {
    const malformed = await pipeline({
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
    expect(malformed).toEqual(
      expect.objectContaining({
        status: 'rejected',
        owner: 'app',
        policyId: 'malformed',
        code: 'invalid-policy-decision'
      })
    )

    expect(() =>
      pipeline({
        appPolicies: [{ id: ' ', decide: () => ({ decision: 'accept' }) }]
      })
    ).toThrow('[collaboration] app policy id is required')
    expect(() =>
      pipeline({
        appPolicies: [
          { id: 'duplicate', decide: () => ({ decision: 'accept' }) },
          { id: 'duplicate', decide: () => ({ decision: 'accept' }) }
        ]
      })
    ).toThrow('[collaboration] duplicate conflict policy duplicate')
  })

  it('snapshots app policy registration per instance', () => {
    const policies: AppConflictPolicy[] = [
      { id: 'first', decide: () => ({ decision: 'accept' }) }
    ]
    const instance = pipeline({ appPolicies: policies })
    policies.push({
      id: 'late',
      decide: () => ({ decision: 'reject', code: 'late' })
    })

    expect(instance.policyIds()).toEqual(['first'])
  })

  it('permits an explicit app policy to converge reordered domain operations', async () => {
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
        const outcome = await instance.decide({
          ...base,
          envelope: {
            ...base.envelope,
            operationId: `actor-a:session-a:${value}:forward`,
            transactionId: `actor-a:session-a:${value}`
          }
        })
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
