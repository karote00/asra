import type { AiProvider } from './provider'
import type { AiPreparedAction, AiPreparedPlan } from './plan'

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
  confirm(preview: unknown, options: { signal: AbortSignal }): Promise<boolean>
}

export interface AiTransactionRunner {
  run<T>(label: string, execute: () => Promise<T>): Promise<T>
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
