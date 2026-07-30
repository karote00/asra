import { AiActionBatchContractError } from './action-batch'
import { AiProviderError, type AiProviderErrorCode } from './provider'

export interface AiProviderRequestFailure {
  readonly attempt: number
  readonly code:
    | AiActionBatchContractError['code']
    | AiProviderErrorCode
    | 'AI_PROVIDER_FAILURE'
  readonly message: string
  readonly retryable: boolean
  readonly stage: 'provider'
  readonly status?: number
}

const providerRequestFailure = (
  value: AiProviderRequestFailure
): AiProviderRequestFailure => Object.freeze(value)

const PROVIDER_FAILURE_MESSAGES: Readonly<Record<AiProviderErrorCode, string>> =
  Object.freeze({
    AI_PROVIDER_ABORTED: 'AI provider request was aborted.',
    AI_PROVIDER_DISPOSED: 'AI provider has been disposed.',
    AI_PROVIDER_FETCH_UNAVAILABLE:
      'No fetch-compatible AI provider transport is available.',
    AI_PROVIDER_HTTP_STATUS: 'AI provider returned a non-success status.',
    AI_PROVIDER_INVALID_CONFIGURATION: 'AI provider configuration is invalid.',
    AI_PROVIDER_INVALID_ENDPOINT:
      'AI provider endpoint must be HTTPS or same-origin.',
    AI_PROVIDER_INVALID_INPUT: 'AI provider input is invalid.',
    AI_PROVIDER_MALFORMED_RESPONSE: 'AI provider returned malformed JSON.',
    AI_PROVIDER_TIMEOUT: 'AI provider request timed out.',
    AI_PROVIDER_TRANSPORT_FAILED: 'AI provider transport failed.'
  })

export const toAiProviderRequestFailure = (
  error: unknown,
  attempt: number
): AiProviderRequestFailure => {
  if (error instanceof AiProviderError) {
    return providerRequestFailure({
      attempt,
      code: error.code,
      message: PROVIDER_FAILURE_MESSAGES[error.code],
      retryable: error.retryable,
      stage: 'provider',
      ...(error.status === undefined
        ? {}
        : {
            status: error.status
          })
    })
  }

  if (error instanceof AiActionBatchContractError) {
    return providerRequestFailure({
      attempt,
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      stage: 'provider'
    })
  }

  return providerRequestFailure({
    attempt,
    code: 'AI_PROVIDER_FAILURE',
    message: 'AI provider request failed.',
    retryable: false,
    stage: 'provider'
  })
}

export const MAX_AI_PROVIDER_ATTEMPTS = 5

export interface AiProviderRetryContext {
  readonly failure: AiProviderRequestFailure
  readonly nextAttempt: number
}

export interface AiRetryPolicy {
  readonly maxAttempts: number
  readonly shouldRetry?: (context: AiProviderRetryContext) => boolean
}

export class AiRetryPolicyError extends Error {
  readonly code = 'AI_RETRY_POLICY_INVALID' as const

  constructor() {
    super(
      `AI provider maxAttempts must be an integer from 1 to ${MAX_AI_PROVIDER_ATTEMPTS}.`
    )
    this.name = 'AiRetryPolicyError'
  }
}

const retryBlockedCode = (code: AiProviderRequestFailure['code']): boolean =>
  code === 'AI_PROVIDER_ABORTED' || code === 'AI_PROVIDER_DISPOSED'

export const shouldRetryAiProviderFailure = (
  failure: AiProviderRequestFailure,
  policy?: AiRetryPolicy
): boolean => {
  if (!policy) {
    return false
  }

  if (
    !Number.isInteger(policy.maxAttempts) ||
    policy.maxAttempts < 1 ||
    policy.maxAttempts > MAX_AI_PROVIDER_ATTEMPTS
  ) {
    throw new AiRetryPolicyError()
  }

  if (
    !failure.retryable ||
    retryBlockedCode(failure.code) ||
    failure.attempt >= policy.maxAttempts
  ) {
    return false
  }

  if (!policy.shouldRetry) {
    return true
  }

  return (
    policy.shouldRetry(
      Object.freeze({
        failure,
        nextAttempt: failure.attempt + 1
      })
    ) === true
  )
}
