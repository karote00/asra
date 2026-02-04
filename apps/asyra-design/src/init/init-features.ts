import core from '../contexts'
import { inputSystem, interactionCore, systemContext } from '../contexts'

// Import all features - they auto-register via defineFeature()
import '../features'

export const initFeatures = (): void => {
  console.log('[initFeatures] Starting feature initialization...')
  console.log('[initFeatures] core:', !!core)
  console.log(
    '[initFeatures] core.initFeatureSystem:',
    typeof core.initFeatureSystem
  )
  console.log('[initFeatures] inputSystem:', !!inputSystem)
  console.log('[initFeatures] interactionCore:', !!interactionCore)
  console.log('[initFeatures] systemContext:', !!systemContext)

  try {
    core.initFeatureSystem({
      inputSystem,
      systemContext,
      interactionCore
    })
    console.log('[initFeatures] Feature initialization complete')
  } catch (error) {
    console.error('[initFeatures] Error:', error)
  }
}
