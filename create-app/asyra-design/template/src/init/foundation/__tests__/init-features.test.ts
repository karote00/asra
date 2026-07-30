import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  initFeatureSystem: vi.fn(),
  registerAiAgentFeature: vi.fn()
}))

vi.mock('../../../contexts', () => ({
  default: {
    initFeatureSystem: mocks.initFeatureSystem
  },
  inputSystem: {},
  systemContext: {}
}))

vi.mock('../../../features/ai-agent', () => ({
  registerAiAgentFeature: mocks.registerAiAgentFeature
}))

import { initFeatures } from '../init-features'

describe('required Agent Feature initialization', () => {
  beforeEach(() => {
    mocks.initFeatureSystem.mockReset()
    mocks.registerAiAgentFeature.mockReset()
  })

  it('registers the single required runtime and returns its Feature handle', () => {
    const runtime = {
      run: vi.fn()
    }
    const registration = {
      api: {},
      dispose: vi.fn()
    }
    mocks.registerAiAgentFeature.mockReturnValue(registration)

    const initialized = initFeatures({ aiRuntime: runtime })

    expect(mocks.initFeatureSystem).toHaveBeenCalledOnce()
    expect(mocks.registerAiAgentFeature).toHaveBeenCalledOnce()
    expect(mocks.registerAiAgentFeature).toHaveBeenCalledWith(runtime)
    expect(initialized.ai).toBe(registration)
  })

  it('propagates Agent registration failure instead of returning a nullable fallback', () => {
    const failure = new Error('agent-registration-failed')
    mocks.registerAiAgentFeature.mockImplementation(() => {
      throw failure
    })

    expect(() =>
      initFeatures({
        aiRuntime: {
          run: vi.fn()
        }
      })
    ).toThrow(failure)
  })
})
