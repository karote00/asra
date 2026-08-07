import type { AiActionBatch, AiProviderInput } from '@asyra/ai-agent-runtime'
import { AI_APP_PROMPT, AI_IMAGE_TOOL_CATALOG } from './ai-domain-prompt'

export type AiModelBackendErrorCode =
  | 'AI_MODEL_BACKEND_ABORTED'
  | 'AI_MODEL_BACKEND_HTTP_STATUS'
  | 'AI_MODEL_BACKEND_INVALID_CONFIGURATION'
  | 'AI_MODEL_BACKEND_INVALID_RESPONSE'
  | 'AI_MODEL_BACKEND_TRANSPORT_FAILED'

export class AiModelBackendError extends Error {
  readonly code: AiModelBackendErrorCode
  readonly status?: number

  constructor(
    code: AiModelBackendErrorCode,
    message: string,
    options: { readonly status?: number } = {}
  ) {
    super(message)
    this.name = 'AiModelBackendError'
    this.code = code
    this.status = options.status
  }
}

interface AiModelBackendConfiguration {
  readonly apiKey: string
  readonly endpoint: string
  readonly model: string
}

interface AiModelBackendOptions {
  readonly environment?: Readonly<Record<string, string | undefined>>
  readonly fetch?: typeof fetch
  readonly signal?: AbortSignal
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const invalidConfiguration = (message: string): never => {
  throw new AiModelBackendError(
    'AI_MODEL_BACKEND_INVALID_CONFIGURATION',
    message
  )
}

const requireSetting = (
  environment: Readonly<Record<string, string | undefined>>,
  name: string
): string => {
  const value = environment[name]?.trim()
  if (!value) {
    return invalidConfiguration(`The Asyra Design AI backend requires ${name}.`)
  }
  return value
}

const isLoopbackHost = (hostname: string): boolean =>
  hostname === 'localhost' ||
  hostname === '127.0.0.1' ||
  hostname === '[::1]' ||
  hostname === '::1'

export const resolveAiModelBackendConfiguration = (
  environment: Readonly<Record<string, string | undefined>> = process.env
): AiModelBackendConfiguration => {
  const endpointValue = requireSetting(
    environment,
    'ASYRA_AI_PROVIDER_ENDPOINT'
  )
  const model = requireSetting(environment, 'ASYRA_AI_PROVIDER_MODEL')
  const apiKey = requireSetting(environment, 'ASYRA_AI_PROVIDER_API_KEY')

  let endpoint: URL
  try {
    endpoint = new URL(endpointValue)
  } catch {
    return invalidConfiguration(
      'ASYRA_AI_PROVIDER_ENDPOINT must be an absolute HTTP(S) URL.'
    )
  }
  if (
    (endpoint.protocol !== 'https:' &&
      !(endpoint.protocol === 'http:' && isLoopbackHost(endpoint.hostname))) ||
    endpoint.username.length > 0 ||
    endpoint.password.length > 0 ||
    endpoint.hash.length > 0
  ) {
    return invalidConfiguration(
      'ASYRA_AI_PROVIDER_ENDPOINT must use HTTPS, except for loopback development, and cannot contain credentials or a fragment.'
    )
  }

  return Object.freeze({
    apiKey,
    endpoint: endpoint.toString(),
    model
  })
}

const isActionBatchEnvelope = (value: unknown): value is AiActionBatch => {
  if (
    !isRecord(value) ||
    typeof value.batchId !== 'string' ||
    value.batchId.trim().length === 0 ||
    !Array.isArray(value.actions) ||
    value.actions.length === 0
  ) {
    return false
  }
  return value.actions.every(
    (action) =>
      isRecord(action) &&
      typeof action.id === 'string' &&
      action.id.trim().length > 0 &&
      typeof action.name === 'string' &&
      action.name.trim().length > 0 &&
      Object.prototype.hasOwnProperty.call(action, 'arguments') &&
      Object.prototype.hasOwnProperty.call(action, 'summary')
  )
}

export const requestConfiguredAiActionBatch = async (
  input: AiProviderInput,
  options: AiModelBackendOptions = {}
): Promise<AiActionBatch> => {
  const configuration = resolveAiModelBackendConfiguration(
    options.environment ?? process.env
  )
  if (options.signal?.aborted) {
    throw new AiModelBackendError(
      'AI_MODEL_BACKEND_ABORTED',
      'The configured AI model request was aborted.'
    )
  }

  const fetchImpl = options.fetch ?? globalThis.fetch
  let response: Response
  try {
    response = await fetchImpl(configuration.endpoint, {
      body: JSON.stringify({
        imageTools: AI_IMAGE_TOOL_CATALOG,
        input,
        model: configuration.model,
        protocolVersion: 1,
        systemPrompt: AI_APP_PROMPT
      }),
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${configuration.apiKey}`,
        'content-type': 'application/json'
      },
      method: 'POST',
      redirect: 'error',
      signal: options.signal
    })
  } catch (error) {
    if (
      options.signal?.aborted ||
      (error instanceof Error && error.name === 'AbortError')
    ) {
      throw new AiModelBackendError(
        'AI_MODEL_BACKEND_ABORTED',
        'The configured AI model request was aborted.'
      )
    }
    throw new AiModelBackendError(
      'AI_MODEL_BACKEND_TRANSPORT_FAILED',
      'The configured AI model request failed before a response was received.'
    )
  }

  if (!response.ok) {
    throw new AiModelBackendError(
      'AI_MODEL_BACKEND_HTTP_STATUS',
      'The configured AI model endpoint returned an unsuccessful status.',
      { status: response.status }
    )
  }

  let value: unknown
  try {
    value = await response.json()
  } catch {
    throw new AiModelBackendError(
      'AI_MODEL_BACKEND_INVALID_RESPONSE',
      'The configured AI model endpoint returned invalid JSON.'
    )
  }
  if (!isActionBatchEnvelope(value)) {
    throw new AiModelBackendError(
      'AI_MODEL_BACKEND_INVALID_RESPONSE',
      'The configured AI model endpoint returned an invalid action batch.'
    )
  }
  return value
}
