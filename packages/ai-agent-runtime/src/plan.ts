import { AiProviderError, type AiProviderErrorCode } from './provider'
import type { AiJsonValue } from './types'

export interface AiPlannedAction {
  readonly id: string
  readonly name: string
  readonly arguments: AiJsonValue
}

export interface AiPlan {
  readonly planId: string
  readonly explanation?: string
  readonly actions: readonly AiPlannedAction[]
}

export type AiPlanNormalizationErrorCode = 'AI_PLAN_MALFORMED_OUTPUT'

export class AiPlanNormalizationError extends Error {
  readonly code: AiPlanNormalizationErrorCode = 'AI_PLAN_MALFORMED_OUTPUT'
  readonly retryable = true
  readonly stage = 'planning' as const

  constructor() {
    super('AI provider returned a malformed candidate plan.')
    this.name = 'AiPlanNormalizationError'
  }
}

const malformedPlan = (): never => {
  throw new AiPlanNormalizationError()
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

const readDataProperty = (
  value: Record<string, unknown>,
  key: string
): { readonly present: boolean; readonly value: unknown } => {
  const descriptor = Object.getOwnPropertyDescriptor(value, key)
  if (!descriptor) {
    return {
      present: false,
      value: undefined
    }
  }

  if (!descriptor.enumerable || !('value' in descriptor)) {
    return malformedPlan()
  }

  return {
    present: true,
    value: descriptor.value
  }
}

const detachJsonValue = (
  value: unknown,
  ancestors = new WeakSet<object>()
): AiJsonValue => {
  if (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'string'
  ) {
    return value
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value !== 'object' || ancestors.has(value)) {
    return malformedPlan()
  }

  ancestors.add(value)
  try {
    if (Array.isArray(value)) {
      const result: AiJsonValue[] = []
      for (let index = 0; index < value.length; index += 1) {
        if (!(index in value)) {
          return malformedPlan()
        }
        result.push(detachJsonValue(value[index], ancestors))
      }
      return Object.freeze(result)
    }

    if (!isPlainObject(value)) {
      return malformedPlan()
    }

    const result: Record<string, AiJsonValue> = {}
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== 'string') {
        return malformedPlan()
      }

      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (!descriptor?.enumerable || !('value' in descriptor)) {
        return malformedPlan()
      }

      Object.defineProperty(result, key, {
        configurable: true,
        enumerable: true,
        value: detachJsonValue(descriptor.value, ancestors),
        writable: true
      })
    }

    return Object.freeze(result)
  } finally {
    ancestors.delete(value)
  }
}

const nonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

const normalizeAction = (value: unknown): AiPlannedAction => {
  if (!isPlainObject(value)) {
    return malformedPlan()
  }

  const id = readDataProperty(value, 'id')
  const name = readDataProperty(value, 'name')
  const argumentsValue = readDataProperty(value, 'arguments')

  if (
    !id.present ||
    !nonEmptyString(id.value) ||
    !name.present ||
    !nonEmptyString(name.value) ||
    !argumentsValue.present
  ) {
    return malformedPlan()
  }

  return Object.freeze({
    arguments: detachJsonValue(argumentsValue.value),
    id: id.value,
    name: name.value
  })
}

export const normalizeAiProviderOutput = (value: unknown): AiPlan => {
  if (!isPlainObject(value)) {
    return malformedPlan()
  }

  const planId = readDataProperty(value, 'planId')
  const explanation = readDataProperty(value, 'explanation')
  const actions = readDataProperty(value, 'actions')

  if (
    !planId.present ||
    !nonEmptyString(planId.value) ||
    !actions.present ||
    !Array.isArray(actions.value) ||
    (explanation.present && typeof explanation.value !== 'string')
  ) {
    return malformedPlan()
  }

  const normalizedActions: AiPlannedAction[] = []
  for (let index = 0; index < actions.value.length; index += 1) {
    if (!(index in actions.value)) {
      return malformedPlan()
    }
    normalizedActions.push(normalizeAction(actions.value[index]))
  }
  const plan: AiPlan = {
    actions: Object.freeze(normalizedActions),
    planId: planId.value
  }

  if (typeof explanation.value === 'string') {
    Object.defineProperty(plan, 'explanation', {
      configurable: true,
      enumerable: true,
      value: explanation.value,
      writable: true
    })
  }

  return Object.freeze(plan)
}

export interface AiPlanningFailure {
  readonly attempt: number
  readonly code:
    | AiPlanNormalizationErrorCode
    | AiProviderErrorCode
    | 'AI_PROVIDER_FAILURE'
  readonly message: string
  readonly retryable: boolean
  readonly stage: 'planning'
  readonly status?: number
}

const planningFailure = (value: AiPlanningFailure): AiPlanningFailure =>
  Object.freeze(value)

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

export const toAiPlanningFailure = (
  error: unknown,
  attempt: number
): AiPlanningFailure => {
  if (error instanceof AiProviderError) {
    return planningFailure({
      attempt,
      code: error.code,
      message: PROVIDER_FAILURE_MESSAGES[error.code],
      retryable: error.retryable,
      stage: 'planning',
      ...(error.status === undefined
        ? {}
        : {
            status: error.status
          })
    })
  }

  if (error instanceof AiPlanNormalizationError) {
    return planningFailure({
      attempt,
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      stage: 'planning'
    })
  }

  return planningFailure({
    attempt,
    code: 'AI_PROVIDER_FAILURE',
    message: 'AI provider planning failed.',
    retryable: false,
    stage: 'planning'
  })
}

export const MAX_AI_PROVIDER_ATTEMPTS = 5

export interface AiProviderRetryContext {
  readonly failure: AiPlanningFailure
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

const retryBlockedCode = (code: AiPlanningFailure['code']): boolean =>
  code === 'AI_PROVIDER_ABORTED' || code === 'AI_PROVIDER_DISPOSED'

export const shouldRetryAiProviderFailure = (
  failure: AiPlanningFailure,
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
