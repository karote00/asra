import core from '../../contexts'
import { inputSystem, interactionCore, systemContext } from '../../contexts'

// Import all features - they auto-register via defineFeature()
import '../../features'

export const initFeatures = (): void => {
  try {
    core.initFeatureSystem({
      inputSystem,
      systemContext,
      interactionCore
    })
  } catch (error) {
    console.error('[initFeatures] Error:', error)
  }
}
