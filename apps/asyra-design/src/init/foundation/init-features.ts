import core from '../../contexts'
import { inputSystem, systemContext } from '../../contexts'
import {
  registerAiAgentFeature,
  type AiAgentFeatureRuntime
} from '../../features/ai-agent'

// Import all features - they auto-register via defineFeature()
import '../../features'

export interface InitAiAgentFeatureOptions {
  readonly enabled: boolean
  readonly providerEnabled: boolean
  readonly runtime?: AiAgentFeatureRuntime
}

export interface InitFeaturesOptions {
  readonly ai?: InitAiAgentFeatureOptions
}

export const initFeatures = (options: InitFeaturesOptions = {}): void => {
  try {
    core.initFeatureSystem({
      inputSystem,
      systemContext
    })
    if (options.ai?.enabled) {
      registerAiAgentFeature({
        providerEnabled: options.ai.providerEnabled,
        runtime: options.ai.runtime
      })
    }
  } catch (error) {
    console.error('[initFeatures] Error:', error)
  }
}
