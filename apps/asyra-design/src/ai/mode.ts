import type { AiProvider } from '@asyra/ai-agent-runtime'
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
import {
  createAsyraDesignMockAiProvider,
  type AsyraDesignMockAiProvider
} from './mock-provider'
import {
  createAsyraDesignAiHistoryProjection,
  type AsyraDesignAiHistoryProjection
} from '../common-apis/history'
import { createAsyraDesignAiTransactionRunner } from './transaction'

export type AsyraDesignAiMode = 'disabled' | 'mock'
export type { AsyraDesignAiDeliveryMode } from './actions'

export interface AsyraDesignAiStartup {
  readonly confirmation: AsyraDesignAiConfirmationBroker | null
  readonly history: AsyraDesignAiHistoryProjection | null
  readonly mode: AsyraDesignAiMode
  readonly runtimeOptions: ComposeAiAgentRuntimeOptions
}

interface AsyraDesignAiStartupFactories {
  readonly createConfirmation: () => AsyraDesignAiConfirmationBroker
  readonly createHistory: () => AsyraDesignAiHistoryProjection
  readonly createProvider: () => AsyraDesignMockAiProvider
}

const defaultFactories: AsyraDesignAiStartupFactories = {
  createConfirmation: createAsyraDesignAiConfirmationBroker,
  createHistory: createAsyraDesignAiHistoryProjection,
  createProvider: createAsyraDesignMockAiProvider
}

export const resolveAsyraDesignAiMode = (search: string): AsyraDesignAiMode => {
  const values = new URLSearchParams(search).getAll('ai')
  return values.length === 1 && values[0] === 'mock' ? 'mock' : 'disabled'
}

export const resolveAsyraDesignAiDeliveryMode = (
  search: string
): AsyraDesignAiDeliveryMode => {
  const values = new URLSearchParams(search).getAll('aiDelivery')
  return values.length === 1 && values[0] === 'progressive'
    ? 'progressive'
    : 'atomic'
}

export const createAsyraDesignAiStartup = (
  mode: AsyraDesignAiMode,
  factories: AsyraDesignAiStartupFactories = defaultFactories,
  deliveryMode: AsyraDesignAiDeliveryMode = 'atomic'
): AsyraDesignAiStartup => {
  if (mode !== 'mock') {
    return Object.freeze({
      confirmation: null,
      history: null,
      mode: 'disabled',
      runtimeOptions: Object.freeze({
        enabled: false
      })
    })
  }

  const confirmation = factories.createConfirmation()
  const history = factories.createHistory()
  const provider = factories.createProvider()
  const runtimeOptions: ComposeAiAgentRuntimeOptions = Object.freeze({
    createRuntimeInput: () =>
      createAsyraDesignAiRuntimeInput({
        deliveryMode,
        ownedResources: [provider],
        permissionRules: {
          [AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION]: 'allow',
          [AsyraDesignAiActionNames.REMOVE_AI_COMPOSITION]: 'confirm',
          [AsyraDesignAiActionNames.REQUEST_DRAWING_DETAIL_CHOICE]: 'allow',
          [AsyraDesignAiActionNames.SELECT_ELEMENTS]: 'allow',
          [AsyraDesignAiActionNames.SET_ELEMENT_VISIBILITY]: 'allow',
          [AsyraDesignAiActionNames.UPDATE_COMPOSITION_ELEMENTS]: 'allow'
        },
        provider: provider as AiProvider,
        requestConfirmation: confirmation.requestConfirmation,
        transactionRunner: createAsyraDesignAiTransactionRunner({ history })
      }),
    enabled: true,
    providerEnabled: true
  })

  return Object.freeze({
    confirmation,
    history,
    mode,
    runtimeOptions
  })
}
