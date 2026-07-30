import {
  type AiProvider,
  type AiRuntimeOptions,
  type AiRuntimeOwnedResource,
  type AiTransactionRunner,
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
  readonly transactionRunner?: AiTransactionRunner
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
  transactionRunner:
    options.transactionRunner ?? createAsyraDesignAiTransactionRunner()
})
