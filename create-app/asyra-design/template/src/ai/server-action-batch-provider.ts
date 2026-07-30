import { AiProviderError, type AiProvider } from '@asyra/ai-agent-runtime'
import { measureBrowserDragPhase } from '@asyra/utils'
import type { AsyraDesignServerResponseRecord } from './server-response-inbox'

const unavailableResponse = (): never => {
  throw new AiProviderError({
    code: 'AI_PROVIDER_INVALID_CONFIGURATION',
    message: 'The required fileId has no resident server-prepared action batch.'
  })
}

const abortedRequest = (): never => {
  throw new AiProviderError({
    code: 'AI_PROVIDER_ABORTED',
    message: 'The server action-batch request was aborted.'
  })
}

export const createAsyraDesignServerActionBatchProvider = (
  response: AsyraDesignServerResponseRecord | null
): AiProvider =>
  Object.freeze({
    requestActionBatch: async (_input, { signal }) =>
      measureBrowserDragPhase('ai-provider:server-response-handoff', () => {
        if (signal.aborted) {
          return abortedRequest()
        }
        return response === null ? unavailableResponse() : response.batch
      })
  })
