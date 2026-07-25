export interface AiProvider {
  generateActionPlan(
    input: unknown,
    options: { signal: AbortSignal }
  ): Promise<unknown>
}

export interface AiContextProvider {
  getContext(input: { intent: string; signal: AbortSignal }): Promise<unknown>
}

export interface AiPermissionPolicy {
  evaluate(action: unknown): unknown
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
