import {
  AiProviderError,
  type AiActionBatch,
  type AiProvider,
  type AiProviderInput
} from '../provider'

export interface AiFetchRequestInit {
  readonly body: string
  readonly headers: Readonly<Record<string, string>>
  readonly method: 'POST'
  readonly signal: AbortSignal
}

export interface AiFetchResponse {
  readonly ok: boolean
  readonly status: number
  json(): Promise<unknown>
}

export type AiFetch = (
  input: string,
  init: AiFetchRequestInit
) => Promise<AiFetchResponse>

export interface GenericHttpAiProviderOptions {
  readonly endpoint: string
  readonly fetch?: AiFetch
  readonly headers?: Readonly<Record<string, string>>
  readonly timeoutMs?: number
}

export interface GenericHttpAiProvider extends AiProvider {
  dispose(): void
}

interface ProviderAttempt {
  cleanup(): void
  readonly controller: AbortController
  disposed: boolean
  timedOut: boolean
}

const DEFAULT_TIMEOUT_MS = 30_000
const ABORTED_TRANSPORT = Symbol('ABORTED_TRANSPORT')

const providerError = (
  options: ConstructorParameters<typeof AiProviderError>[0]
): never => {
  throw new AiProviderError(options)
}

const validateEndpoint = (value: string): string => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return providerError({
      code: 'AI_PROVIDER_INVALID_ENDPOINT',
      message: 'AI provider endpoint must be HTTPS or same-origin.'
    })
  }

  const endpoint = value.trim()
  const hasScheme = /^[A-Za-z][A-Za-z\d+.-]*:/.test(endpoint)
  if (!hasScheme && !endpoint.startsWith('//')) {
    try {
      const base = new URL('https://same-origin.invalid')
      const relative = new URL(endpoint, base)
      if (
        relative.origin === base.origin &&
        relative.username.length === 0 &&
        relative.password.length === 0
      ) {
        return endpoint
      }
    } catch {
      // The stable endpoint failure below owns malformed relative values.
    }
  }

  let url: URL
  try {
    url = new URL(endpoint)
  } catch {
    return providerError({
      code: 'AI_PROVIDER_INVALID_ENDPOINT',
      message: 'AI provider endpoint must be HTTPS or same-origin.'
    })
  }

  const browserOrigin =
    typeof globalThis.location === 'object'
      ? globalThis.location.origin
      : undefined
  const isSameOrigin =
    typeof browserOrigin === 'string' && url.origin === browserOrigin

  if (
    (url.protocol !== 'https:' && !isSameOrigin) ||
    url.username.length > 0 ||
    url.password.length > 0
  ) {
    return providerError({
      code: 'AI_PROVIDER_INVALID_ENDPOINT',
      message: 'AI provider endpoint must be HTTPS or same-origin.'
    })
  }

  return endpoint
}

const validateTimeout = (value: number | undefined): number => {
  const timeoutMs = value ?? DEFAULT_TIMEOUT_MS
  if (
    !Number.isFinite(timeoutMs) ||
    !Number.isInteger(timeoutMs) ||
    timeoutMs <= 0
  ) {
    return providerError({
      code: 'AI_PROVIDER_INVALID_CONFIGURATION',
      message: 'AI provider timeout must be a positive finite integer.'
    })
  }

  return timeoutMs
}

const detachHeaders = (
  value: Readonly<Record<string, string>> | undefined
): Readonly<Record<string, string>> => {
  const headers: Record<string, string> = {
    accept: 'application/json',
    'content-type': 'application/json'
  }

  for (const [rawName, rawValue] of Object.entries(value ?? {})) {
    const name = rawName.trim().toLowerCase()
    if (name.length === 0 || typeof rawValue !== 'string') {
      return providerError({
        code: 'AI_PROVIDER_INVALID_CONFIGURATION',
        message: 'AI provider headers must use non-empty names and strings.'
      })
    }

    Object.defineProperty(headers, name, {
      configurable: true,
      enumerable: true,
      value: rawValue,
      writable: true
    })
  }

  return Object.freeze(headers)
}

const assertJsonSafe = (
  value: unknown,
  ancestors = new WeakSet<object>()
): void => {
  if (
    value === null ||
    typeof value === 'boolean' ||
    typeof value === 'string'
  ) {
    return
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return
  }

  if (typeof value !== 'object') {
    return providerError({
      code: 'AI_PROVIDER_INVALID_INPUT',
      message: 'AI provider input must contain only detached JSON values.'
    })
  }

  if (ancestors.has(value)) {
    return providerError({
      code: 'AI_PROVIDER_INVALID_INPUT',
      message: 'AI provider input must not contain cycles.'
    })
  }

  const prototype = Object.getPrototypeOf(value)
  if (
    !Array.isArray(value) &&
    prototype !== Object.prototype &&
    prototype !== null
  ) {
    return providerError({
      code: 'AI_PROVIDER_INVALID_INPUT',
      message: 'AI provider input must contain only plain JSON objects.'
    })
  }

  ancestors.add(value)
  try {
    if (Array.isArray(value)) {
      for (let index = 0; index < value.length; index += 1) {
        if (!(index in value)) {
          return providerError({
            code: 'AI_PROVIDER_INVALID_INPUT',
            message: 'AI provider input must not contain sparse arrays.'
          })
        }
        assertJsonSafe(value[index], ancestors)
      }
      return
    }

    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== 'string') {
        return providerError({
          code: 'AI_PROVIDER_INVALID_INPUT',
          message: 'AI provider input must contain only JSON object keys.'
        })
      }

      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (!descriptor?.enumerable || !('value' in descriptor)) {
        return providerError({
          code: 'AI_PROVIDER_INVALID_INPUT',
          message: 'AI provider input must contain plain enumerable values.'
        })
      }

      assertJsonSafe(descriptor.value, ancestors)
    }
  } finally {
    ancestors.delete(value)
  }
}

const serializeInput = (input: AiProviderInput): string => {
  assertJsonSafe(input)

  try {
    return JSON.stringify(input)
  } catch {
    return providerError({
      code: 'AI_PROVIDER_INVALID_INPUT',
      message: 'AI provider input could not be serialized.'
    })
  }
}

const getPlatformFetch = (): AiFetch => {
  if (typeof globalThis.fetch !== 'function') {
    return providerError({
      code: 'AI_PROVIDER_FETCH_UNAVAILABLE',
      message: 'No fetch-compatible AI provider transport is available.'
    })
  }

  return globalThis.fetch.bind(globalThis) as unknown as AiFetch
}

class DefaultGenericHttpAiProvider implements GenericHttpAiProvider {
  private readonly endpoint: string
  private readonly fetch: AiFetch
  private readonly headers: Readonly<Record<string, string>>
  private readonly timeoutMs: number
  private readonly attempts = new Set<ProviderAttempt>()
  private disposed = false

  constructor(options: GenericHttpAiProviderOptions) {
    this.endpoint = validateEndpoint(options.endpoint)
    this.fetch = options.fetch ?? getPlatformFetch()
    this.headers = detachHeaders(options.headers)
    this.timeoutMs = validateTimeout(options.timeoutMs)
  }

  async requestActionBatch(
    input: AiProviderInput,
    options: { signal: AbortSignal }
  ): Promise<AiActionBatch> {
    if (this.disposed) {
      return providerError({
        code: 'AI_PROVIDER_DISPOSED',
        message: 'AI provider has been disposed.'
      })
    }

    if (options.signal.aborted) {
      return providerError({
        code: 'AI_PROVIDER_ABORTED',
        message: 'AI provider request was aborted.'
      })
    }

    const body = serializeInput(input)
    const attempt: ProviderAttempt = {
      cleanup: () => undefined,
      controller: new AbortController(),
      disposed: false,
      timedOut: false
    }
    const abortTransport = () => attempt.controller.abort()
    options.signal.addEventListener('abort', abortTransport, {
      once: true
    })
    const timeout = setTimeout(() => {
      attempt.timedOut = true
      attempt.controller.abort()
    }, this.timeoutMs)

    let abortWaitListener: (() => void) | undefined
    const aborted = new Promise<never>((_resolve, reject) => {
      abortWaitListener = () => reject(ABORTED_TRANSPORT)
      attempt.controller.signal.addEventListener('abort', abortWaitListener, {
        once: true
      })
    })
    let cleaned = false
    attempt.cleanup = () => {
      if (cleaned) {
        return
      }

      cleaned = true
      clearTimeout(timeout)
      options.signal.removeEventListener('abort', abortTransport)
      if (abortWaitListener) {
        attempt.controller.signal.removeEventListener(
          'abort',
          abortWaitListener
        )
      }
      this.attempts.delete(attempt)
    }
    this.attempts.add(attempt)

    try {
      const transport = this.fetch(this.endpoint, {
        body,
        headers: this.headers,
        method: 'POST',
        signal: attempt.controller.signal
      })
      const response = await Promise.race([transport, aborted])

      this.assertAttemptActive(attempt, options.signal)

      if (!response.ok) {
        return providerError({
          code: 'AI_PROVIDER_HTTP_STATUS',
          message: 'AI provider returned a non-success status.',
          retryable: response.status === 429 || response.status >= 500,
          status: response.status
        })
      }

      let output: unknown
      try {
        output = await Promise.race([response.json(), aborted])
      } catch (error) {
        if (error === ABORTED_TRANSPORT) {
          throw error
        }

        return providerError({
          code: 'AI_PROVIDER_MALFORMED_RESPONSE',
          message: 'AI provider returned malformed JSON.',
          retryable: true
        })
      }

      this.assertAttemptActive(attempt, options.signal)
      return output as AiActionBatch
    } catch (error) {
      if (error instanceof AiProviderError) {
        throw error
      }

      if (attempt.disposed || this.disposed) {
        return providerError({
          code: 'AI_PROVIDER_DISPOSED',
          message: 'AI provider has been disposed.'
        })
      }

      if (options.signal.aborted) {
        return providerError({
          code: 'AI_PROVIDER_ABORTED',
          message: 'AI provider request was aborted.'
        })
      }

      if (attempt.timedOut) {
        return providerError({
          code: 'AI_PROVIDER_TIMEOUT',
          message: 'AI provider request timed out.',
          retryable: true
        })
      }

      return providerError({
        code: 'AI_PROVIDER_TRANSPORT_FAILED',
        message: 'AI provider transport failed.',
        retryable: true
      })
    } finally {
      attempt.cleanup()
    }
  }

  dispose(): void {
    if (this.disposed) {
      return
    }

    this.disposed = true
    for (const attempt of this.attempts) {
      attempt.disposed = true
      attempt.controller.abort()
      attempt.cleanup()
    }
  }

  private assertAttemptActive(
    attempt: ProviderAttempt,
    signal: AbortSignal
  ): void {
    if (attempt.disposed || this.disposed) {
      return providerError({
        code: 'AI_PROVIDER_DISPOSED',
        message: 'AI provider has been disposed.'
      })
    }

    if (signal.aborted) {
      return providerError({
        code: 'AI_PROVIDER_ABORTED',
        message: 'AI provider request was aborted.'
      })
    }

    if (attempt.timedOut) {
      return providerError({
        code: 'AI_PROVIDER_TIMEOUT',
        message: 'AI provider request timed out.',
        retryable: true
      })
    }
  }
}

export const createGenericHttpAiProvider = (
  options: GenericHttpAiProviderOptions
): GenericHttpAiProvider => new DefaultGenericHttpAiProvider(options)
