import { describe, expect, it, vi } from 'vitest'
import { createAsyraDesignAiStartup, resolveAsyraDesignAiMode } from '../mode'

describe('Asyra Design AI URL mode', () => {
  it.each([
    ['', 'disabled'],
    ['?ai=', 'disabled'],
    ['?ai=live', 'disabled'],
    ['?ai=Mock', 'disabled'],
    ['?ai=mock&ai=live', 'disabled'],
    ['?ai=mock&ai=mock', 'disabled'],
    ['?other=mock', 'disabled'],
    ['?ai=mock', 'mock'],
    ['?other=1&ai=mock', 'mock']
  ] as const)('resolves %s to %s', (search, expected) => {
    expect(resolveAsyraDesignAiMode(search)).toBe(expected)
  })

  it('constructs no AI dependency for disabled or unknown startup', () => {
    const createProvider = vi.fn()
    const createConfirmation = vi.fn()
    const createHistory = vi.fn()

    expect(
      createAsyraDesignAiStartup('disabled', {
        createConfirmation,
        createHistory,
        createProvider
      })
    ).toEqual({
      confirmation: null,
      history: null,
      mode: 'disabled',
      runtimeOptions: {
        enabled: false
      }
    })
    expect(createProvider).not.toHaveBeenCalled()
    expect(createConfirmation).not.toHaveBeenCalled()
    expect(createHistory).not.toHaveBeenCalled()
  })

  it('composes one no-network mock provider and app confirmation broker only in mock mode', () => {
    const provider = {
      dispose: vi.fn(),
      generateActionPlan: vi.fn()
    }
    const confirmation = {
      dispose: vi.fn(),
      requestConfirmation: vi.fn()
    }
    const history = {
      correlateCommittedAction: vi.fn(),
      getCurrentActionId: vi.fn(() => null)
    }
    const startup = createAsyraDesignAiStartup('mock', {
      createConfirmation: vi.fn(() => confirmation as never),
      createHistory: vi.fn(() => history as never),
      createProvider: vi.fn(() => provider)
    })

    expect(startup).toMatchObject({
      confirmation,
      history,
      mode: 'mock',
      runtimeOptions: {
        enabled: true,
        providerEnabled: true,
        createRuntimeInput: expect.any(Function)
      }
    })
    expect(startup.runtimeOptions.createRuntimeInput?.()).toMatchObject({
      ownedResources: [provider],
      provider
    })
  })
})
