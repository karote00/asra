import type { AiProvider } from '@asyra/ai-agent-runtime'
import { describe, expect, it, vi } from 'vitest'
import { AsyraDesignAiActionNames } from '../actions'
import { createAsyraDesignAiRuntimeInput } from '../runtime-input'

describe('Asyra Design Agent runtime input', () => {
  it('builds one concrete server-provider runtime input without a delivery mode', () => {
    const provider: AiProvider = {
      requestActionBatch: vi.fn()
    }

    const input = createAsyraDesignAiRuntimeInput({
      permissionRules: {
        [AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION]: 'allow'
      },
      provider
    })

    expect(input.provider).toBe(provider)
    expect(input.actionDefinitions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: AsyraDesignAiActionNames.INSERT_VECTOR_COMPOSITION
        })
      ])
    )
    expect(input).not.toHaveProperty('deliveryMode')
  })
})
