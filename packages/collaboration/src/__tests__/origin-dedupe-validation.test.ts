import { describe, expect, it, vi } from 'vitest'
import {
  OperationOutcomeRegistry,
  validateRemoteOperation
} from '../inbound-pipeline'
import { OperationRegistry } from '../operation-registry'
import type { SharedOperationEnvelope } from '../operation-envelope'

const definition = {
  channel: 'scene',
  eventName: 'set-value',
  schemaVersion: 2,
  validate: (payload: unknown): payload is { id: string; value: number } => {
    if (!payload || typeof payload !== 'object') return false
    const candidate = payload as { id?: unknown; value?: unknown }
    return (
      typeof candidate.id === 'string' && typeof candidate.value === 'number'
    )
  }
}

const envelope = (overrides: Record<string, unknown> = {}): unknown => ({
  operationId: 'actor-a:session-a:1:forward',
  transactionId: 'actor-a:session-a:1',
  documentId: 'document-a',
  actorId: 'actor-a',
  protocolVersion: 1,
  schemaVersion: 2,
  origin: 'action',
  channel: 'scene',
  eventName: 'set-value',
  payload: { id: 'node-a', value: 1 },
  ...overrides
})

const setup = () => ({
  registry: new OperationRegistry([definition]),
  outcomes: new OperationOutcomeRegistry(),
  documentId: 'document-a'
})

describe('remote origin, dedupe, protocol, and payload validation', () => {
  it('returns a deeply immutable validated remote operation', () => {
    const result = validateRemoteOperation({ decoded: envelope(), ...setup() })

    expect(result.status).toBe('validated')
    if (result.status !== 'validated') throw new Error('expected validation')
    expect(result.envelope).toEqual(envelope())
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.envelope)).toBe(true)
    expect(Object.isFrozen(result.envelope.payload)).toBe(true)
  })

  it('returns the recorded deterministic outcome for an identical replay', () => {
    const context = setup()
    const first = validateRemoteOperation({ decoded: envelope(), ...context })
    if (first.status !== 'validated') throw new Error('expected validation')
    context.outcomes.record(first.envelope, {
      status: 'accepted',
      operationId: first.envelope.operationId,
      applied: true
    })
    const permission = vi.fn()
    const canonicalApply = vi.fn()

    const duplicate = validateRemoteOperation({
      decoded: envelope(),
      ...context
    })

    expect(duplicate).toEqual({
      status: 'duplicate',
      operationId: 'actor-a:session-a:1:forward',
      recordedOutcome: {
        status: 'accepted',
        operationId: 'actor-a:session-a:1:forward',
        applied: true
      }
    })
    expect(Object.isFrozen(duplicate)).toBe(true)
    expect(permission).not.toHaveBeenCalled()
    expect(canonicalApply).not.toHaveBeenCalled()
  })

  it('classifies a locally committed operation replay before remote policy or apply', () => {
    const context = setup()
    const localEnvelope = envelope() as SharedOperationEnvelope

    context.outcomes.recordLocal(localEnvelope)

    expect(
      validateRemoteOperation({ decoded: envelope(), ...context })
    ).toEqual({
      status: 'duplicate',
      operationId: 'actor-a:session-a:1:forward',
      recordedOutcome: {
        status: 'accepted',
        operationId: 'actor-a:session-a:1:forward',
        applied: true
      }
    })
    expect(
      validateRemoteOperation({
        decoded: envelope({ payload: { id: 'node-a', value: 2 } }),
        ...context
      })
    ).toEqual(expect.objectContaining({ code: 'operation-identity-collision' }))
  })

  it('rejects an operation-id replay with different content as a collision', () => {
    const context = setup()
    validateRemoteOperation({ decoded: envelope(), ...context })

    const collision = validateRemoteOperation({
      decoded: envelope({ payload: { id: 'node-a', value: 2 } }),
      ...context
    })

    expect(collision).toEqual({
      status: 'rejected',
      owner: 'validation',
      code: 'operation-identity-collision',
      operationId: 'actor-a:session-a:1:forward'
    })

    expect(
      validateRemoteOperation({
        decoded: envelope({ hiddenMetadata: 'different-envelope' }),
        ...context
      })
    ).toEqual(
      expect.objectContaining({
        code: 'operation-identity-collision',
        operationId: 'actor-a:session-a:1:forward'
      })
    )
  })

  it.each([
    ['operationId', '', 'invalid-operation-id'],
    ['transactionId', '', 'invalid-transaction-id'],
    ['documentId', '', 'invalid-document-id'],
    ['actorId', '', 'invalid-actor-id'],
    ['protocolVersion', 0, 'unsupported-protocol'],
    ['schemaVersion', 1, 'unsupported-schema'],
    ['origin', 'remote', 'unsupported-origin'],
    ['channel', '', 'invalid-channel'],
    ['eventName', '', 'invalid-event-name']
  ])('rejects invalid %s before policy or apply', (field, value, code) => {
    const result = validateRemoteOperation({
      decoded: envelope({ [field]: value }),
      ...setup()
    })

    expect(result).toEqual(
      expect.objectContaining({
        status: 'rejected',
        owner: 'validation',
        code
      })
    )
  })

  it('binds a live provider operation to its authenticated author', () => {
    expect(
      validateRemoteOperation({
        decoded: envelope(),
        ...setup(),
        authenticatedActorId: 'actor-b'
      })
    ).toEqual(
      expect.objectContaining({
        status: 'rejected',
        owner: 'validation',
        code: 'actor-mismatch',
        operationId: 'actor-a:session-a:1:forward'
      })
    )
    expect(
      validateRemoteOperation({
        decoded: envelope(),
        ...setup(),
        authenticatedActorId: 'actor-a'
      }).status
    ).toBe('validated')
  })

  it('rejects document mismatch, unknown route, and invalid payload', () => {
    expect(
      validateRemoteOperation({
        decoded: envelope(),
        ...setup(),
        documentId: 'other'
      })
    ).toEqual(expect.objectContaining({ code: 'document-mismatch' }))
    expect(
      validateRemoteOperation({
        decoded: envelope({ eventName: 'unknown' }),
        ...setup()
      })
    ).toEqual(expect.objectContaining({ code: 'unregistered-operation' }))
    expect(
      validateRemoteOperation({
        decoded: envelope({ payload: { id: 'node-a', value: 'bad' } }),
        ...setup()
      })
    ).toEqual(expect.objectContaining({ code: 'invalid-payload' }))
  })

  it('contains a throwing payload validator so a following operation can continue', () => {
    const registry = new OperationRegistry([
      {
        ...definition,
        validate: (
          payload: unknown
        ): payload is { id: string; value: number } => {
          if ((payload as { id?: unknown } | null)?.id === 'throw') {
            throw new Error('validator failed')
          }
          return definition.validate(payload)
        }
      }
    ])
    const outcomes = new OperationOutcomeRegistry()
    const context = { registry, outcomes, documentId: 'document-a' }

    expect(
      validateRemoteOperation({
        decoded: envelope({
          operationId: 'actor-a:session-a:1:throw',
          payload: { id: 'throw', value: 1 }
        }),
        ...context
      })
    ).toEqual(
      expect.objectContaining({
        status: 'rejected',
        owner: 'validation',
        code: 'invalid-payload'
      })
    )
    expect(
      validateRemoteOperation({
        decoded: envelope({
          operationId: 'actor-a:session-a:1:following',
          payload: { id: 'following', value: 2 }
        }),
        ...context
      }).status
    ).toBe('validated')
  })

  it('preserves prototype-named JSON keys as data without inherited payload authority', () => {
    const nested = JSON.parse(
      '{"__proto__":{"claimedPermission":"write"},"label":"safe"}'
    ) as Record<string, unknown>

    const result = validateRemoteOperation({
      decoded: envelope({
        payload: { id: 'node-a', value: 1, nested }
      }),
      ...setup()
    })

    expect(result.status).toBe('validated')
    if (result.status !== 'validated') throw new Error('expected validation')
    const cloned = (
      result.envelope.payload as { nested: Record<string, unknown> }
    ).nested
    expect(Object.getPrototypeOf(cloned)).toBe(Object.prototype)
    expect(Object.prototype.hasOwnProperty.call(cloned, '__proto__')).toBe(true)
    expect(cloned.__proto__).toEqual({ claimedPermission: 'write' })
    expect(
      Object.prototype.hasOwnProperty.call(cloned, 'claimedPermission')
    ).toBe(false)
    expect('claimedPermission' in cloned).toBe(false)
  })

  it('rejects accessor-backed envelope fields without executing them', () => {
    const getter = vi.fn(() => ({ id: 'node-a', value: 1 }))
    const decoded = envelope() as Record<string, unknown>
    Object.defineProperty(decoded, 'payload', {
      enumerable: true,
      get: getter
    })

    expect(validateRemoteOperation({ decoded, ...setup() })).toEqual(
      expect.objectContaining({
        status: 'rejected',
        owner: 'validation',
        code: 'malformed-envelope'
      })
    )
    expect(getter).not.toHaveBeenCalled()
  })

  it('validates exact compensation metadata', () => {
    const validContext = setup()
    validContext.outcomes.recordLocal(envelope() as SharedOperationEnvelope)
    const valid = validateRemoteOperation({
      decoded: envelope({
        operationId: 'actor-a:session-a:1:compensation',
        origin: 'rollback-compensation',
        compensatesOperationId: 'actor-a:session-a:1:forward'
      }),
      ...validContext
    })
    const missing = validateRemoteOperation({
      decoded: envelope({
        operationId: 'actor-a:session-a:2:compensation',
        transactionId: 'actor-a:session-a:2',
        origin: 'rollback-compensation'
      }),
      ...setup()
    })
    const unexpected = validateRemoteOperation({
      decoded: envelope({
        operationId: 'actor-a:session-a:3:forward',
        transactionId: 'actor-a:session-a:3',
        compensatesOperationId: 'actor-a:session-a:1:forward'
      }),
      ...setup()
    })
    const malformed = validateRemoteOperation({
      decoded: envelope({
        operationId: 'actor-a:session-a:4:compensation',
        transactionId: 'actor-a:session-a:4',
        origin: 'rollback-compensation',
        compensatesOperationId: 123
      }),
      ...setup()
    })

    expect(valid.status).toBe('validated')
    expect(missing).toEqual(
      expect.objectContaining({ code: 'invalid-compensation' })
    )
    expect(unexpected).toEqual(
      expect.objectContaining({ code: 'invalid-compensation' })
    )
    expect(malformed).toEqual(
      expect.objectContaining({ code: 'invalid-compensation' })
    )
  })

  it('requires compensation to reference an applied same-actor forward', () => {
    const unavailable = validateRemoteOperation({
      decoded: envelope({
        operationId: 'actor-a:session-a:2:compensation',
        transactionId: 'actor-a:session-a:2',
        origin: 'rollback-compensation',
        compensatesOperationId: 'actor-a:session-a:1:forward'
      }),
      ...setup()
    })

    const actorContext = setup()
    actorContext.outcomes.recordLocal(
      envelope({
        operationId: 'actor-b:session-b:1:forward',
        transactionId: 'actor-b:session-b:1',
        actorId: 'actor-b'
      }) as SharedOperationEnvelope
    )
    const actorMismatch = validateRemoteOperation({
      decoded: envelope({
        operationId: 'actor-a:session-a:2:compensation',
        transactionId: 'actor-a:session-a:2',
        origin: 'rollback-compensation',
        compensatesOperationId: 'actor-b:session-b:1:forward'
      }),
      ...actorContext
    })

    const noOpContext = setup()
    const noOpForward = validateRemoteOperation({
      decoded: envelope(),
      ...noOpContext
    })
    if (noOpForward.status !== 'validated') {
      throw new Error('expected forward validation')
    }
    noOpContext.outcomes.record(noOpForward.envelope, {
      status: 'accepted',
      operationId: noOpForward.envelope.operationId,
      applied: false
    })
    const notApplied = validateRemoteOperation({
      decoded: envelope({
        operationId: 'actor-a:session-a:2:compensation',
        transactionId: 'actor-a:session-a:2',
        origin: 'rollback-compensation',
        compensatesOperationId: noOpForward.envelope.operationId
      }),
      ...noOpContext
    })

    expect(unavailable).toEqual(
      expect.objectContaining({ code: 'compensation-forward-unavailable' })
    )
    expect(actorMismatch).toEqual(
      expect.objectContaining({ code: 'compensation-forward-actor-mismatch' })
    )
    expect(notApplied).toEqual(
      expect.objectContaining({ code: 'compensation-forward-not-applied' })
    )
  })

  it.each(['rejected', 'apply-failed'] as const)(
    'does not compensate a %s forward outcome',
    (status) => {
      const context = setup()
      const forward = validateRemoteOperation({
        decoded: envelope(),
        ...context
      })
      if (forward.status !== 'validated') {
        throw new Error('expected forward validation')
      }
      context.outcomes.record(forward.envelope, {
        status,
        operationId: forward.envelope.operationId,
        applied: false,
        code: `test-${status}`
      })

      expect(
        validateRemoteOperation({
          decoded: envelope({
            operationId: 'actor-a:session-a:2:compensation',
            transactionId: 'actor-a:session-a:2',
            origin: 'rollback-compensation',
            compensatesOperationId: forward.envelope.operationId
          }),
          ...context
        })
      ).toEqual(
        expect.objectContaining({ code: 'compensation-forward-not-applied' })
      )
    }
  )

  it('does not let a compensation target another compensation', () => {
    const context = setup()
    context.outcomes.recordLocal(envelope() as SharedOperationEnvelope)
    const firstCompensation = envelope({
      operationId: 'actor-a:session-a:2:compensation',
      transactionId: 'actor-a:session-a:2',
      origin: 'rollback-compensation',
      compensatesOperationId: 'actor-a:session-a:1:forward'
    }) as SharedOperationEnvelope
    context.outcomes.recordLocal(firstCompensation)

    expect(
      validateRemoteOperation({
        decoded: envelope({
          operationId: 'actor-a:session-a:3:compensation',
          transactionId: 'actor-a:session-a:3',
          origin: 'rollback-compensation',
          compensatesOperationId: firstCompensation.operationId
        }),
        ...context
      })
    ).toEqual(
      expect.objectContaining({ code: 'compensation-target-not-forward' })
    )
  })

  it('keeps dedupe state isolated per collaboration instance', () => {
    const first = setup()
    const second = setup()

    expect(
      validateRemoteOperation({ decoded: envelope(), ...first }).status
    ).toBe('validated')
    expect(
      validateRemoteOperation({ decoded: envelope(), ...second }).status
    ).toBe('validated')
  })
})
