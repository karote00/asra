import core from '../../contexts'
import { inputSystem, systemContext } from '../../contexts'
import {
  registerAiAgentFeature,
  type AiAgentFeatureApi,
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

export interface InitializedAiAgentFeature {
  readonly api: AiAgentFeatureApi
  dispose(): boolean
}

export interface InitializedFeatures {
  readonly ai: InitializedAiAgentFeature | null
}

export const initFeatures = (
  options: InitFeaturesOptions = {}
): InitializedFeatures => {
  try {
    core.initFeatureSystem({
      inputSystem,
      systemContext
    })
    if (options.ai?.enabled) {
      const registration = registerAiAgentFeature({
        providerEnabled: options.ai.providerEnabled,
        runtime: options.ai.runtime
      })
      return Object.freeze({
        ai: registration
      })
    }
  } catch (error) {
    console.error('[initFeatures] Error:', error)
  }
  return Object.freeze({
    ai: null
  })
}
