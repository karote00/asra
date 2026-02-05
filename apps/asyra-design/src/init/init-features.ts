import core from '../contexts'
import { inputSystem, interactionCore, systemContext } from '../contexts'
import { keyCombinations } from '../config/key-combinations'

// Import all features - they auto-register via defineFeature()
import '../features'

export const initFeatures = (): void => {
  try {
    core.initFeatureSystem({
      inputSystem,
      systemContext,
      interactionCore
    })
    core.setAppKeyCombinations(keyCombinations)
  } catch (error) {
    console.error('[initFeatures] Error:', error)
  }
}
