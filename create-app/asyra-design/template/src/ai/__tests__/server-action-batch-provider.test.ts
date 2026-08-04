import type { AiActionBatch, AiProviderInput } from '@asyra/ai-agent-runtime'
import { describe, expect, it, vi } from 'vitest'
import {
  ACTION_BATCH_ENDPOINT,
  createServerActionBatchProvider
} from '../server-action-batch-provider'

const input: AiProviderInput = {
  actions: [],
  attempt: 1,
  context: {},
  intent: 'draw the submitted image',
  metadata: {
    imageAttachments: [
      {
        dataUrl: 'data:image/png;base64,AQID',
        mediaType: 'image/png',
        name: 'reference.png',
        size: 3
      }
    ]
  }
}

const batch: AiActionBatch = {
  actions: [],
  batchId: 'backend-batch'
}

describe('server action-batch provider', () => {
  it('posts the exact Agent request to the one same-origin backend endpoint', async () => {
    const fetch = vi.fn(async () => ({
      json: async () => batch,
      ok: true,
      status: 200
    }))
    const provider = createServerActionBatchProvider({
      fetch: fetch as never
    })

    await expect(
      provider.requestActionBatch(input, {
        signal: new AbortController().signal
      })
    ).resolves.toBe(batch)

    expect(fetch).toHaveBeenCalledOnce()
    expect(fetch).toHaveBeenCalledWith(ACTION_BATCH_ENDPOINT, {
      body: JSON.stringify(input),
      headers: {
        accept: 'application/json',
        'content-type': 'application/json'
      },
      method: 'POST',
      signal: expect.any(AbortSignal)
    })
    expect(ACTION_BATCH_ENDPOINT).toBe('/api/ai/action-batch')
  })

  it('does not accept a resident response or fileId-selected payload', () => {
    expect(createServerActionBatchProvider).toHaveLength(0)
    expect(
      Reflect.getOwnPropertyDescriptor(
        createServerActionBatchProvider,
        'serverResponse'
      )
    ).toBeUndefined()
  })
})
