import {
  createGenericHttpAiProvider,
  type GenericHttpAiProvider,
  type GenericHttpAiProviderOptions
} from '@asyra/ai-agent-runtime'
import { measureBrowserDragAsyncPhase } from '@asyra/utils'
import { ACTION_BATCH_ENDPOINT } from './action-batch-endpoint'

export { ACTION_BATCH_ENDPOINT } from './action-batch-endpoint'
export const ACTION_BATCH_TIMEOUT_MS = 300_000

export const createServerActionBatchProvider = (
  options: Pick<GenericHttpAiProviderOptions, 'fetch'> = {}
): GenericHttpAiProvider => {
  const provider = createGenericHttpAiProvider({
    endpoint: ACTION_BATCH_ENDPOINT,
    timeoutMs: ACTION_BATCH_TIMEOUT_MS,
    ...options
  })
  const requestActionBatch: GenericHttpAiProvider['requestActionBatch'] = (
    input,
    requestOptions
  ) =>
    measureBrowserDragAsyncPhase('ai-provider:server-response-handoff', () =>
      provider.requestActionBatch(input, requestOptions)
    )

  return Object.freeze({
    dispose: () => provider.dispose(),
    requestActionBatch
  })
}
