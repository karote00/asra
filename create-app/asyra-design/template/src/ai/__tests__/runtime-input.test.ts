import type { AiActionBatch } from '@asyra/ai-agent-runtime'
import { describe, expect, it, vi } from 'vitest'
import { createAsyraDesignAiRuntimeInput } from '../runtime-input'

describe('Asyra Design AI runtime input', () => {
  it('composes one fixed action-batch runtime input without product modes', () => {
    const batch: AiActionBatch = {
      actions: [],
      batchId: 'runtime-input'
    }
    const provider = {
      requestActionBatch: vi.fn(async () => batch)
    }

    const input = createAsyraDesignAiRuntimeInput({
      permissionRules: {},
      provider
    })

    expect(input.provider).toBe(provider)
    expect(input.actionDefinitions).toEqual(expect.any(Array))
    expect(input).not.toHaveProperty('deliveryMode')
    expect(input).not.toHaveProperty('providerEnabled')
  })
})
