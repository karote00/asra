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

describe('conditional AI Feature initialization', () => {
  beforeEach(() => {
    mocks.initFeatureSystem.mockReset()
    mocks.registerAiAgentFeature.mockReset()
  })

  it('initializes ordinary features without registering AI by default', () => {
    initFeatures()

    expect(mocks.initFeatureSystem).toHaveBeenCalledOnce()
    expect(mocks.registerAiAgentFeature).not.toHaveBeenCalled()
  })

  it('does not register the AI Feature when AI is explicitly disabled', () => {
    initFeatures({
      ai: {
        enabled: false,
        providerEnabled: false
      }
    })

    expect(mocks.initFeatureSystem).toHaveBeenCalledOnce()
    expect(mocks.registerAiAgentFeature).not.toHaveBeenCalled()
  })

  it('registers provider-disabled AI without constructing a runtime', () => {
    initFeatures({
      ai: {
        enabled: true,
        providerEnabled: false
      }
    })

    expect(mocks.registerAiAgentFeature).toHaveBeenCalledOnce()
    expect(mocks.registerAiAgentFeature).toHaveBeenCalledWith({
      providerEnabled: false,
      runtime: undefined
    })
  })

  it('passes the app-composed runtime only after provider enablement', () => {
    const runtime = {
      run: vi.fn()
    }

    initFeatures({
      ai: {
        enabled: true,
        providerEnabled: true,
        runtime
      }
    })

    expect(mocks.registerAiAgentFeature).toHaveBeenCalledOnce()
    expect(mocks.registerAiAgentFeature).toHaveBeenCalledWith({
      providerEnabled: true,
      runtime
    })
  })
})
