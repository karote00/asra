import type { AiActionDescription, AiJsonValue } from './types'

export interface AiProviderInput<TContext = unknown> {
  readonly intent: string
  readonly context: TContext
  readonly actions: readonly AiActionDescription[]
  readonly attempt: number
  readonly metadata?: AiJsonValue
}

export interface AiProvider {
  generateActionPlan(
    input: AiProviderInput,
    options: { signal: AbortSignal }
  ): Promise<unknown>
  dispose?(): void | Promise<void>
}

export type AiProviderErrorCode =
  | 'AI_PROVIDER_ABORTED'
  | 'AI_PROVIDER_DISPOSED'
  | 'AI_PROVIDER_FETCH_UNAVAILABLE'
  | 'AI_PROVIDER_HTTP_STATUS'
  | 'AI_PROVIDER_INVALID_CONFIGURATION'
  | 'AI_PROVIDER_INVALID_ENDPOINT'
  | 'AI_PROVIDER_INVALID_INPUT'
  | 'AI_PROVIDER_MALFORMED_RESPONSE'
  | 'AI_PROVIDER_TIMEOUT'
  | 'AI_PROVIDER_TRANSPORT_FAILED'

export interface AiProviderErrorOptions {
  readonly code: AiProviderErrorCode
  readonly message: string
  readonly retryable?: boolean
  readonly status?: number
}

export class AiProviderError extends Error {
  readonly code: AiProviderErrorCode
  readonly retryable: boolean
  readonly stage = 'provider' as const
  readonly status?: number

  constructor(options: AiProviderErrorOptions) {
    super(options.message)
    this.name = 'AiProviderError'
    this.code = options.code
    this.retryable = options.retryable ?? false
    this.status = options.status
  }
}
