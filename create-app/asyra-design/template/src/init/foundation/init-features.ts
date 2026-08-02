import core from '../../contexts'
import { inputSystem, systemContext } from '../../contexts'
import {
  registerAiAgentFeature,
  type AiAgentFeatureApi,
  type AiAgentFeatureRuntime
} from '../../features/ai-agent'

// Import all features - they auto-register via defineFeature()
import '../../features'

export interface InitFeaturesOptions {
  readonly aiRuntime: AiAgentFeatureRuntime
}

export interface InitializedAiAgentFeature {
  readonly api: AiAgentFeatureApi
  dispose(): boolean
}

export interface InitializedFeatures {
  readonly ai: InitializedAiAgentFeature
}

export const initFeatures = (
  options: InitFeaturesOptions
): InitializedFeatures => {
  core.initFeatureSystem({
    inputSystem,
    systemContext
  })
  const registration = registerAiAgentFeature(options.aiRuntime)
  return Object.freeze({
    ai: registration
  })
}
