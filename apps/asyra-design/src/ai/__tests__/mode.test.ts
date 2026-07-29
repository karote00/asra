import { describe, expect, it, vi } from 'vitest'
import {
  createAsyraDesignAiStartup,
  resolveAsyraDesignAiDeliveryMode
} from '../mode'

describe('Asyra Design AI startup configuration', () => {
  it.each([
    ['', 'progressive'],
    ['?ai=mock', 'progressive'],
    ['?other=1&ai=mock', 'progressive'],
    ['?aiDelivery=', 'progressive'],
    ['?aiDelivery=unknown', 'progressive'],
    ['?aiDelivery=progressive&aiDelivery=atomic', 'progressive'],
    ['?aiDelivery=progressive&aiDelivery=progressive', 'progressive'],
    ['?aiDelivery=atomic', 'atomic'],
    ['?aiDelivery=progressive', 'progressive'],
    ['?other=1&aiDelivery=progressive', 'progressive']
  ] as const)('resolves delivery %s to %s', (search, expected) => {
    expect(resolveAsyraDesignAiDeliveryMode(search)).toBe(expected)
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

  it('composes one no-network mock provider and app confirmation broker for production startup', () => {
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
