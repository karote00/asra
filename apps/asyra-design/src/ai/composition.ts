import {
  createAiAgentRuntime,
  type AiAgentRuntime,
  type AiProvider,
  type AiRuntimeOptions,
  type AiRuntimeOwnedResource,
  type CreateAiAgentRuntimeInput
} from '@asyra/ai-agent-runtime'
import { createAsyraDesignAiActions } from './actions'
import {
  createAsyraDesignAiConfirmationHandler,
  type AsyraDesignAiConfirmationRequest
} from './confirmation'
import { createAsyraDesignAiContextProvider } from './context'
import {
  createAsyraDesignAiPermissionPolicy,
  type AsyraDesignAiPermissionRules
} from './permission'
import { createAsyraDesignAiTransactionRunner } from './transaction'

export interface CreateAsyraDesignAiRuntimeInputOptions {
  readonly provider: AiProvider
  readonly permissionRules: AsyraDesignAiPermissionRules
  readonly requestConfirmation?: AsyraDesignAiConfirmationRequest
  readonly runtimeOptions?: AiRuntimeOptions
  readonly ownedResources?: readonly AiRuntimeOwnedResource[]
}

export const createAsyraDesignAiRuntimeInput = (
  options: CreateAsyraDesignAiRuntimeInputOptions
): CreateAiAgentRuntimeInput => ({
  actionDefinitions: createAsyraDesignAiActions(),
  confirmationHandler: createAsyraDesignAiConfirmationHandler(
    options.requestConfirmation
  ),
  contextProvider: createAsyraDesignAiContextProvider(),
  options: options.runtimeOptions,
  ownedResources: options.ownedResources,
  permissionPolicy: createAsyraDesignAiPermissionPolicy(
    options.permissionRules
  ),
  provider: options.provider,
  transactionRunner: createAsyraDesignAiTransactionRunner()
})

export interface ComposeAiAgentRuntimeOptions {
  enabled: boolean
  providerEnabled?: boolean
  createRuntimeInput?: () => CreateAiAgentRuntimeInput
}

export type AiRuntimeComposition =
  | {
      readonly enabled: false
      readonly providerEnabled: false
      readonly runtime: null
      dispose(): Promise<void>
    }
  | {
      readonly enabled: true
      readonly providerEnabled: false
      readonly runtime: null
      dispose(): Promise<void>
    }
  | {
      readonly enabled: true
      readonly providerEnabled: true
      readonly runtime: AiAgentRuntime
      dispose(): Promise<void>
    }

export const composeAiAgentRuntime = (
  options: ComposeAiAgentRuntimeOptions
): AiRuntimeComposition => {
  if (!options.enabled) {
    return Object.freeze({
      enabled: false,
      providerEnabled: false,
      runtime: null,
      dispose: async () => undefined
    })
  }

  if (options.providerEnabled === false) {
    return Object.freeze({
      enabled: true,
      providerEnabled: false,
      runtime: null,
      dispose: async () => undefined
    })
  }

  if (!options.createRuntimeInput) {
    throw new Error('createRuntimeInput is required when AI is enabled')
  }

  const runtime = createAiAgentRuntime(options.createRuntimeInput())

  return Object.freeze({
    enabled: true,
    providerEnabled: true,
    runtime,
    dispose: () => runtime.dispose()
  })
}
