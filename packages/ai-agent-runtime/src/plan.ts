import { AiProviderError, type AiProviderErrorCode } from './provider'
import { redactAiValue } from './redaction'
import type { AiActionDefinition, AiActionRegistry, AiJsonValue } from './types'

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
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
        if (!descriptor?.enumerable || !('value' in descriptor)) {
          return malformedPlan()
        }
        result.push(detachJsonValue(descriptor.value, ancestors))
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
    const descriptor = Object.getOwnPropertyDescriptor(
      actions.value,
      String(index)
    )
    if (!descriptor?.enumerable || !('value' in descriptor)) {
      return malformedPlan()
    }
    normalizedActions.push(normalizeAction(descriptor.value))
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

export interface AiPreparedAction {
  readonly id: string
  readonly name: string
  readonly arguments: AiJsonValue
  readonly execute: AiActionDefinition['execute']
}

export interface AiPreparedPlan {
  readonly planId: string
  readonly explanation?: string
  readonly actions: readonly AiPreparedAction[]
}

export interface AiValidationIssue {
  readonly actionId?: string
  readonly actionName?: string
  readonly code: string
  readonly message: string
  readonly path: readonly (number | string)[]
}

export type AiPlanValidationErrorCode =
  | 'AI_ACTION_SCHEMA_FAILED'
  | 'AI_PLAN_DUPLICATE_ACTION_ID'
  | 'AI_PLAN_EMPTY'
  | 'AI_PLAN_INVALID_ARGUMENTS'
  | 'AI_PLAN_UNKNOWN_ACTION'

export class AiPlanValidationError extends Error {
  readonly code: AiPlanValidationErrorCode
  readonly issues: readonly AiValidationIssue[]
  readonly stage = 'validation' as const

  constructor(
    code: AiPlanValidationErrorCode,
    message: string,
    issues: readonly AiValidationIssue[] = []
  ) {
    super(message)
    this.name = 'AiPlanValidationError'
    this.code = code
    this.issues = Object.freeze([...issues])
  }
}

const validationError = (
  code: AiPlanValidationErrorCode,
  message: string,
  issues?: readonly AiValidationIssue[]
): never => {
  throw new AiPlanValidationError(code, message, issues)
}

const schemaFailure = (): never =>
  validationError('AI_ACTION_SCHEMA_FAILED', 'Registered action schema failed.')

const schemaDataProperty = (
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
    return schemaFailure()
  }

  return {
    present: true,
    value: descriptor.value
  }
}

const normalizeSchemaIssue = (
  value: unknown,
  action: AiPlannedAction
): AiValidationIssue => {
  if (!isPlainObject(value)) {
    return schemaFailure()
  }

  const code = schemaDataProperty(value, 'code')
  const message = schemaDataProperty(value, 'message')
  const path = schemaDataProperty(value, 'path')
  if (
    !code.present ||
    !nonEmptyString(code.value) ||
    !message.present ||
    typeof message.value !== 'string' ||
    !path.present ||
    !Array.isArray(path.value)
  ) {
    return schemaFailure()
  }

  const detachedPath: (number | string)[] = []
  for (let index = 0; index < path.value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(
      path.value,
      String(index)
    )
    if (!descriptor?.enumerable || !('value' in descriptor)) {
      return schemaFailure()
    }
    const segment = descriptor.value
    if (
      typeof segment !== 'string' &&
      (typeof segment !== 'number' || !Number.isFinite(segment))
    ) {
      return schemaFailure()
    }
    detachedPath.push(segment)
  }

  const redactedMessage = redactAiValue(message.value)
  if (typeof redactedMessage !== 'string') {
    return schemaFailure()
  }

  return Object.freeze({
    actionId: action.id,
    actionName: action.name,
    code: code.value,
    message: redactedMessage,
    path: Object.freeze(detachedPath)
  })
}

const parseActionArguments = (
  action: AiPlannedAction,
  definition: AiActionDefinition
): AiJsonValue => {
  let result: unknown
  try {
    result = definition.schema.parse(action.arguments)
  } catch {
    return schemaFailure()
  }

  if (!isPlainObject(result)) {
    return schemaFailure()
  }

  const success = schemaDataProperty(result, 'success')
  if (!success.present || typeof success.value !== 'boolean') {
    return schemaFailure()
  }

  if (success.value) {
    const parsedValue = schemaDataProperty(result, 'value')
    if (!parsedValue.present) {
      return schemaFailure()
    }

    try {
      return detachJsonValue(parsedValue.value)
    } catch {
      return schemaFailure()
    }
  }

  const issues = schemaDataProperty(result, 'issues')
  if (!issues.present || !Array.isArray(issues.value)) {
    return schemaFailure()
  }

  const normalizedIssues: AiValidationIssue[] = []
  if (issues.value.length === 0) {
    normalizedIssues.push(
      Object.freeze({
        actionId: action.id,
        actionName: action.name,
        code: 'invalid_arguments',
        message: 'Action arguments failed schema validation.',
        path: Object.freeze([] as (number | string)[])
      })
    )
  } else {
    for (let index = 0; index < issues.value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(
        issues.value,
        String(index)
      )
      if (!descriptor?.enumerable || !('value' in descriptor)) {
        return schemaFailure()
      }
      normalizedIssues.push(normalizeSchemaIssue(descriptor.value, action))
    }
  }

  return validationError(
    'AI_PLAN_INVALID_ARGUMENTS',
    'Action arguments failed schema validation.',
    normalizedIssues
  )
}

export const validateAiPlan = (
  plan: AiPlan,
  registry: AiActionRegistry
): AiPreparedPlan => {
  if (plan.actions.length === 0) {
    return validationError(
      'AI_PLAN_EMPTY',
      'AI candidate plan must contain at least one action.'
    )
  }

  const actionIds = new Set<string>()
  const resolved: {
    readonly action: AiPlannedAction
    readonly definition: AiActionDefinition
  }[] = []

  for (const action of plan.actions) {
    if (actionIds.has(action.id)) {
      return validationError(
        'AI_PLAN_DUPLICATE_ACTION_ID',
        'AI candidate plan contains a duplicate action id.'
      )
    }
    actionIds.add(action.id)

    const definition = registry.get(action.name)
    if (!definition) {
      return validationError(
        'AI_PLAN_UNKNOWN_ACTION',
        'AI candidate plan references an unknown action.'
      )
    }
    resolved.push({
      action,
      definition
    })
  }

  const preparedActions = resolved.map(({ action, definition }) =>
    Object.freeze({
      arguments: parseActionArguments(action, definition),
      execute: definition.execute,
      id: action.id,
      name: action.name
    })
  )
  const prepared: AiPreparedPlan = {
    actions: Object.freeze(preparedActions),
    planId: plan.planId
  }
  if (plan.explanation !== undefined) {
    Object.defineProperty(prepared, 'explanation', {
      configurable: true,
      enumerable: true,
      value: plan.explanation,
      writable: true
    })
  }

  return Object.freeze(prepared)
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
