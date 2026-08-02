import type {
  AiProvider,
  AiRuntimeOptions,
  AiRuntimeOwnedResource,
  AiTransactionRunner,
  CreateAiAgentRuntimeInput
} from '@asyra/ai-agent-runtime'
import { createAiActions } from './actions'
import {
  createAiConfirmationHandler,
  type AiConfirmationRequest
} from './confirmation'
import { createAiContextProvider } from './context'
import { createAiPermissionPolicy, type AiPermissionRules } from './permission'
import { createAiTransactionRunner } from './transaction'

export interface CreateAiRuntimeInputOptions {
  readonly provider: AiProvider
  readonly permissionRules: AiPermissionRules
  readonly requestConfirmation?: AiConfirmationRequest
  readonly runtimeOptions?: AiRuntimeOptions
  readonly ownedResources?: readonly AiRuntimeOwnedResource[]
  readonly transactionRunner?: AiTransactionRunner
}

export const createAiRuntimeInput = (
  options: CreateAiRuntimeInputOptions
): CreateAiAgentRuntimeInput => ({
  actionDefinitions: createAiActions(),
  confirmationHandler: createAiConfirmationHandler(options.requestConfirmation),
  contextProvider: createAiContextProvider(),
  options: options.runtimeOptions,
  ownedResources: options.ownedResources,
  permissionPolicy: createAiPermissionPolicy(options.permissionRules),
  provider: options.provider,
  transactionRunner: options.transactionRunner ?? createAiTransactionRunner()
})
