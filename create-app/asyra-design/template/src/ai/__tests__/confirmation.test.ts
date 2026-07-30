import type { AiActionBatchPreview } from '@asyra/ai-agent-runtime'
import { describe, expect, it, vi } from 'vitest'
import { createAsyraDesignAiConfirmationHandler } from '../confirmation'

const preview: AiActionBatchPreview = Object.freeze({
  actions: Object.freeze([]),
  batchId: 'batch-1'
})

describe('Asyra Design AI confirmation adapter', () => {
  it('defaults to safe cancellation when no UI callback is composed', async () => {
    const handler = createAsyraDesignAiConfirmationHandler()

    await expect(
      handler.confirm(preview, {
        signal: new AbortController().signal
      })
    ).resolves.toBe(false)
  })

  it('forwards one immutable preview and Feature signal to the app callback', async () => {
    const requestConfirmation = vi.fn(async () => true)
    const handler = createAsyraDesignAiConfirmationHandler(requestConfirmation)
    const signal = new AbortController().signal

    await expect(
      handler.confirm(preview, {
        signal
      })
    ).resolves.toBe(true)

    expect(requestConfirmation).toHaveBeenCalledOnce()
    expect(requestConfirmation).toHaveBeenCalledWith(preview, {
      signal
    })
  })
})
