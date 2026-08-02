import type { AiActionBatch, AiProviderInput } from '@asyra/ai-agent-runtime'
import { describe, expect, it, vi } from 'vitest'
import { createServerActionBatchProvider } from '../server-action-batch-provider'
import type { ServerResponseRecord } from '../server-response-inbox'

const input: AiProviderInput = {
  actions: [],
  attempt: 1,
  context: {},
  intent: 'draw the prepared response'
}

const batch: AiActionBatch = {
  actions: [],
  batchId: 'resident-batch'
}
const response: ServerResponseRecord = {
  batch,
  fileId: 'file-resident',
  schemaVersion: 1
}

describe('Asyra Design server action-batch provider', () => {
  it('exposes only requestActionBatch and returns the same resident batch identity', async () => {
    const provider = createServerActionBatchProvider(response)
    const indexedDbOpen = vi.fn(() => {
      throw new Error('request-time IndexedDB access is forbidden')
    })
    vi.stubGlobal('indexedDB', { open: indexedDbOpen })

    try {
      await expect(
        provider.requestActionBatch(input, {
          signal: new AbortController().signal
        })
      ).resolves.toBe(batch)
    } finally {
      vi.unstubAllGlobals()
    }

    expect(Reflect.ownKeys(provider)).toEqual(['requestActionBatch'])
    expect(indexedDbOpen).not.toHaveBeenCalled()
  })

  it('preserves a present record nullish batch for Runtime envelope resolution', async () => {
    const nullishBatch = null as unknown as AiActionBatch
    const provider = createServerActionBatchProvider({
      batch: nullishBatch,
      fileId: 'file-nullish-batch',
      schemaVersion: 1
    })

    await expect(
      provider.requestActionBatch(input, {
        signal: new AbortController().signal
      })
    ).resolves.toBe(nullishBatch)
  })

  it('fails explicitly when startup has no file-scoped response', async () => {
    const provider = createServerActionBatchProvider(null)

    await expect(
      provider.requestActionBatch(input, {
        signal: new AbortController().signal
      })
    ).rejects.toMatchObject({
      code: 'AI_PROVIDER_INVALID_CONFIGURATION'
    })
  })
})
