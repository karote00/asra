import {
  createAiAgentRuntime,
  type AiAgentRuntime,
  type AiProvider
} from '@asyra/ai-agent-runtime'
import { AsyraDesignAiActionNames } from '../constants'
import {
  createAsyraDesignAiHistoryProjection,
  type AsyraDesignAiHistoryProjection
} from '../common-apis/history'
import { createAsyraDesignAiRuntimeInput } from './runtime-input'
import {
  createAsyraDesignAiConfirmationBroker,
  type AsyraDesignAiConfirmationBroker
} from './confirmation'
import { createAsyraDesignServerActionBatchProvider } from './server-action-batch-provider'
import type { AsyraDesignServerResponseRecord } from './server-response-inbox'
import { createAsyraDesignAiTransactionRunner } from './transaction'

export interface AsyraDesignAiStartup {
  readonly confirmation: AsyraDesignAiConfirmationBroker
  readonly history: AsyraDesignAiHistoryProjection
  readonly runtime: AiAgentRuntime
}

interface AsyraDesignAiStartupFactories {
  readonly createConfirmation: () => AsyraDesignAiConfirmationBroker
  readonly createHistory: () => AsyraDesignAiHistoryProjection
  readonly createProvider: (
    response: AsyraDesignServerResponseRecord | null
  ) => AiProvider
}

const defaultFactories: AsyraDesignAiStartupFactories = {
  createConfirmation: createAsyraDesignAiConfirmationBroker,
  createHistory: createAsyraDesignAiHistoryProjection,
  createProvider: createAsyraDesignServerActionBatchProvider
}

export const createAsyraDesignAiStartup = (
  input: {
    readonly response: AsyraDesignServerResponseRecord | null
  },
  factories: AsyraDesignAiStartupFactories = defaultFactories
): AsyraDesignAiStartup => {
  const confirmation = factories.createConfirmation()
  const history = factories.createHistory()
  let runtime: AiAgentRuntime | undefined
  try {
    const provider = factories.createProvider(input.response)
    runtime = createAiAgentRuntime(
      createAsyraDesignAiRuntimeInput({
        permissionRules: {
          [AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION]: 'allow',
          [AsyraDesignAiActionNames.REMOVE_AI_COMPOSITION]: 'confirm',
          [AsyraDesignAiActionNames.REQUEST_DRAWING_DETAIL_CHOICE]: 'allow',
          [AsyraDesignAiActionNames.SELECT_ELEMENTS]: 'allow',
          [AsyraDesignAiActionNames.SET_ELEMENT_VISIBILITY]: 'allow',
          [AsyraDesignAiActionNames.UPDATE_COMPOSITION_ELEMENTS]: 'allow'
        },
        provider,
        requestConfirmation: confirmation.requestConfirmation,
        transactionRunner: createAsyraDesignAiTransactionRunner({ history })
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
