import {
  AiActionRegistryError,
  createAiActionRegistry
} from './action-registry'
import {
  AiAuditError,
  createAiRuntimeAudit,
  type AiRuntimeAudit
} from './audit'
import {
  AiPlanValidationError,
  AiRetryPolicyError,
  MAX_AI_PROVIDER_ATTEMPTS,
  normalizeAiProviderOutput,
  shouldRetryAiProviderFailure,
  toAiPlanningFailure,
  validateAiPlan,
  type AiPlan,
  type AiPlanningFailure,
  type AiPlanValidationErrorCode,
  type AiPreparedAction,
  type AiPreparedPlan,
  type AiRetryPolicy
} from './plan'
import type { AiProvider } from './provider'
import { redactAiValue, type AiRedactionOptions } from './redaction'
import type {
  AiActionDefinition,
  AiActionRegistry,
  AiActionRegistryErrorCode,
  AiJsonValue
} from './types'

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

export interface AiRuntimeOptions {
  readonly redaction?: AiRedactionOptions
  readonly retryPolicy?: AiRetryPolicy
}

export interface CreateAiAgentRuntimeInput {
  provider: AiProvider
  actionDefinitions: readonly AiActionDefinition[]
  contextProvider: AiContextProvider
  permissionPolicy: AiPermissionPolicy
  confirmationHandler: AiConfirmationHandler
  transactionRunner: AiTransactionRunner
  options?: AiRuntimeOptions
  ownedResources?: readonly AiRuntimeOwnedResource[]
}

export interface AiRunRequest {
  readonly intent: string
  readonly metadata?: AiJsonValue
  readonly signal: AbortSignal
}

export type AiRuntimeStage =
  | 'audit'
  | 'confirmation'
  | 'context'
  | 'execution'
  | 'permission'
  | 'planning'
  | 'registry'
  | 'runtime'
  | 'transaction'
  | 'validation'

export type AiRuntimeFailureCode =
  | AiActionRegistryErrorCode
  | AiConfirmationErrorCode
  | AiPermissionErrorCode
  | AiPlanValidationErrorCode
  | AiPlanningFailure['code']
  | 'AI_ACTION_REGISTRY_FAILED'
  | 'AI_AUDIT_FAILED'
  | 'AI_AUDIT_INVALID_INPUT'
  | 'AI_CONTEXT_FAILED'
  | 'AI_EXECUTION_ABORTED'
  | 'AI_EXECUTION_FAILED'
  | 'AI_RETRY_POLICY_FAILED'
  | 'AI_RETRY_POLICY_INVALID'
  | 'AI_RUNTIME_DISPOSED'
  | 'AI_RUNTIME_FAILED'
  | 'AI_RUNTIME_INVALID_INTENT'
  | 'AI_TRANSACTION_ABORTED'
  | 'AI_TRANSACTION_FAILED'
  | 'AI_VALIDATION_FAILED'

export interface AiRuntimeExecutedResult {
  readonly status: 'executed'
  readonly planId: string
  readonly preview: AiPlanPreview
  readonly actionResults: readonly AiActionExecutionResult[]
  readonly transaction: {
    readonly status: 'committed'
  }
  readonly audit: AiRuntimeAudit
}

export interface AiRuntimeCancelledResult {
  readonly status: 'cancelled'
  readonly reason: 'aborted' | 'confirmation-cancelled'
  readonly preview?: AiPlanPreview
  readonly audit: AiRuntimeAudit
}

export interface AiRuntimeFailedResult {
  readonly status: 'failed'
  readonly code: AiRuntimeFailureCode
  readonly message: string
  readonly stage: AiRuntimeStage
  readonly retryCount: number
  readonly audit: AiRuntimeAudit
}

export type AiRuntimeResult =
  | AiRuntimeCancelledResult
  | AiRuntimeExecutedResult
  | AiRuntimeFailedResult

export interface AiAgentRuntime {
  run(request: AiRunRequest): Promise<AiRuntimeResult>
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

const INVOCATION_ABORTED = Symbol('INVOCATION_ABORTED')

interface AiInvocationEvidence {
  readonly plan?: Pick<AiPlan, 'explanation' | 'planId'>
  readonly preview?: AiPlanPreview
  readonly retryCount: number
}

interface AiStableFailure {
  readonly code: AiRuntimeFailureCode
  readonly message: string
  readonly stage: AiRuntimeStage
}

interface ActiveAiInvocation {
  readonly controller: AbortController
  settlement: Promise<AiRuntimeResult>
}

const runAbortable = async <T>(
  signal: AbortSignal,
  operation: () => Promise<T>
): Promise<T> => {
  if (signal.aborted) {
    throw INVOCATION_ABORTED
  }

  let abortListener: (() => void) | undefined
  const aborted = new Promise<never>((_resolve, reject) => {
    abortListener = () => reject(INVOCATION_ABORTED)
    signal.addEventListener('abort', abortListener, {
      once: true
    })
  })

  try {
    return await Promise.race([Promise.resolve().then(operation), aborted])
  } finally {
    if (abortListener) {
      signal.removeEventListener('abort', abortListener)
    }
  }
}

const stableFailure = (
  error: unknown,
  fallback: AiStableFailure
): AiStableFailure => {
  if (error instanceof AiPlanValidationError) {
    return {
      code: error.code,
      message: error.message,
      stage: error.stage
    }
  }
  if (error instanceof AiPermissionError) {
    return {
      code: error.code,
      message: error.message,
      stage: error.stage
    }
  }
  if (error instanceof AiConfirmationError) {
    return {
      code: error.code,
      message: error.message,
      stage: error.stage
    }
  }
  if (error instanceof AiTransactionError) {
    return {
      code: error.code,
      message: error.message,
      stage: error.stage
    }
  }
  if (error instanceof AiExecutionError) {
    return {
      code: error.code,
      message: error.message,
      stage: error.stage
    }
  }
  if (error instanceof AiRetryPolicyError) {
    return {
      code: error.code,
      message: error.message,
      stage: 'planning'
    }
  }
  if (error instanceof AiActionRegistryError) {
    return {
      code: error.code,
      message: error.message,
      stage: 'registry'
    }
  }
  if (error instanceof AiAuditError) {
    return {
      code: error.code,
      message: error.message,
      stage: error.stage
    }
  }

  return fallback
}

const STAGE_FAILURES: Readonly<Record<AiRuntimeStage, AiStableFailure>> =
  Object.freeze({
    audit: Object.freeze({
      code: 'AI_AUDIT_FAILED',
      message: 'AI audit output failed.',
      stage: 'audit'
    }),
    confirmation: Object.freeze({
      code: 'AI_CONFIRMATION_HANDLER_FAILED',
      message: 'App confirmation handler failed.',
      stage: 'confirmation'
    }),
    context: Object.freeze({
      code: 'AI_CONTEXT_FAILED',
      message: 'AI context collection failed.',
      stage: 'context'
    }),
    execution: Object.freeze({
      code: 'AI_EXECUTION_FAILED',
      message: 'AI action execution failed.',
      stage: 'execution'
    }),
    permission: Object.freeze({
      code: 'AI_PERMISSION_POLICY_FAILED',
      message: 'App permission policy failed.',
      stage: 'permission'
    }),
    planning: Object.freeze({
      code: 'AI_RETRY_POLICY_FAILED',
      message: 'AI provider retry policy failed.',
      stage: 'planning'
    }),
    registry: Object.freeze({
      code: 'AI_ACTION_REGISTRY_FAILED',
      message: 'AI action registry failed.',
      stage: 'registry'
    }),
    runtime: Object.freeze({
      code: 'AI_RUNTIME_FAILED',
      message: 'AI runtime failed.',
      stage: 'runtime'
    }),
    transaction: Object.freeze({
      code: 'AI_TRANSACTION_FAILED',
      message: 'AI plan transaction failed.',
      stage: 'transaction'
    }),
    validation: Object.freeze({
      code: 'AI_VALIDATION_FAILED',
      message: 'AI plan validation failed.',
      stage: 'validation'
    })
  })

const createFailedResult = (
  failure: AiStableFailure,
  evidence: AiInvocationEvidence,
  redactionOptions: AiRedactionOptions
): AiRuntimeFailedResult =>
  Object.freeze({
    audit: createAiRuntimeAudit(
      {
        ...(evidence.plan?.explanation === undefined
          ? {}
          : {
              explanation: evidence.plan.explanation
            }),
        ...(evidence.plan?.planId === undefined
          ? {}
          : {
              planId: evidence.plan.planId
            }),
        outcome: 'failed',
        retryCount: evidence.retryCount
      },
      redactionOptions
    ),
    code: failure.code,
    message: failure.message,
    retryCount: evidence.retryCount,
    stage: failure.stage,
    status: 'failed'
  })

const createCancelledResult = (
  reason: AiRuntimeCancelledResult['reason'],
  evidence: AiInvocationEvidence,
  redactionOptions: AiRedactionOptions
): AiRuntimeCancelledResult => {
  const result: {
    audit: AiRuntimeAudit
    preview?: AiPlanPreview
    reason: AiRuntimeCancelledResult['reason']
    status: 'cancelled'
  } = {
    audit: createAiRuntimeAudit(
      {
        ...(evidence.plan?.explanation === undefined
          ? {}
          : {
              explanation: evidence.plan.explanation
            }),
        ...(evidence.plan?.planId === undefined
          ? {}
          : {
              planId: evidence.plan.planId
            }),
        outcome: 'cancelled',
        retryCount: evidence.retryCount
      },
      redactionOptions
    ),
    reason,
    status: 'cancelled'
  }

  if (evidence.preview) {
    result.preview = evidence.preview
  }

  return Object.freeze(result)
}

const validateRuntimeOptions = (
  options: AiRuntimeOptions | undefined
): {
  readonly redaction: AiRedactionOptions
  readonly retryPolicy?: AiRetryPolicy
} => {
  const retryPolicy = options?.retryPolicy
  if (
    retryPolicy &&
    (!Number.isInteger(retryPolicy.maxAttempts) ||
      retryPolicy.maxAttempts < 1 ||
      retryPolicy.maxAttempts > MAX_AI_PROVIDER_ATTEMPTS)
  ) {
    throw new AiRetryPolicyError()
  }

  const redaction: AiRedactionOptions = Object.freeze({
    additionalSecretKeys: Object.freeze([
      ...(options?.redaction?.additionalSecretKeys ?? [])
    ])
  })
  const validated: {
    redaction: AiRedactionOptions
    retryPolicy?: AiRetryPolicy
  } = {
    redaction
  }
  if (retryPolicy) {
    validated.retryPolicy = Object.freeze({
      maxAttempts: retryPolicy.maxAttempts,
      ...(retryPolicy.shouldRetry
        ? {
            shouldRetry: retryPolicy.shouldRetry
          }
        : {})
    })
  }

  return Object.freeze(validated)
}

class DefaultAiAgentRuntime implements AiAgentRuntime {
  private readonly activeInvocations = new Set<ActiveAiInvocation>()
  private readonly confirmationHandler: AiConfirmationHandler
  private readonly contextProvider: AiContextProvider
  private readonly ownedResources: readonly AiRuntimeOwnedResource[]
  private readonly permissionPolicy: AiPermissionPolicy
  private readonly provider: AiProvider
  private readonly redactionOptions: AiRedactionOptions
  private readonly registry: AiActionRegistry
  private readonly retryPolicy: AiRetryPolicy | undefined
  private readonly transactionRunner: AiTransactionRunner
  private disposal: Promise<void> | undefined
  private disposed = false

  constructor(input: CreateAiAgentRuntimeInput) {
    const options = validateRuntimeOptions(input.options)

    this.provider = input.provider
    this.contextProvider = input.contextProvider
    this.permissionPolicy = input.permissionPolicy
    this.confirmationHandler = input.confirmationHandler
    this.transactionRunner = input.transactionRunner
    this.redactionOptions = options.redaction
    this.retryPolicy = options.retryPolicy
    this.ownedResources = Object.freeze([...(input.ownedResources ?? [])])
    this.registry = createAiActionRegistry()
    for (const action of input.actionDefinitions) {
      this.registry.register(action)
    }
  }

  run(request: AiRunRequest): Promise<AiRuntimeResult> {
    if (this.disposed) {
      return Promise.resolve(
        createFailedResult(
          {
            code: 'AI_RUNTIME_DISPOSED',
            message: 'AI runtime has been disposed.',
            stage: 'runtime'
          },
          {
            retryCount: 0
          },
          this.redactionOptions
        )
      )
    }

    const controller = new AbortController()
    const abortInvocation = () => controller.abort(request.signal.reason)
    if (request.signal.aborted) {
      abortInvocation()
    } else {
      request.signal.addEventListener('abort', abortInvocation, {
        once: true
      })
    }

    const active: ActiveAiInvocation = {
      controller,
      settlement: Promise.resolve(
        createCancelledResult(
          'aborted',
          {
            retryCount: 0
          },
          this.redactionOptions
        )
      )
    }
    this.activeInvocations.add(active)
    active.settlement = this.runInvocation(
      {
        intent: request.intent,
        ...(request.metadata === undefined
          ? {}
          : {
              metadata: redactAiValue(request.metadata, this.redactionOptions)
            }),
        signal: controller.signal
      },
      controller.signal
    ).finally(() => {
      request.signal.removeEventListener('abort', abortInvocation)
      this.activeInvocations.delete(active)
    })

    return active.settlement
  }

  dispose(): Promise<void> {
    if (!this.disposal) {
      this.disposal = this.disposeRuntime()
    }

    return this.disposal
  }

  private async disposeRuntime(): Promise<void> {
    this.disposed = true
    const active = [...this.activeInvocations]
    for (const invocation of active) {
      invocation.controller.abort()
    }
    await Promise.allSettled(active.map((invocation) => invocation.settlement))

    this.registry.dispose()
    const cleanups = await Promise.allSettled(
      this.ownedResources.map((resource) =>
        Promise.resolve().then(() => resource.dispose())
      )
    )
    const failed = cleanups.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected'
    )
    if (failed) {
      throw failed.reason
    }
  }

  private async runInvocation(
    request: AiRunRequest,
    signal: AbortSignal
  ): Promise<AiRuntimeResult> {
    let evidence: AiInvocationEvidence = {
      retryCount: 0
    }
    let currentStage: AiRuntimeStage = 'context'

    try {
      const intent =
        typeof request.intent === 'string' ? request.intent.trim() : ''
      if (!intent) {
        return createFailedResult(
          {
            code: 'AI_RUNTIME_INVALID_INTENT',
            message: 'AI runtime requires a non-empty intent.',
            stage: 'runtime'
          },
          evidence,
          this.redactionOptions
        )
      }

      const context = redactAiValue(
        await runAbortable(signal, () =>
          this.contextProvider.getContext({
            intent,
            signal
          })
        ),
        this.redactionOptions
      )
      currentStage = 'registry'
      const actions = this.registry.list()

      currentStage = 'planning'
      let attempt = 1
      let plan: AiPlan
      while (true) {
        try {
          const providerOutput = await runAbortable(signal, () =>
            this.provider.generateActionPlan(
              Object.freeze({
                actions,
                attempt,
                context,
                intent,
                ...(request.metadata === undefined
                  ? {}
                  : {
                      metadata: request.metadata
                    })
              }),
              {
                signal
              }
            )
          )
          plan = normalizeAiProviderOutput(providerOutput)
          break
        } catch (error) {
          if (signal.aborted || error === INVOCATION_ABORTED) {
            throw INVOCATION_ABORTED
          }

          const planningFailure = toAiPlanningFailure(error, attempt)
          if (
            !shouldRetryAiProviderFailure(planningFailure, this.retryPolicy)
          ) {
            return createFailedResult(
              {
                code: planningFailure.code,
                message: planningFailure.message,
                stage: planningFailure.stage
              },
              {
                retryCount: attempt - 1
              },
              this.redactionOptions
            )
          }

          attempt += 1
          evidence = {
            retryCount: attempt - 1
          }
        }
      }

      evidence = {
        plan,
        retryCount: attempt - 1
      }
      currentStage = 'validation'
      const prepared = validateAiPlan(plan, this.registry)
      currentStage = 'permission'
      const permissionReady = await evaluateAiPlanPermissions(
        prepared,
        context,
        this.permissionPolicy
      )

      currentStage = 'confirmation'
      let confirmed: AiConfirmedPlan
      try {
        confirmed = await confirmAiPlan(
          permissionReady,
          this.confirmationHandler,
          signal,
          this.redactionOptions
        )
      } catch (error) {
        if (
          error instanceof AiConfirmationError &&
          error.code === 'AI_CONFIRMATION_CANCELLED'
        ) {
          return createCancelledResult(
            'confirmation-cancelled',
            {
              ...evidence,
              preview: createAiPlanPreview(
                permissionReady,
                this.redactionOptions
              )
            },
            this.redactionOptions
          )
        }
        throw error
      }
      evidence = {
        ...evidence,
        preview: confirmed.preview
      }

      currentStage = 'transaction'
      const batch = await runAiPlanTransaction(
        confirmed,
        this.transactionRunner,
        signal,
        async () => {
          currentStage = 'execution'
          const result = await executeAiActions(
            confirmed,
            signal,
            this.redactionOptions
          )
          currentStage = 'transaction'
          return result
        }
      )
      currentStage = 'audit'
      const audit = createAiRuntimeAudit(
        {
          actionResults: batch.actionResults,
          ...(confirmed.explanation === undefined
            ? {}
            : {
                explanation: confirmed.explanation
              }),
          outcome: 'executed',
          planId: confirmed.planId,
          retryCount: evidence.retryCount
        },
        this.redactionOptions
      )

      return Object.freeze({
        actionResults: batch.actionResults,
        audit,
        planId: confirmed.planId,
        preview: confirmed.preview,
        status: 'executed',
        transaction: Object.freeze({
          status: 'committed'
        })
      })
    } catch (error) {
      if (signal.aborted || error === INVOCATION_ABORTED) {
        return createCancelledResult('aborted', evidence, this.redactionOptions)
      }

      return createFailedResult(
        stableFailure(error, STAGE_FAILURES[currentStage]),
        evidence,
        this.redactionOptions
      )
    }
  }
}

export const createAiAgentRuntime = (
  input: CreateAiAgentRuntimeInput
): AiAgentRuntime => new DefaultAiAgentRuntime(input)
