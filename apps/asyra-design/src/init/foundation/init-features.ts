import core from '../../contexts'
import { inputSystem, systemContext } from '../../contexts'

// Import all features - they auto-register via defineFeature()
import '../../features'

export const initFeatures = (): void => {
  try {
    core.initFeatureSystem({
      inputSystem,
      systemContext
    })
  } catch (error) {
    console.error('[initFeatures] Error:', error)
  }
}
