import { describe, expect, it, vi } from 'vitest'
import {
  AiProviderError,
  MAX_AI_PROVIDER_ATTEMPTS,
  shouldRetryAiProviderFailure,
  toAiProviderRequestFailure
} from '..'

describe('AI provider request failure and retry', () => {
  it('converts known and unknown failures to stable redacted provider failures', () => {
    const known = toAiProviderRequestFailure(
      new AiProviderError({
        code: 'AI_PROVIDER_HTTP_STATUS',
        message: 'Bearer provider-owned-secret',
        retryable: true,
        status: 503
      }),
      1
    )
    const unknown = toAiProviderRequestFailure(
      new Error('Bearer raw-secret-from-provider'),
      2
    )

    expect(known).toEqual({
      attempt: 1,
      code: 'AI_PROVIDER_HTTP_STATUS',
      message: 'AI provider returned a non-success status.',
      retryable: true,
      stage: 'provider',
      status: 503
    })
    expect(unknown).toEqual({
      attempt: 2,
      code: 'AI_PROVIDER_FAILURE',
      message: 'AI provider request failed.',
      retryable: false,
      stage: 'provider'
    })
    expect(JSON.stringify(unknown)).not.toContain('raw-secret')
  })

  it('bounds opt-in retry to retryable provider-stage failures', () => {
    const shouldRetry = vi.fn((_context: unknown) => true)
    const policy = {
      maxAttempts: 2,
      shouldRetry
    }
    const retryable = toAiProviderRequestFailure(
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
    const failure = toAiProviderRequestFailure(
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
