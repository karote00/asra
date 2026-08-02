import {
  createAiAgentRuntime,
  type AiAgentRuntime,
  type AiProvider
} from '@asyra/ai-agent-runtime'
import { AiActionNames } from '../constants'
import {
  createAiHistoryProjection,
  type AiHistoryProjection
} from '../common-apis/history'
import { createAiRuntimeInput } from './runtime-input'
import {
  createAiConfirmationBroker,
  type AiConfirmationBroker
} from './confirmation'
import { createServerActionBatchProvider } from './server-action-batch-provider'
import type { ServerResponseRecord } from './server-response-inbox'
import { createAiTransactionRunner } from './transaction'

export interface AiStartup {
  readonly confirmation: AiConfirmationBroker
  readonly history: AiHistoryProjection
  readonly runtime: AiAgentRuntime
}

interface AiStartupFactories {
  readonly createConfirmation: () => AiConfirmationBroker
  readonly createHistory: () => AiHistoryProjection
  readonly createProvider: (response: ServerResponseRecord | null) => AiProvider
}

const defaultFactories: AiStartupFactories = {
  createConfirmation: createAiConfirmationBroker,
  createHistory: createAiHistoryProjection,
  createProvider: createServerActionBatchProvider
}

export const createAiStartup = (
  input: {
    readonly response: ServerResponseRecord | null
  },
  factories: AiStartupFactories = defaultFactories
): AiStartup => {
  const confirmation = factories.createConfirmation()
  const history = factories.createHistory()
  let runtime: AiAgentRuntime | undefined
  try {
    const provider = factories.createProvider(input.response)
    runtime = createAiAgentRuntime(
      createAiRuntimeInput({
        permissionRules: {
          [AiActionNames.INSERT_VECTOR_COMPOSITION]: 'allow',
          [AiActionNames.REMOVE_AI_COMPOSITION]: 'confirm',
          [AiActionNames.REQUEST_DRAWING_DETAIL_CHOICE]: 'allow',
          [AiActionNames.SELECT_ELEMENTS]: 'allow',
          [AiActionNames.SET_ELEMENT_VISIBILITY]: 'allow',
          [AiActionNames.UPDATE_COMPOSITION_ELEMENTS]: 'allow'
        },
        provider,
        requestConfirmation: confirmation.requestConfirmation,
        transactionRunner: createAiTransactionRunner({ history })
      })
    )

    return Object.freeze({
      confirmation,
      history,
      runtime
    })
  } catch (error) {
    history.dispose()
    void Promise.allSettled([
      confirmation.dispose(),
      ...(runtime ? [runtime.dispose()] : [])
    ])
    throw error
  }
}
