import type { AiActionBatch, AiProviderInput } from '@asyra/ai-agent-runtime'
import { describe, expect, it, vi } from 'vitest'
import { requestConfiguredAiActionBatch } from '../ai-model-provider'

const input: AiProviderInput = {
  actions: [
    {
      description: 'Create one rectangle',
      inputSchema: {},
      name: 'create_rectangle'
    }
  ],
  attempt: 1,
  context: {
    elementCount: 0,
    workspaceId: 'workspace-1'
  },
  intent: 'Create a rectangle'
}

const batch: AiActionBatch = {
  actions: [
    {
      arguments: { height: 40, width: 80, x: 10, y: 20 },
      id: 'action-1',
      name: 'create_rectangle',
      summary: 'Create one rectangle'
    }
  ],
  batchId: 'batch-1'
}

describe('Asyra Design configured AI model backend', () => {
  it('requires endpoint, model, and API key before any upstream request', async () => {
    const fetchImpl = vi.fn(
      async (_input: string | URL | Request, _init?: RequestInit) =>
        new Response()
    )

    await expect(
      requestConfiguredAiActionBatch(input, {
        environment: {
          AI_PROVIDER_API_KEY: 'secret',
          AI_PROVIDER_ENDPOINT: 'https://provider.example/actions'
        },
        fetch: fetchImpl
      })
    ).rejects.toMatchObject({
      code: 'AI_MODEL_BACKEND_INVALID_CONFIGURATION'
    })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('keeps the API key in the authorization header and injects domain knowledge only on the server', async () => {
    const fetchImpl = vi.fn(
      async (_input: string | URL | Request, _init?: RequestInit) =>
        new Response(JSON.stringify(batch), {
          headers: { 'content-type': 'application/json' },
          status: 200
        })
    )

    await expect(
      requestConfiguredAiActionBatch(input, {
        environment: {
          AI_PROVIDER_API_KEY: 'backend-only-secret',
          AI_PROVIDER_ENDPOINT: 'https://provider.example/actions',
          AI_PROVIDER_MODEL: 'configured-model'
        },
        fetch: fetchImpl
      })
    ).resolves.toEqual(batch)

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [endpoint, request] = fetchImpl.mock.calls[0] ?? []
    expect(endpoint).toBe('https://provider.example/actions')
    expect(new Headers(request?.headers).get('authorization')).toBe(
      'Bearer backend-only-secret'
    )

    const body = JSON.parse(String(request?.body)) as Record<string, unknown>
    expect(body).toMatchObject({
      input,
      model: 'configured-model',
      protocolVersion: 1
    })
    expect(body.systemPrompt).toMatch(/registered App actions and image tools/i)
    expect(body.imageTools).toEqual([
      {
        capabilities: ['whole-image-raster-vectorization'],
        id: 'vtracer',
        inputMediaTypes: ['image/jpeg', 'image/png', 'image/webp']
      }
    ])
    expect(JSON.stringify(body)).not.toContain('backend-only-secret')
  })

  it('rejects malformed upstream output before returning it to Runtime', async () => {
    const fetchImpl = vi.fn(
      async (_input: string | URL | Request, _init?: RequestInit) =>
        new Response(JSON.stringify({ actions: [], batchId: 'empty-batch' }), {
          status: 200
        })
    )

    await expect(
      requestConfiguredAiActionBatch(input, {
        environment: {
          AI_PROVIDER_API_KEY: 'secret',
          AI_PROVIDER_ENDPOINT: 'https://provider.example/actions',
          AI_PROVIDER_MODEL: 'configured-model'
        },
        fetch: fetchImpl
      })
    ).rejects.toMatchObject({
      code: 'AI_MODEL_BACKEND_INVALID_RESPONSE'
    })
  })
})
