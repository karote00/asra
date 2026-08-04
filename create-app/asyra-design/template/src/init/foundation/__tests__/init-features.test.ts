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

describe('production Feature initialization', () => {
  beforeEach(() => {
    mocks.initFeatureSystem.mockReset()
    mocks.registerAiAgentFeature.mockReset()
  })

  it('always registers the one App-owned Agent runtime', () => {
    const runtime = {
      run: vi.fn()
    }

    initFeatures({
      aiRuntime: runtime
    })

    expect(mocks.initFeatureSystem).toHaveBeenCalledOnce()
    expect(mocks.registerAiAgentFeature).toHaveBeenCalledOnce()
    expect(mocks.registerAiAgentFeature).toHaveBeenCalledWith(runtime)
  })
})
