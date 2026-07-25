import { describe, expect, it, vi } from 'vitest'
import {
  AiPlanNormalizationError,
  AiProviderError,
  MAX_AI_PROVIDER_ATTEMPTS,
  normalizeAiProviderOutput,
  shouldRetryAiProviderFailure,
  toAiPlanningFailure
} from '..'

describe('AI provider result normalization', () => {
  it('detaches and freezes the minimum candidate plan structure', () => {
    const raw = {
      planId: 'plan-1',
      explanation: 'Resize the selected shape',
      actions: [
        {
          id: 'action-1',
          name: 'resize',
          arguments: {
            width: 120
          }
        }
      ]
    }

    const plan = normalizeAiProviderOutput(raw)
    raw.planId = 'mutated'
    raw.actions[0].arguments.width = 999

    expect(plan).toEqual({
      planId: 'plan-1',
      explanation: 'Resize the selected shape',
      actions: [
        {
          id: 'action-1',
          name: 'resize',
          arguments: {
            width: 120
          }
        }
      ]
    })
    expect(Object.isFrozen(plan)).toBe(true)
    expect(Object.isFrozen(plan.actions)).toBe(true)
    expect(Object.isFrozen(plan.actions[0])).toBe(true)
    expect(Object.isFrozen(plan.actions[0].arguments)).toBe(true)
  })

  it.each([
    null,
    [],
    {},
    {
      planId: '',
      actions: []
    },
    {
      planId: 'plan-1'
    },
    {
      planId: 'plan-1',
      explanation: 42,
      actions: []
    },
    {
      planId: 'plan-1',
      actions: new Array(1)
    },
    {
      planId: 'plan-1',
      actions: [
        {
          id: '',
          name: 'resize',
          arguments: {}
        }
      ]
    },
    {
      planId: 'plan-1',
      actions: [
        {
          id: 'action-1',
          name: '',
          arguments: {}
        }
      ]
    },
    {
      planId: 'plan-1',
      actions: [
        {
          id: 'action-1',
          name: 'resize'
        }
      ]
    }
  ])('rejects malformed output without exposing the raw value', (raw) => {
    expect(() => normalizeAiProviderOutput(raw)).toThrowError(
      expect.objectContaining({
        code: 'AI_PLAN_MALFORMED_OUTPUT',
        retryable: true,
        stage: 'planning'
      })
    )

    try {
      normalizeAiProviderOutput(raw)
    } catch (error) {
      expect(JSON.stringify(error)).not.toContain(JSON.stringify(raw))
    }
  })

  it('rejects accessor and cyclic argument data without invoking accessors', () => {
    const getter = vi.fn(() => 'must not run')
    const argumentsValue: Record<string, unknown> = {}
    Object.defineProperty(argumentsValue, 'secret', {
      enumerable: true,
      get: getter
    })
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic

    expect(() =>
      normalizeAiProviderOutput({
        planId: 'plan-1',
        actions: [
          {
            id: 'action-1',
            name: 'resize',
            arguments: argumentsValue
          }
        ]
      })
    ).toThrow(AiPlanNormalizationError)
    expect(getter).not.toHaveBeenCalled()
    expect(() =>
      normalizeAiProviderOutput({
        planId: 'plan-1',
        actions: [
          {
            id: 'action-1',
            name: 'resize',
            arguments: cyclic
          }
        ]
      })
    ).toThrow(AiPlanNormalizationError)
  })

  it('converts known and unknown failures to stable redacted planning failures', () => {
    const known = toAiPlanningFailure(
      new AiProviderError({
        code: 'AI_PROVIDER_HTTP_STATUS',
        message: 'Bearer provider-owned-secret',
        retryable: true,
        status: 503
      }),
      1
    )
    const unknown = toAiPlanningFailure(
      new Error('Bearer raw-secret-from-provider'),
      2
    )

    expect(known).toEqual({
      attempt: 1,
      code: 'AI_PROVIDER_HTTP_STATUS',
      message: 'AI provider returned a non-success status.',
      retryable: true,
      stage: 'planning',
      status: 503
    })
    expect(unknown).toEqual({
      attempt: 2,
      code: 'AI_PROVIDER_FAILURE',
      message: 'AI provider planning failed.',
      retryable: false,
      stage: 'planning'
    })
    expect(JSON.stringify(unknown)).not.toContain('raw-secret')
  })

  it('bounds opt-in retry to retryable provider-stage failures', () => {
    const shouldRetry = vi.fn((_context: unknown) => true)
    const policy = {
      maxAttempts: 2,
      shouldRetry
    }
    const retryable = toAiPlanningFailure(
      new AiProviderError({
        code: 'AI_PROVIDER_TRANSPORT_FAILED',
        message: 'AI provider transport failed.',
        retryable: true
      }),
      1
    )

    expect(shouldRetryAiProviderFailure(retryable, policy)).toBe(true)
    expect(shouldRetry).toHaveBeenCalledWith(
      expect.objectContaining({
        nextAttempt: 2
      })
    )
    expect(Object.isFrozen(shouldRetry.mock.calls[0][0])).toBe(true)
    expect(
      shouldRetryAiProviderFailure(
        {
          ...retryable,
          attempt: 2
        },
        policy
      )
    ).toBe(false)
    expect(
      shouldRetryAiProviderFailure(
        {
          ...retryable,
          code: 'AI_PROVIDER_ABORTED'
        },
        policy
      )
    ).toBe(false)
    expect(shouldRetryAiProviderFailure(retryable)).toBe(false)
  })

  it('rejects retry configurations above the fixed runtime bound', () => {
    const failure = toAiPlanningFailure(
      new AiProviderError({
        code: 'AI_PROVIDER_TRANSPORT_FAILED',
        message: 'AI provider transport failed.',
        retryable: true
      }),
      1
    )

    expect(() =>
      shouldRetryAiProviderFailure(failure, {
        maxAttempts: MAX_AI_PROVIDER_ATTEMPTS + 1
      })
    ).toThrowError(
      expect.objectContaining({
        code: 'AI_RETRY_POLICY_INVALID'
      })
    )
  })
})
