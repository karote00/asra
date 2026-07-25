import type { AiActionExecutionResult } from './runtime'
import {
  AI_REDACTED_VALUE,
  redactAiValue,
  type AiRedactionOptions
} from './redaction'
import type { AiJsonValue } from './types'

export type AiAuditOutcome = 'cancelled' | 'executed' | 'failed'

export interface AiAuditActionSummary {
  readonly actionId: string
  readonly actionName: string
  readonly result: AiJsonValue
}

export interface AiRuntimeAudit {
  readonly planId?: string
  readonly outcome: AiAuditOutcome
  readonly retryCount: number
  readonly explanation?: string
  readonly actions: readonly AiAuditActionSummary[]
}

export interface CreateAiRuntimeAuditInput {
  readonly planId?: string
  readonly outcome: AiAuditOutcome
  readonly retryCount: number
  readonly explanation?: string
  readonly actionResults?: readonly AiActionExecutionResult[]
}

export class AiAuditError extends Error {
  readonly code = 'AI_AUDIT_INVALID_INPUT' as const
  readonly stage = 'audit' as const

  constructor() {
    super('AI audit input is invalid.')
    this.name = 'AiAuditError'
  }
}

const invalidAudit = (): never => {
  throw new AiAuditError()
}

export const createAiRuntimeAudit = (
  input: CreateAiRuntimeAuditInput,
  redactionOptions: AiRedactionOptions = {}
): AiRuntimeAudit => {
  if (
    !Number.isInteger(input.retryCount) ||
    input.retryCount < 0 ||
    (input.planId !== undefined &&
      (typeof input.planId !== 'string' || input.planId.trim().length === 0)) ||
    (input.explanation !== undefined && typeof input.explanation !== 'string')
  ) {
    return invalidAudit()
  }

  const actions = (input.actionResults ?? []).map((action) =>
    Object.freeze({
      actionId: action.actionId,
      actionName: action.actionName,
      result: redactAiValue(action.result, redactionOptions)
    })
  )
  const audit: {
    actions: readonly AiAuditActionSummary[]
    explanation?: string
    outcome: AiAuditOutcome
    planId?: string
    retryCount: number
  } = {
    actions: Object.freeze(actions),
    outcome: input.outcome,
    retryCount: input.retryCount
  }

  if (input.planId !== undefined) {
    audit.planId = input.planId
  }
  if (input.explanation !== undefined) {
    const explanation = redactAiValue(input.explanation, redactionOptions)
    audit.explanation =
      typeof explanation === 'string' ? explanation : AI_REDACTED_VALUE
  }

  return Object.freeze(audit)
}
