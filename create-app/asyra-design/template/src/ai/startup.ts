import type { AiProvider } from '@asyra/ai-agent-runtime'
import {
  createAsyraDesignAiHistoryProjection,
  type AsyraDesignAiHistoryProjection
} from '../common-apis/history'
import { AsyraDesignAiActionNames } from '../constants'
import type { AsyraDesignAiDeliveryMode } from './actions'
import {
  createAsyraDesignAiRuntimeInput,
  type ComposeAiAgentRuntimeOptions
} from './composition'
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
  readonly runtimeOptions: ComposeAiAgentRuntimeOptions
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
    readonly deliveryMode: AsyraDesignAiDeliveryMode
    readonly response: AsyraDesignServerResponseRecord | null
  },
  factories: AsyraDesignAiStartupFactories = defaultFactories
): AsyraDesignAiStartup => {
  const confirmation = factories.createConfirmation()
  const history = factories.createHistory()
  const provider = factories.createProvider(input.response)
  const runtimeOptions: ComposeAiAgentRuntimeOptions = Object.freeze({
    createRuntimeInput: () =>
      createAsyraDesignAiRuntimeInput({
        deliveryMode: input.deliveryMode,
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
        transactionRunner: createAsyraDesignAiTransactionRunner(
          undefined,
          history
        )
      }),
    enabled: true,
    providerEnabled: true
  })

  return Object.freeze({
    confirmation,
    history,
    runtimeOptions
  })
}
