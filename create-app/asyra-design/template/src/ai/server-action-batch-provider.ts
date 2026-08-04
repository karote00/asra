import {
  createGenericHttpAiProvider,
  type GenericHttpAiProvider,
  type GenericHttpAiProviderOptions
} from '@asyra/ai-agent-runtime'
import { ACTION_BATCH_ENDPOINT } from './action-batch-endpoint'

export { ACTION_BATCH_ENDPOINT } from './action-batch-endpoint'
export const ACTION_BATCH_TIMEOUT_MS = 300_000

export const createServerActionBatchProvider = (
  options: Pick<GenericHttpAiProviderOptions, 'fetch'> = {}
): GenericHttpAiProvider =>
  createGenericHttpAiProvider({
    endpoint: ACTION_BATCH_ENDPOINT,
    timeoutMs: ACTION_BATCH_TIMEOUT_MS,
    ...options
  })
