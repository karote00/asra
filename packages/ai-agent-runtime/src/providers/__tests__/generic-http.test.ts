import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  AiProviderError,
  createGenericHttpAiProvider,
  type AiFetch,
  type AiFetchRequestInit,
  type AiFetchResponse,
  type AiProviderInput
} from '../..'

const providerInput = (): AiProviderInput => ({
  intent: 'resize the selected element',
  context: {
    selectedIds: ['shape-1']
  },
  actions: [
    {
      name: 'resize',
      description: 'Resize one element',
      inputSchema: {
        type: 'object'
      }
    }
  ],
  attempt: 1
})

const response = (
  output: unknown,
  options: {
    ok?: boolean
    status?: number
  } = {}
): AiFetchResponse => ({
  ok: options.ok ?? true,
  status: options.status ?? 200,
  json: vi.fn(async () => output)
})

const expectProviderError = async (
  promise: Promise<unknown>,
  code: AiProviderError['code']
) => {
  await expect(promise).rejects.toEqual(
    expect.objectContaining({
      code
    })
  )
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('generic HTTP AI provider', () => {
  it('posts detached provider input through injected fetch', async () => {
    const output = {
      batchId: 'batch-1',
      actions: []
    }
    const fetch: AiFetch = vi.fn(async () => response(output))
    const headers = {
      'X-App-Mode': 'test'
    }
    const provider = createGenericHttpAiProvider({
      endpoint: 'https://agent.example.test/v1/action-batch',
      fetch,
      headers
    })
    headers['X-App-Mode'] = 'mutated'
    const controller = new AbortController()

    await expect(
      provider.requestActionBatch(providerInput(), {
        signal: controller.signal
      })
    ).resolves.toBe(output)

    expect(fetch).toHaveBeenCalledOnce()
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe('https://agent.example.test/v1/action-batch')
    expect(init).toMatchObject({
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-app-mode': 'test'
      }
    })
    expect(JSON.parse(init.body)).toEqual(providerInput())
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('uses platform fetch when no transport is injected', async () => {
    const output = {
      batchId: 'platform-batch',
      actions: []
    }
    const fetch: AiFetch = vi.fn(async () => response(output))
    vi.stubGlobal('fetch', fetch)
    const provider = createGenericHttpAiProvider({
      endpoint: '/api/ai/action-batch'
    })

    await expect(
      provider.requestActionBatch(providerInput(), {
        signal: new AbortController().signal
      })
    ).resolves.toBe(output)

    expect(fetch).toHaveBeenCalledOnce()
  })

  it('accepts an absolute endpoint when it matches the browser origin', async () => {
    const fetch: AiFetch = vi.fn(async () =>
      response({
        batchId: 'same-origin-batch',
        actions: []
      })
    )
    vi.stubGlobal('location', {
      origin: 'http://localhost:4173'
    })
    const provider = createGenericHttpAiProvider({
      endpoint: 'http://localhost:4173/api/ai/action-batch',
      fetch
    })

    await provider.requestActionBatch(providerInput(), {
      signal: new AbortController().signal
    })

    expect(fetch).toHaveBeenCalledOnce()
  })

  it('rejects insecure or credential-bearing endpoints before transport', () => {
    const fetch: AiFetch = vi.fn()

    expect(() =>
      createGenericHttpAiProvider({
        endpoint: 'http://agent.example.test/v1/action-batch',
        fetch
      })
    ).toThrowError(
      expect.objectContaining({
        code: 'AI_PROVIDER_INVALID_ENDPOINT'
      })
    )
    expect(() =>
      createGenericHttpAiProvider({
        endpoint: 'https://user:secret@agent.example.test/v1/action-batch',
        fetch
      })
    ).toThrowError(
      expect.objectContaining({
        code: 'AI_PROVIDER_INVALID_ENDPOINT'
      })
    )
    expect(fetch).not.toHaveBeenCalled()
  })

  it('does not start transport for pre-abort or invalid input', async () => {
    const fetch: AiFetch = vi.fn()
    const provider = createGenericHttpAiProvider({
      endpoint: '/api/ai/action-batch',
      fetch
    })
    const controller = new AbortController()
    controller.abort('do not leak this reason')

    await expectProviderError(
      provider.requestActionBatch(providerInput(), {
        signal: controller.signal
      }),
      'AI_PROVIDER_ABORTED'
    )
    await expectProviderError(
      provider.requestActionBatch(
        {
          ...providerInput(),
          context: {
            unsupported: BigInt(1)
          }
        },
        {
          signal: new AbortController().signal
        }
      ),
      'AI_PROVIDER_INVALID_INPUT'
    )
    expect(fetch).not.toHaveBeenCalled()
  })

  it('returns stable retry metadata without retaining transport secrets', async () => {
    const secret = 'Bearer should-never-escape'
    const fetch: AiFetch = vi.fn(async () => {
      throw new Error(`upstream rejected ${secret}`)
    })
    const provider = createGenericHttpAiProvider({
      endpoint: '/api/ai/action-batch',
      fetch,
      headers: {
        authorization: secret
      }
    })

    const failure = provider.requestActionBatch(providerInput(), {
      signal: new AbortController().signal
    })

    await expect(failure).rejects.toEqual(
      expect.objectContaining({
        code: 'AI_PROVIDER_TRANSPORT_FAILED',
        retryable: true,
        stage: 'provider'
      })
    )
    await failure.catch((error: AiProviderError) => {
      expect(error.message).not.toContain(secret)
      expect(JSON.stringify(error)).not.toContain(secret)
      expect(error).not.toHaveProperty('cause')
    })
  })

  it('classifies HTTP and malformed-response failures without exposing bodies', async () => {
    const errorBody = vi.fn(async () => ({
      token: 'must-not-be-read'
    }))
    const statusFetch: AiFetch = vi.fn(async () => ({
      ok: false,
      status: 503,
      json: errorBody
    }))
    const statusProvider = createGenericHttpAiProvider({
      endpoint: '/api/ai/action-batch',
      fetch: statusFetch
    })

    await expect(
      statusProvider.requestActionBatch(providerInput(), {
        signal: new AbortController().signal
      })
    ).rejects.toEqual(
      expect.objectContaining({
        code: 'AI_PROVIDER_HTTP_STATUS',
        retryable: true,
        status: 503
      })
    )
    expect(errorBody).not.toHaveBeenCalled()

    const parseFetch: AiFetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: vi.fn(async () => {
        throw new Error('raw provider body')
      })
    }))
    const parseProvider = createGenericHttpAiProvider({
      endpoint: '/api/ai/action-batch',
      fetch: parseFetch
    })

    await expectProviderError(
      parseProvider.requestActionBatch(providerInput(), {
        signal: new AbortController().signal
      }),
      'AI_PROVIDER_MALFORMED_RESPONSE'
    )
  })

  it('aborts timed-out work and releases request listeners and timers', async () => {
    vi.useFakeTimers()
    const fetch: AiFetch = vi.fn(
      async (_url: string, init: AiFetchRequestInit) =>
        new Promise<AiFetchResponse>((_resolve, reject) => {
          init.signal.addEventListener(
            'abort',
            () => reject(new Error('transport aborted')),
            {
              once: true
            }
          )
        })
    )
    const provider = createGenericHttpAiProvider({
      endpoint: '/api/ai/action-batch',
      fetch,
      timeoutMs: 25
    })
    const signal = new AbortController().signal
    const addListener = vi.spyOn(signal, 'addEventListener')
    const removeListener = vi.spyOn(signal, 'removeEventListener')
    const pending = provider.requestActionBatch(providerInput(), {
      signal
    })
    const rejection = expectProviderError(pending, 'AI_PROVIDER_TIMEOUT')

    await vi.advanceTimersByTimeAsync(25)
    await rejection

    expect(addListener).toHaveBeenCalledOnce()
    expect(removeListener).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('applies the same timeout while parsing the response body', async () => {
    vi.useFakeTimers()
    const fetch: AiFetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => new Promise<unknown>(() => undefined)
    }))
    const provider = createGenericHttpAiProvider({
      endpoint: '/api/ai/action-batch',
      fetch,
      timeoutMs: 25
    })
    const pending = provider.requestActionBatch(providerInput(), {
      signal: new AbortController().signal
    })
    const rejection = expectProviderError(pending, 'AI_PROVIDER_TIMEOUT')

    await vi.advanceTimersByTimeAsync(25)
    await rejection
  })

  it('dispose aborts in-flight work and prevents later requests', async () => {
    vi.useFakeTimers()
    let requestSignal: AbortSignal | undefined
    const fetch: AiFetch = vi.fn(
      async (_url: string, init: AiFetchRequestInit) => {
        requestSignal = init.signal
        return new Promise<AiFetchResponse>((_resolve, reject) => {
          init.signal.addEventListener(
            'abort',
            () => reject(new Error('transport aborted')),
            {
              once: true
            }
          )
        })
      }
    )
    const provider = createGenericHttpAiProvider({
      endpoint: '/api/ai/action-batch',
      fetch
    })
    const signal = new AbortController().signal
    const removeListener = vi.spyOn(signal, 'removeEventListener')
    const pending = provider.requestActionBatch(providerInput(), {
      signal
    })
    const rejection = expectProviderError(pending, 'AI_PROVIDER_DISPOSED')

    provider.dispose()

    expect(removeListener).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)

    await rejection

    expect(requestSignal?.aborted).toBe(true)
    await expectProviderError(
      provider.requestActionBatch(providerInput(), {
        signal: new AbortController().signal
      }),
      'AI_PROVIDER_DISPOSED'
    )
    expect(fetch).toHaveBeenCalledOnce()
  })
})
