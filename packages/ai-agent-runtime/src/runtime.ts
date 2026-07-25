import type { AiProvider } from './provider'
import type { AiPreparedAction, AiPreparedPlan } from './plan'
import { redactAiValue, type AiRedactionOptions } from './redaction'
import type { AiJsonValue } from './types'

export interface AiContextProvider {
  getContext(input: { intent: string; signal: AbortSignal }): Promise<unknown>
}

export type AiPermissionDecision = 'allow' | 'confirm' | 'deny'

export interface AiPermissionAction {
  readonly id: string
  readonly name: string
  readonly arguments: AiPreparedAction['arguments']
}

export interface AiPermissionPolicy<TContext = unknown> {
  evaluate(input: {
    action: AiPermissionAction
    context: TContext
  }): AiPermissionDecision | Promise<AiPermissionDecision>
}

export interface AiConfirmationHandler {
  confirm(
    preview: AiPlanPreview,
    options: { signal: AbortSignal }
  ): Promise<boolean>
}

export interface AiTransactionRunner {
  run<T>(label: string, execute: () => Promise<T>): Promise<T>
}

export const AI_PLAN_TRANSACTION_LABEL = 'AI-assisted action'

export class AiTransactionError extends Error {
  readonly code = 'AI_TRANSACTION_ABORTED' as const
  readonly stage = 'transaction' as const

  constructor() {
    super('AI plan transaction was aborted.')
    this.name = 'AiTransactionError'
  }
}

export interface AiActionExecutionResult {
  readonly actionId: string
  readonly actionName: string
  readonly result: AiJsonValue
}

export interface AiActionExecutionBatch {
  readonly actionResults: readonly AiActionExecutionResult[]
}

export class AiExecutionError extends Error {
  readonly code = 'AI_EXECUTION_ABORTED' as const
  readonly stage = 'execution' as const

  constructor() {
    super('AI action execution was aborted.')
    this.name = 'AiExecutionError'
  }
}

export interface AiRuntimeOwnedResource {
  dispose(): void | Promise<void>
}

export interface CreateAiAgentRuntimeInput {
  provider: AiProvider
  actionDefinitions: readonly unknown[]
  contextProvider: AiContextProvider
  permissionPolicy: AiPermissionPolicy
  confirmationHandler: AiConfirmationHandler
  transactionRunner: AiTransactionRunner
  ownedResources?: readonly AiRuntimeOwnedResource[]
}

export interface AiAgentRuntime {
  dispose(): Promise<void>
}

export interface AiPermissionReadyAction extends AiPreparedAction {
  readonly permission: Exclude<AiPermissionDecision, 'deny'>
}

export interface AiPermissionReadyPlan {
  readonly planId: string
  readonly explanation?: string
  readonly actions: readonly AiPermissionReadyAction[]
  readonly confirmationRequired: boolean
}

export interface AiPlanPreviewAction {
  readonly id: string
  readonly name: string
  readonly arguments: AiJsonValue
  readonly permission: Exclude<AiPermissionDecision, 'deny'>
}

export interface AiPlanPreview {
  readonly planId: string
  readonly explanation?: string
  readonly actions: readonly AiPlanPreviewAction[]
}

export interface AiConfirmedPlan extends AiPermissionReadyPlan {
  readonly confirmation: 'accepted' | 'bypassed'
  readonly preview: AiPlanPreview
}

export type AiPermissionErrorCode =
  | 'AI_PERMISSION_DENIED'
  | 'AI_PERMISSION_POLICY_FAILED'

export class AiPermissionError extends Error {
  readonly code: AiPermissionErrorCode
  readonly deniedActionIds: readonly string[]
  readonly stage = 'permission' as const

  constructor(
    code: AiPermissionErrorCode,
    message: string,
    deniedActionIds: readonly string[] = []
  ) {
    super(message)
    this.name = 'AiPermissionError'
    this.code = code
    this.deniedActionIds = Object.freeze([...deniedActionIds])
  }
}

export type AiConfirmationErrorCode =
  | 'AI_CONFIRMATION_ABORTED'
  | 'AI_CONFIRMATION_CANCELLED'
  | 'AI_CONFIRMATION_HANDLER_FAILED'

export class AiConfirmationError extends Error {
  readonly code: AiConfirmationErrorCode
  readonly stage = 'confirmation' as const

  constructor(code: AiConfirmationErrorCode, message: string) {
    super(message)
    this.name = 'AiConfirmationError'
    this.code = code
  }
}

const permissionPolicyFailed = (): never => {
  throw new AiPermissionError(
    'AI_PERMISSION_POLICY_FAILED',
    'App permission policy failed.'
  )
}

const isPermissionDecision = (value: unknown): value is AiPermissionDecision =>
  value === 'allow' || value === 'confirm' || value === 'deny'

export const evaluateAiPlanPermissions = async <TContext>(
  plan: AiPreparedPlan,
  context: TContext,
  policy: AiPermissionPolicy<TContext>
): Promise<AiPermissionReadyPlan> => {
  const decisions: AiPermissionDecision[] = []

  for (const action of plan.actions) {
    let decision: unknown
    try {
      decision = await policy.evaluate({
        action: Object.freeze({
          arguments: action.arguments,
          id: action.id,
          name: action.name
        }),
        context
      })
    } catch {
      return permissionPolicyFailed()
    }

    if (!isPermissionDecision(decision)) {
      return permissionPolicyFailed()
    }
    decisions.push(decision)
  }

  const deniedActionIds = plan.actions.flatMap((action, index) =>
    decisions[index] === 'deny' ? [action.id] : []
  )
  if (deniedActionIds.length > 0) {
    throw new AiPermissionError(
      'AI_PERMISSION_DENIED',
      'App permission policy denied the complete plan.',
      deniedActionIds
    )
  }

  const actions = plan.actions.map((action, index) =>
    Object.freeze({
      ...action,
      permission: decisions[index] as Exclude<AiPermissionDecision, 'deny'>
    })
  )
  const ready: AiPermissionReadyPlan = {
    actions: Object.freeze(actions),
    confirmationRequired: decisions.includes('confirm'),
    planId: plan.planId
  }
  if (plan.explanation !== undefined) {
    Object.defineProperty(ready, 'explanation', {
      configurable: true,
      enumerable: true,
      value: plan.explanation,
      writable: true
    })
  }

  return Object.freeze(ready)
}

const confirmationError = (
  code: AiConfirmationErrorCode,
  message: string
): never => {
  throw new AiConfirmationError(code, message)
}

const createAiPlanPreview = (
  plan: AiPermissionReadyPlan,
  redactionOptions: AiRedactionOptions
): AiPlanPreview => {
  const actions = plan.actions.map((action) =>
    Object.freeze({
      arguments: redactAiValue(action.arguments, redactionOptions),
      id: action.id,
      name: action.name,
      permission: action.permission
    })
  )
  const preview: AiPlanPreview = {
    actions: Object.freeze(actions),
    planId: plan.planId
  }
  if (plan.explanation !== undefined) {
    const explanation = redactAiValue(plan.explanation, redactionOptions)
    Object.defineProperty(preview, 'explanation', {
      configurable: true,
      enumerable: true,
      value: typeof explanation === 'string' ? explanation : '[REDACTED]',
      writable: true
    })
  }

  return Object.freeze(preview)
}

const createConfirmedPlan = (
  plan: AiPermissionReadyPlan,
  preview: AiPlanPreview,
  confirmation: AiConfirmedPlan['confirmation']
): AiConfirmedPlan =>
  Object.freeze({
    ...plan,
    confirmation,
    preview
  })

const CONFIRMATION_ABORTED = Symbol('CONFIRMATION_ABORTED')

export const confirmAiPlan = async (
  plan: AiPermissionReadyPlan,
  handler: AiConfirmationHandler,
  signal: AbortSignal,
  redactionOptions: AiRedactionOptions = {}
): Promise<AiConfirmedPlan> => {
  if (signal.aborted) {
    return confirmationError(
      'AI_CONFIRMATION_ABORTED',
      'AI plan confirmation was aborted.'
    )
  }

  const preview = createAiPlanPreview(plan, redactionOptions)
  if (!plan.confirmationRequired) {
    return createConfirmedPlan(plan, preview, 'bypassed')
  }

  let abortListener: (() => void) | undefined
  const aborted = new Promise<never>((_resolve, reject) => {
    abortListener = () => reject(CONFIRMATION_ABORTED)
    signal.addEventListener('abort', abortListener, {
      once: true
    })
  })

  try {
    const decision = await Promise.race([
      Promise.resolve().then(() =>
        handler.confirm(preview, {
          signal
        })
      ),
      aborted
    ])

    if (signal.aborted) {
      return confirmationError(
        'AI_CONFIRMATION_ABORTED',
        'AI plan confirmation was aborted.'
      )
    }

    if (typeof decision !== 'boolean') {
      return confirmationError(
        'AI_CONFIRMATION_HANDLER_FAILED',
        'App confirmation handler failed.'
      )
    }

    if (!decision) {
      return confirmationError(
        'AI_CONFIRMATION_CANCELLED',
        'AI plan confirmation was cancelled.'
      )
    }

    return createConfirmedPlan(plan, preview, 'accepted')
  } catch (error) {
    if (error instanceof AiConfirmationError) {
      throw error
    }

    if (signal.aborted || error === CONFIRMATION_ABORTED) {
      return confirmationError(
        'AI_CONFIRMATION_ABORTED',
        'AI plan confirmation was aborted.'
      )
    }

    return confirmationError(
      'AI_CONFIRMATION_HANDLER_FAILED',
      'App confirmation handler failed.'
    )
  } finally {
    if (abortListener) {
      signal.removeEventListener('abort', abortListener)
    }
  }
}

const assertTransactionNotAborted = (signal: AbortSignal): void => {
  if (signal.aborted) {
    throw new AiTransactionError()
  }
}

export const runAiPlanTransaction = async <T>(
  _plan: AiConfirmedPlan,
  runner: AiTransactionRunner,
  signal: AbortSignal,
  execute: () => Promise<T>
): Promise<T> => {
  assertTransactionNotAborted(signal)

  return runner.run(AI_PLAN_TRANSACTION_LABEL, async () => {
    assertTransactionNotAborted(signal)
    const result = await execute()
    assertTransactionNotAborted(signal)
    return result
  })
}

const assertExecutionNotAborted = (signal: AbortSignal): void => {
  if (signal.aborted) {
    throw new AiExecutionError()
  }
}

export const executeAiActions = async (
  plan: AiConfirmedPlan,
  signal: AbortSignal,
  redactionOptions: AiRedactionOptions = {}
): Promise<AiActionExecutionBatch> => {
  const actionResults: AiActionExecutionResult[] = []
  const context = Object.freeze({
    signal
  })

  for (const action of plan.actions) {
    assertExecutionNotAborted(signal)
    const result = await action.execute(action.arguments, context)
    assertExecutionNotAborted(signal)
    actionResults.push(
      Object.freeze({
        actionId: action.id,
        actionName: action.name,
        result: redactAiValue(result, redactionOptions)
      })
    )
  }

  return Object.freeze({
    actionResults: Object.freeze(actionResults)
  })
}

class DefaultAiAgentRuntime implements AiAgentRuntime {
  private readonly ownedResources: readonly AiRuntimeOwnedResource[]
  private disposal: Promise<void> | undefined

  constructor(input: CreateAiAgentRuntimeInput) {
    this.ownedResources = Object.freeze([...(input.ownedResources ?? [])])
  }

  dispose(): Promise<void> {
    if (!this.disposal) {
      this.disposal = Promise.all(
        this.ownedResources.map((resource) =>
          Promise.resolve().then(() => resource.dispose())
        )
      ).then(() => undefined)
    }

    return this.disposal
  }
}

export const createAiAgentRuntime = (
  input: CreateAiAgentRuntimeInput
): AiAgentRuntime => new DefaultAiAgentRuntime(input)
