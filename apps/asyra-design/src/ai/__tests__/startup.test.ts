import type { AiActionBatch } from '@asyra/ai-agent-runtime'
import { describe, expect, it, vi } from 'vitest'
import { createAsyraDesignAiStartup } from '../startup'
import type { AsyraDesignServerResponseRecord } from '../server-response-inbox'

const batch: AiActionBatch = {
  actions: [],
  batchId: 'resident-batch'
}
const response: AsyraDesignServerResponseRecord = {
  batch,
  fileId: 'file-resident',
  schemaVersion: 1
}

describe('Asyra Design AI startup', () => {
  it('always composes the single server action-batch provider route', () => {
    const provider = {
      requestActionBatch: vi.fn()
    }
    const confirmation = {
      dispose: vi.fn(),
      requestConfirmation: vi.fn()
    }
    const history = {
      correlateCommittedAction: vi.fn(),
      dispose: vi.fn(),
      getCurrentActionId: vi.fn(() => null)
    }
    const createProvider = vi.fn(() => provider)

    const startup = createAsyraDesignAiStartup(
      {
        response,
        deliveryMode: 'progressive'
      },
      {
        createConfirmation: vi.fn(() => confirmation as never),
        createHistory: vi.fn(() => history as never),
        createProvider
      }
    )

    expect(createProvider).toHaveBeenCalledWith(response)
    expect(startup).not.toHaveProperty('mode')
    expect(startup.runtimeOptions).toMatchObject({
      createRuntimeInput: expect.any(Function),
      enabled: true,
      providerEnabled: true
    })
    expect(startup.runtimeOptions.createRuntimeInput?.()).toMatchObject({
      provider
    })
  })

  it('keeps AI enabled when the exact inbox record is absent', () => {
    const startup = createAsyraDesignAiStartup(
      {
        response: null,
        deliveryMode: 'progressive'
      },
      {
        createConfirmation: vi.fn(() => ({}) as never),
        createHistory: vi.fn(() => ({}) as never),
        createProvider: vi.fn(() => ({
          requestActionBatch: vi.fn()
        }))
      }
    )

    expect(startup.runtimeOptions).toMatchObject({
      enabled: true,
      providerEnabled: true
    })
  })
})
